/**
 * src/content.js
 * Observes Claude.ai DOM, extracts reset times, and handles auto-resume
 * Self-healing against "Extension context invalidated" errors
 */
(() => {
  let isGenerating = false;
  let lastReportedLimit = 0;
  let heartbeatTimer = null;
  let observer = null;

  // 1. Guard check: verifies if extension context is still alive
  function isContextValid() {
    return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
  }

  // 2. Safe message sender that prevents "Extension context invalidated"
  function safeSendMessage(payload, callback) {
    if (!isContextValid()) {
      cleanupOrphanedScript();
      return;
    }

    try {
      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          // Service worker was asleep or restarting; safely suppress
          return;
        }
        if (callback && typeof callback === 'function') {
          callback(response);
        }
      });
    } catch (err) {
      if (err.message && err.message.includes('Extension context invalidated')) {
        cleanupOrphanedScript();
      } else {
        console.warn('[Claude Resilience] Message dispatch skipped:', err.message);
      }
    }
  }

  // 3. Clean up timers if extension was reloaded in chrome://extensions
  function cleanupOrphanedScript() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // 4. Listen for actions dispatched by background worker
  if (isContextValid()) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'PING_HEARTBEAT') {
        sendResponse({ status: 'ALIVE', url: window.location.href });
      }

      if (msg.type === 'EXECUTE_AUTO_RESUME') {
        const resumed = attemptAutoResume();
        sendResponse({ success: resumed });
      }
    });
  }

  // Helper: Parses Claude's "until 4:30 PM" text into a timestamp
  function parseResetTime(text) {
    const match = text.match(/until\s+(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
    if (!match) return null;

    const timeStr = match[1];
    const now = new Date();
    const parsedDate = new Date(`${now.toDateString()} ${timeStr}`);

    if (parsedDate.getTime() <= now.getTime()) {
      parsedDate.setDate(parsedDate.getDate() + 1);
    }

    return {
      timeStr: timeStr,
      timestamp: parsedDate.getTime()
    };
  }

  // Helper: Clicks Retry or submits "Please continue."
  function attemptAutoResume() {
    const retryBtn = document.querySelector('button[aria-label*="Retry"], button:has(svg)');
    if (retryBtn && retryBtn.innerText.toLowerCase().includes('retry')) {
      retryBtn.click();
      return true;
    }

    const inputBox = document.querySelector('div[contenteditable="true"], textarea');
    if (inputBox) {
      inputBox.focus();
      document.execCommand('insertText', false, 'Please continue.');

      setTimeout(() => {
        const sendBtn = document.querySelector('button[aria-label*="Send"], button[data-testid*="send-button"]');
        if (sendBtn) sendBtn.click();
      }, 500);
      return true;
    }

    return false;
  }

  // 5. Inspect Claude DOM state
  function inspectClaudeDOM() {
    if (!isContextValid()) {
      cleanupOrphanedScript();
      return;
    }

    const pageText = document.body ? document.body.innerText : '';

    // Check for rate limit banners
    if (
      pageText.includes('free message limit') ||
      pageText.includes('reached your limit') ||
      pageText.includes('try again after') ||
      pageText.includes('out of free messages')
    ) {
      const now = Date.now();
      if (now - lastReportedLimit > 10 * 60 * 1000) {
        lastReportedLimit = now;
        const resetInfo = parseResetTime(pageText);

        safeSendMessage({
          type: 'CLAUDE_LIMIT_DETECTED',
          details: `Claude free-tier limit hit. Estimated reset: ${resetInfo ? resetInfo.timeStr : 'Unknown'}`,
          resetTimestamp: resetInfo ? resetInfo.timestamp : null,
          resetTimeStr: resetInfo ? resetInfo.timeStr : null
        });
      }
      return;
    }

    // Check for streaming response
    const stopButton = document.querySelector(
      'button[aria-label*="Stop"], button[data-testid*="stop-button"], button[aria-label*="Cancel"]'
    );

    if (stopButton && !isGenerating) {
      isGenerating = true;
      safeSendMessage({ type: 'CLAUDE_STREAM_START' });
    } else if (!stopButton && isGenerating) {
      isGenerating = false;
      safeSendMessage({
        type: 'CLAUDE_STREAM_COMPLETE',
        details: 'Claude finished responding to your prompt.'
      });
    }
  }

  // 6. Start MutationObserver
  observer = new MutationObserver(() => {
    inspectClaudeDOM();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // 7. Periodic keep-alive ping (Safely wrapped)
  heartbeatTimer = setInterval(() => {
    safeSendMessage({ type: 'CLAUDE_HEARTBEAT' });
  }, 45000);

  console.log('[Claude Resilience] Self-healing content script active.');
})();