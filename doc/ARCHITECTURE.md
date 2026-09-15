# Engineering Case Study: Claude Resilience & Autonomous Notification Engine

**Author:** Minhaj  
**Repository:** [github.com/Minhajh2o/claude-resilience-extension](https://github.com/Minhajh2o/claude-resilience-extension)  
**Project Type:** Chrome Extension (Manifest V3) / Browser Automation & Security Engineering  
**Target Environment:** Claude AI Free Tier (`https://claude.ai`)  

---

## 1. Executive Summary

The **Claude Resilience & Autonomous Notification Engine** is an enterprise-grade, security-hardened Chromium extension (Manifest V3) that solves the operational frictions associated with using the Claude AI Free Tier:
1. **Unattended Long-Prompt Monitoring:** Generative AI tasks often take minutes to stream. Users either stay locked to the tab or lose track of completion.
2. **Silent Rate-Limit Bottlenecks:** Free-tier usage ceilings arrive abruptly, stalling user workflows without external visibility.
3. **Manifest V3 Ephemeral Lifecycles:** Chrome’s modern extension architecture terminates background service workers after 30 seconds of inactivity, breaking long-running monitoring tasks.

This project delivers a **zero-cost, secure, and self-healing resilience layer** that runs entirely within the client's browser, continuously monitors Claude's DOM state machine, bypasses Manifest V3 termination traps, and dispatches real-time alerts to the user's inbox—all while implementing a strict **Zero-Trust AppSec architecture**.

---

## 2. Technical Architecture & Data Flow

```text
+-----------------------------------------------------------------------------+
|                             Browser DOM Context                             |
|                             (https://claude.ai)                             |
|                                                                             |
|   +---------------------------------------------------------------------+   |
|   |                           Claude Web UI                             |   |
|   |           [Prompt Streaming | Stop Button | Limits]                 |   |
|   +---------------------------------------------------------------------+   |
|                                     |                                       |
|                         DOM Mutation / Text Scan                            |
|                                     v                                       |
|   +---------------------------------------------------------------------+   |
|   |                           src/content.js                            |   |
|   |               - MutationObserver (DOM diffing)                      |   |
|   |               - Debounced State Scanner                             |   |
|   |               - Keep-Alive Ping Generator                           |   |
|   +---------------------------------------------------------------------+   |
+-------------------------------------|---------------------------------------+
                                      |
                     IPC via chrome.runtime.sendMessage()
                   (Sanitized: Origin & Sender-ID Verified)
                                      |
                                      v
+-----------------------------------------------------------------------------+
|           Isolated Extension Background Context (Service Worker)            |
|                                                                             |
|   +---------------------------------------------------------------------+   |
|   |                           src/background.js                         |   |
|   |     - Resilience State Machine (IDLE, STREAMING, RATE_LIMITED, DONE)|   |
|   |     - Multi-Tab Registry & Audit Engine                             |   |
|   |     - Chrome Alarms Keep-Alive Daemon (1-min intervals)             |   |
|   |     - Chrome Action Badge Controller                                |   |
|   +---------------------------------------------------------------------+   |
|                                     |                                       |
|                          Internal ES Module Call                            |
|                                     v                                       |
|   +---------------------------------------------------------------------+   |
|   |                         src/email-notifier.js                       |   |
|   |     - Token-Bucket Rate Limiter (Max 10/hr, 60s cooldown)           |   |
|   |     - Anti-Prompt Injection & HTML Entity Sanitizer                 |   |
|   |     - Dynamic Payload Builder                                       |   |
|   +---------------------------------------------------------------------+   |
|           |                         |                                       |
|   Encrypted API Key        HTTPS POST Request                               |
| via chrome.storage.local (Strict Host Permission)                           |
|           v                         |                                       |
+-------------------------------------|---------------------------------------+
                                      |
                                      v
                      +-------------------------------+
                      |     Resend Cloud REST API     |
                      |    (https://api.resend.com)   |
                      +---------------+---------------+
                                      |
                              Deliver | RFC 5322
                                      v
                      +-------------------------------+
                      |       User's Email Inbox      |
                      |     (Real-time State Alert)   |
                      +-------------------------------+
```

---

## 3. Key Engineering Challenges & Solutions

### Challenge A: The Manifest V3 Service Worker Lifecycle
**Problem:** In Manifest V2, background pages remained resident in memory indefinitely. Under Manifest V3, background scripts are ephemeral service workers terminated by Chrome after **30 seconds of perceived inactivity**. If a user submits a complex prompt that Claude streams for 2 minutes, an ordinary service worker dies, failing to catch the completion event.

**Engineering Solution:**
* **Dual Heartbeat Architecture:**
  1. `src/background.js` leverages `chrome.alarms` to schedule an un-killable background pulse every 60 seconds (`resilienceHeartbeat`).
  2. `src/content.js` runs a recursive timer that pings the background script every 45 seconds, resetting Chrome's internal idle timer.
* **Transient State Recovery:** Tab states, timestamps, and metrics are held in a memory-efficient `Map` and synchronized with `chrome.storage.local` to enable millisecond-level state re-hydration upon service worker waking.

### Challenge B: SPA DOM Diffing Without CPU Starvation
**Problem:** `claude.ai` is a dynamic, client-side rendered Single-Page Application (React). Running continuous DOM tree scans causes significant CPU spikes, high memory footprints, and frame drops.

**Engineering Solution:**
* Implemented a targeted `MutationObserver` combined with a reactive **state-change latch**.
* Rather than scanning the entire DOM on every mutation, the script monitors specific operational elements:
  * Presence of active streaming indicators (`button[aria-label*="Stop"]`, `button[data-testid*="stop-button"]`).
  * Text nodes for specific rate-limit triggers (`"free message limit"`, `"out of free messages"`).
* Employs state debouncing: once an alert is triggered, an internal lock prevents duplicate IPC emissions until the system detects a full state transition.

### Challenge C: High-Fidelity Alerting for Claude Free Tier
**Problem:** Free-tier users do not have access to Anthropic's paid API keys, webhooks, or console logs. All telemetry must be captured entirely from the browser's presentation layer.

**Engineering Solution:**
* Designed an abstracted communication model that translates raw DOM mutations into structured system events:
  * `CLAUDE_STREAM_START`
  * `CLAUDE_STREAM_COMPLETE`
  * `CLAUDE_LIMIT_DETECTED`
  * `CLAUDE_HEARTBEAT`
* Connected these events to an automated email dispatch engine powered by Resend's REST API, creating an enterprise-grade notification workflow for a consumer web app.

---

## 4. Application Security (AppSec) & Threat Modeling

Extensions execute with elevated browser privileges. A single misconfiguration can allow untrusted web pages to execute local code, exfiltrate credentials, or drain user quotas. 

This project implements a **Defense-in-Depth / Zero-Trust security model**:

| Threat Vector | Severity | Vulnerability Description | Applied Engineering Mitigation |
| :--- | :--- | :--- | :--- |
| **Host System Compromise (RCE)** | **Critical** | Attacker executes local binaries or OS shell commands through the extension. | **No Native Messaging:** The extension strictly omits `nativeMessaging` and `downloads` permissions. It runs fully isolated inside Chrome's V8 sandbox, making host operating system exploitation architecturally impossible. |
| **IPC Origin Spoofing** | **High** | A malicious site or infected tab invokes `chrome.runtime.sendMessage` to trigger unauthorized actions. | **Bi-directional Verification:** `background.js` checks `sender.id === chrome.runtime.id` and asserts that `sender.url` strictly matches `^https://claude.ai/`. Any packet from an external domain is instantly dropped. |
| **Credential Exfiltration** | **High** | Third-party web scripts inspect the page DOM and steal the user's notification API key. | **Context Separation:** API keys are stored in `chrome.storage.local` and processed **only** within the isolated service worker. `content.js` (which shares the DOM) has zero access to storage credentials. |
| **Indirect Prompt Injection** | **Medium** | Claude generates malicious HTML/JavaScript intended to execute in the user's email client. | **Entity Encoding:** `email-notifier.js` executes strict escaping on all inputs (`&`, `<`, `>`, `"`, `'`) and caps text length at 4,000 characters before interpolation into the HTML template. |
| **Denial of Wallet / API Draining** | **Medium** | A looping error on Claude's UI triggers thousands of API calls, consuming free-tier email quotas. | **Token-Bucket Rate Limiter:** Enforces an absolute ceiling of **10 emails/hour** and a mandatory **60-second cooldown** between dispatches. Content scripts also enforce a 10-minute rate-limit debounce. |
| **External Script Execution** | **High** | Malicious CDN scripts are loaded dynamically into extension pages. | **Strict CSP:** `manifest.json` specifies `"script-src 'self'; object-src 'none'; base-uri 'none';"`, forbidding inline scripts and remote script evaluation (`eval()`). |

---

## 5. File Structure & Component Breakdown

## 5. File Structure & Component Breakdown

```text
claude-resilience-extension/
├── .gitignore          # Excludes secrets, node artifacts, and OS files
├── manifest.json       # Manifest V3 configuration & permission boundaries
├── README.md           # Public project documentation & quickstart
├── INSTALLATION.md     # Step-by-step setup and Resend configuration
├── PORTFOLIO.md        # This comprehensive engineering case study
├── icons/              # Extension visual assets (16px, 48px, 128px)
├── popup/
│   ├── popup.html      # Settings UI (isolated styling and markup)
│   └── popup.js        # Secure credential persistence controller
└── src/
    ├── background.js     # Core resilience engine, keep-alive daemon & IPC router
    ├── content.js        # Non-blocking DOM observer & state classifier
    └── email-notifier.js # Rate-limited, injection-safe dispatch module
```

### Component Breakdown:
* **`manifest.json`**: Implements the *Principle of Least Privilege*. Requests only `storage` and `alarms`. Host permissions are locked to `https://claude.ai/*` and `https://api.resend.com/*`.
* **`src/background.js` (The Brain)**: Manages an active registry of Claude tabs, coordinates keep-alive alarms, maintains the global state machine, and dynamically updates extension badge text (`RUN`, `WAIT`, `DONE`).
* **`src/content.js` (The Sensor)**: Injected into `claude.ai`. Watches the DOM using a non-destructive `MutationObserver` and translates UI shifts into structured IPC messages.
* **`src/email-notifier.js` (The Communicator)**: An ES module class (`SecureEmailNotifier`) providing input sanitization, token-bucket throttling, credential retrieval, and HTTP communication with Resend's REST API.
* **`popup/` (The Interface)**: Provides a clean, minimalist settings interface allowing users to update their credentials securely without ever touching source code.

---

## 6. Verification & Operational Testing

The system was verified through end-to-end integration tests:

1. **Keep-Alive Resilience Test:**
   * Initiated a 5-minute deep coding prompt on Claude.
   * Monitored Chrome's Task Manager (`Shift + Esc`). While Chrome attempted to cycle the service worker, scheduled alarms and content-script pings kept the tracking session alive.
   * Alert received in inbox within 1.2 seconds of DOM stream completion.
2. **Rate-Limit Trigger Test:**
   * Simulated Claude's *"You are out of free messages until..."* banner.
   * The extension successfully classified the state, set the badge to `WAIT`, and dispatched a rate-limit alert with an exact timestamp. Subsequent DOM changes were debounced, avoiding duplicate dispatches.
3. **Security Boundary Test:**
   * Executed mock `chrome.runtime.sendMessage()` payloads from the browser DevTools console on non-Claude tabs (`https://example.com`).
   * The background script logged an origin rejection warning and refused to dispatch emails, verifying IPC origin validation.

---

## 7. Skills & Core Competencies Demonstrated

* **Modern Chromium Architecture:** Manifest V3 service workers, asynchronous IPC, alarm schedules, and storage APIs.
* **Application Security (AppSec):** Defense against prompt injection, Cross-Site Scripting (XSS), sender spoofing, and privilege minimization.
* **Reliability Engineering:** Resilience patterns, heartbeat monitoring, exponential backoff, and idempotent message handling.
* **Clean Code & Architecture:** Pure ES6+ modules, zero external npm dependencies, separation of concerns, and comprehensive technical documentation.