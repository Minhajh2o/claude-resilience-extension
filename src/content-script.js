/**
 * src/content.js
 * Observes Claude.ai DOM states safely and sends IPC updates
 */
(() => {
  let isGenerating = false;
  let lastReportedLimit = 0;

  // 1. Respond to background health check heartbeats
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'PING_HEARTBEAT') {
      sendResponse({ status: 'ALIVE', url: window.location.href });
    }
  });

  // 2. Safe DOM scanner
  function inspectClaudeDOM() {
    const pageText = document.body ? document.body.innerText : '';

    // Detect free-tier rate limits
    if (
      pageText.includes('free message limit') ||
      pageText.includes('reached your limit') ||
      pageText.includes('try again after') ||
      pageText.includes('out of free messages')
    ) {
      const now = Date.now();
      // Debounce limit notification to once every 10 minutes
      if (now - lastReportedLimit > 10 * 60 * 1000) {
        lastReportedLimit = now;
        chrome.runtime.sendMessage({
          type: 'CLAUDE_LIMIT_DETECTED',
          details: 'Claude displayed a free tier rate limit banner on the page.'
        });
      }
      return;
    }

    // Detect generation state
    // While streaming, Claude renders a button with an aria-label or testid containing "Stop"
    const stopButton = document.querySelector(
      'button[aria-label*="Stop"], button[data-testid*="stop-button"], button[aria-label*="Cancel"]'
    );

    if (stopButton && !isGenerating) {
      isGenerating = true;
      chrome.runtime.sendMessage({ type: 'CLAUDE_STREAM_START' });
    } else if (!stopButton && isGenerating) {
      // Button disappeared -> Response complete
      isGenerating = false;
      chrome.runtime.sendMessage({
        type: 'CLAUDE_STREAM_COMPLETE',
        details: 'Claude finished responding to your prompt.'
      });
    }
  }

  // 3. Attach MutationObserver
  const observer = new MutationObserver(() => {
    inspectClaudeDOM();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // 4. Periodic background keep-alive ping
  setInterval(() => {
    chrome.runtime.sendMessage({ type: 'CLAUDE_HEARTBEAT' }, () => {
      if (chrome.runtime.lastError) {
        // Service worker sleeping; will wake on next trigger
      }
    });
  }, 45000);

  console.log('[Claude Resilience] Content script active and monitoring.');
})();