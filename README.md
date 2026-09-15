# Claude Resilience & Auto-Notifier Extension

A high-resilience, security-hardened Google Chrome extension (Manifest V3) designed specifically for the **Claude Free Tier** (`https://claude.ai`).

## Features
- **Session Resilience & Auto-Recovery:** Monitors Claude streaming states, keeps service workers alive, and prevents timeouts during long generations.
- **Rate-Limit Detection:** Automatically identifies Claude free-tier cooldown messages (*"You are out of free messages until..."*) and logs the reset window.
- **Email Notifications:** Delivers instant email alerts when Claude finishes generating responses or hits usage limits using the free [Resend API](https://resend.com) (no paid Claude subscription required).
- **Airtight Security Architecture:** Zero native messaging, strict origin validation, token-bucket rate limiting, and prompt-injection sanitization.

## Security Architecture
1. **Chrome Sandbox Isolation:** Operates strictly within browser memory. Does not request native permissions, preventing any access to your host operating system.
2. **IPC Sender Validation:** Background service worker verifies `sender.id` and `sender.url` to reject spoofed messages from untrusted tabs or external websites.
3. **Secret Isolation:** Email API keys are stored in `chrome.storage.local` and handled only by the background service worker—never exposed to webpage DOMs.
4. **Anti-Spam Rate Limiter:** Hard limit of 10 emails per hour with a 60-second cooldown to protect against infinite error loops.

## License
MIT