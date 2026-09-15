/**
 * src/background.js
 * Complete Resilient Service Worker with State Recovery & Security
 */
import { SecureEmailNotifier } from "./email-notifier.js";

const notifier = new SecureEmailNotifier();

// Global resilience state
const State = {
  activeTabs: new Map(), // tabId -> { lastHeartbeat, status, retryCount }
  stats: {
    recoveredSessions: 0,
    alertsSent: 0,
    startTime: Date.now(),
  },
};

// ==========================================
// 1. KEEP-ALIVE & ALARM SYSTEM
// ==========================================
chrome.alarms.create("resilienceHeartbeat", { periodInMinutes: 1 });
chrome.alarms.create("stateCleanup", { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "resilienceHeartbeat") {
    await performHeartbeatAudit();
  } else if (alarm.name === "stateCleanup") {
    cleanupStaleSessions();
  } else if (alarm.name === "quotaResetAlarm") {
    // === ALARM FIRED: QUOTA HAS RESET ===
    handleQuotaReset();
  }
});

async function performHeartbeatAudit() {
  chrome.tabs.query({ url: "https://claude.ai/*" }, (tabs) => {
    const currentTabIds = new Set(tabs.map((t) => t.id));

    // Remove closed tabs
    for (const tabId of State.activeTabs.keys()) {
      if (!currentTabIds.has(tabId)) {
        State.activeTabs.delete(tabId);
      }
    }

    // Ping active tabs to ensure content script responsiveness
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(
        tab.id,
        { type: "PING_HEARTBEAT" },
        (response) => {
          if (chrome.runtime.lastError) {
            // Tab may have crashed or navigated
            handleUnresponsiveTab(tab.id);
          } else if (response?.status === "ALIVE") {
            updateTabState(tab.id, "ACTIVE");
          }
        },
      );
    });
  });
}

function handleUnresponsiveTab(tabId) {
  const tabData = State.activeTabs.get(tabId);
  if (!tabData) return;

  tabData.retryCount = (tabData.retryCount || 0) + 1;
  console.warn(
    `[Resilience] Tab ${tabId} unresponsive. Attempt: ${tabData.retryCount}`,
  );

  if (tabData.retryCount >= 3) {
    notifier.sendAlert({
      event: "CLAUDE_NETWORK_ERROR",
      title: "Claude Tab Connection Lost",
      details: `Tab ${tabId} stopped responding to heartbeats after 3 attempts.`,
    });
    tabData.retryCount = 0; // reset
  }
}

function updateTabState(tabId, status, extra = {}) {
  const existing = State.activeTabs.get(tabId) || { retryCount: 0 };
  State.activeTabs.set(tabId, {
    ...existing,
    status,
    lastHeartbeat: Date.now(),
    ...extra,
  });
  updateExtensionBadge(status);
}

function cleanupStaleSessions() {
  const now = Date.now();
  for (const [tabId, data] of State.activeTabs.entries()) {
    if (now - data.lastHeartbeat > 10 * 60 * 1000) {
      State.activeTabs.delete(tabId);
    }
  }
}

// ==========================================
// 2. BADGE & UI STATUS
// ==========================================
function updateExtensionBadge(status) {
  let text = "";
  let color = "#475569";

  switch (status) {
    case "ACTIVE":
    case "STREAMING":
      text = "RUN";
      color = "#0284c7";
      break;
    case "RATE_LIMITED":
      text = "WAIT";
      color = "#e11d48";
      break;
    case "COMPLETED":
      text = "DONE";
      color = "#16a34a";
      break;
    default:
      text = "";
  }

  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

// ==========================================
// 3. SECURE MESSAGE LISTENER (IPC)
// ==========================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // SECURITY CHECK 1: Ensure message originates from our extension
  if (sender.id !== chrome.runtime.id) {
    console.warn("[Security] Message rejected: Untrusted extension ID");
    sendResponse({ status: "REJECTED_UNAUTHORIZED" });
    return false;
  }

  // SECURITY CHECK 2: Ensure origin matches official Claude domain
  if (!sender.url || !sender.url.startsWith("https://claude.ai/")) {
    console.warn("[Security] Message rejected: Invalid origin URL", sender.url);
    sendResponse({ status: "REJECTED_ORIGIN" });
    return false;
  }

  const tabId = sender.tab?.id;

  // Process authorized event handlers
  switch (message.type) {
    case "CLAUDE_HEARTBEAT":
      updateTabState(tabId, "ACTIVE");
      sendResponse({ status: "ACKNOWLEDGED" });
      break;

    case "CLAUDE_STREAM_START":
      updateTabState(tabId, "STREAMING");
      sendResponse({ status: "STREAMING_LOGGED" });
      break;

    case "CLAUDE_STREAM_COMPLETE":
      updateTabState(tabId, "COMPLETED");
      notifier
        .sendAlert({
          event: "CLAUDE_TASK_COMPLETED",
          title: "Claude Response Finished",
          details:
            message.details || "Claude has finished generating your response.",
        })
        .then((res) => {
          if (res.success) State.stats.alertsSent++;
        });
      sendResponse({ status: "COMPLETE_HANDLED" });
      break;

    case "CLAUDE_LIMIT_DETECTED":
      updateTabState(tabId, "RATE_LIMITED");

      // 1. Send immediate alert that limit was hit
      notifier.sendAlert({
        event: "CLAUDE_RATE_LIMIT_HIT",
        title: "Claude Free-Tier Limit Hit",
        details: `${message.details}\nWe have set an alarm for when your quota resets.`,
      });

      // 2. If a reset timestamp was found, schedule an exact alarm
      if (message.resetTimestamp) {
        chrome.alarms.create("quotaResetAlarm", {
          when: message.resetTimestamp,
        });
        console.log(
          `[Resilience] Quota reset alarm set for: ${new Date(message.resetTimestamp).toLocaleTimeString()}`,
        );
      }
      sendResponse({ status: "LIMIT_SCHEDULED" });
      break;

    case "GET_STATUS_METRICS":
      sendResponse({
        activeTabsCount: State.activeTabs.size,
        stats: State.stats,
        uptimeMinutes: Math.round((Date.now() - State.stats.startTime) / 60000),
      });
      break;

    default:
      sendResponse({ status: "UNKNOWN_MESSAGE_TYPE" });
  }

  return true; // Keep channel open for async handlers
});

// ==========================================
// 4. TAB EVENT LISTENERS
// ==========================================
chrome.tabs.onRemoved.addListener((tabId) => {
  if (State.activeTabs.has(tabId)) {
    State.activeTabs.delete(tabId);
    if (State.activeTabs.size === 0) {
      updateExtensionBadge("");
    }
  }
});

console.log(
  "[Claude Resilience] Secure background service worker initialized.",
);

console.log(
  "[Claude Resilience] Secure background service worker initialized."
);

// ==========================================
// 5. QUOTA RESET & AUTO-RESUME HANDLER
// ==========================================
async function handleQuotaReset() {
  console.log('[Resilience] Quota reset timer triggered!');

  chrome.tabs.query({ url: 'https://claude.ai/*' }, async (tabs) => {
    if (tabs.length > 0) {
      const activeTab = tabs[0];

      chrome.tabs.sendMessage(activeTab.id, { type: 'EXECUTE_AUTO_RESUME' }, async (response) => {
        if (response?.success) {
          await notifier.sendAlert({
            event: 'CLAUDE_AUTO_RESUMED',
            title: 'Claude Quota Reset: Conversation Auto-Resumed!',
            details: 'Your Claude free tier limit expired. The extension automatically resumed the prompt for you.'
          });
        } else {
          await notifier.sendAlert({
            event: 'CLAUDE_QUOTA_RESET',
            title: 'Claude Quota Reset: Ready to Continue',
            details: 'Your free tier quota has reset! Please open your Claude tab and continue your conversation.'
          });
        }
      });
    } else {
      await notifier.sendAlert({
        event: 'CLAUDE_QUOTA_RESET',
        title: 'Claude Quota Reset',
        details: 'Your free tier limit has expired. Open Claude to continue.'
      });
    }
  });
}