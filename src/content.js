/**
 * src/content.js
 * Observes Claude.ai DOM, extracts reset time, and auto-resumes
 */
(() => {
  let isGenerating = false;
  let lastReportedLimit = 0;

  // Listen for actions dispatched by the background worker
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'PING_HEARTBEAT') {
      sendResponse({ status: 'ALIVE', url: window.location.href });
    }

    // Command from background to automatically resume conversation
    if (msg.type === 'EXECUTE_AUTO_RESUME') {
      const resumed = attemptAutoResume();
      sendResponse({ success: resumed });
    }
  });

  // Helper to parse Claude's "until 4:30 PM" or "until 5 PM" text into a timestamp
  function parseResetTime(text) {
    const match = text.match(/until\s+(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
    if (!match) return null;

    const timeStr = match[1];
    const now = new Date();
    const parsedDate = new Date(`${now.toDateString()} ${timeStr}`);

    // If parsed time is earlier than now, it belongs to the next day
    if (parsedDate.getTime() <= now.getTime()) {
      parsedDate.setDate(parsedDate.getDate() + 1);
    }

    return {
      timeStr: timeStr,
      timestamp: parsedDate.getTime()
    };
  }

  // Helper to automatically click Retry or type "Continue"
  function attemptAutoResume() {
    // 1. Check if there's a visible "Retry" button
    const retryBtn = document.querySelector('button[aria-label*="Retry"], button:has(svg)');
    if (retryBtn && retryBtn.innerText.toLowerCase().includes('retry')) {
      retryBtn.click();
      return true;
    }

    // 2. Otherwise find the prompt input box and submit "Please continue."
    const inputBox = document.querySelector('div[contenteditable="true"], textarea');
    if (inputBox) {
      inputBox.focus();
      document.execCommand('insertText', false, 'Please continue.');

      // Click the send button after a small delay
      setTimeout(() => {
        const sendBtn = document.querySelector('button[aria-label*="Send"], button[data-testid*="send-button"]');
        if (sendBtn) sendBtn.click();
      }, 500);
      return true;
    }

    return false;
  }

  function inspectClaudeDOM() {
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

        chrome.runtime.sendMessage({
          type: 'CLAUDE_LIMIT_DETECTED',
          details: `Claude free-tier limit hit. Estimated reset: ${resetInfo ? resetInfo.timeStr : 'Unknown'}`,
          resetTimestamp: resetInfo ? resetInfo.timestamp : null,
          resetTimeStr: resetInfo ? resetInfo.timeStr : null
        });
      }
      return;
    }

    // Streaming detection
    const stopButton = document.querySelector(
      'button[aria-label*="Stop"], button[data-testid*="stop-button"], button[aria-label*="Cancel"]'
    );

    if (stopButton && !isGenerating) {
      isGenerating = true;
      chrome.runtime.sendMessage({ type: 'CLAUDE_STREAM_START' });
    } else if (!stopButton && isGenerating) {
      isGenerating = false;
      chrome.runtime.sendMessage({
        type: 'CLAUDE_STREAM_COMPLETE',
        details: 'Claude finished responding to your prompt.'
      });
    }
  }

  const observer = new MutationObserver(() => {
    inspectClaudeDOM();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  setInterval(() => {
    chrome.runtime.sendMessage({ type: 'CLAUDE_HEARTBEAT' }, () => {
      if (chrome.runtime.lastError) {}
    });
  }, 45000);
})();