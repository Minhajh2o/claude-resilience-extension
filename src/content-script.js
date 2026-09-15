/**
 * Content Script - Runs on claude.ai
 * Monitors for rate limits, saves conversations, and detects availability
 */

console.log('[Claude Resilience] Content script loaded');

// Listen for messages from injected script
window.addEventListener('message', async (event) => {
  // Only accept messages from our injected script
  if (event.source !== window) return;

  if (event.data.type === 'CLAUDE_RATE_LIMIT_DETECTED') {
    console.log('[Claude Resilience] Rate limit detected!');
    handleRateLimit(event.data.payload);
  }

  if (event.data.type === 'CLAUDE_CONVERSATION_UPDATE') {
    console.log('[Claude Resilience] Conversation updated');
    saveConversation(event.data.payload);
  }

  if (event.data.type === 'CLAUDE_TOKENS_AVAILABLE') {
    console.log('[Claude Resilience] Tokens available detected!');
    handleTokensAvailable(event.data.payload);
  }
});

/**
 * Handle rate limit detection
 */
async function handleRateLimit(data) {
  const checkpoint = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    conversationId: data.conversationId,
    conversationTitle: data.conversationTitle,
    messages: data.messages,
    lastMessage: data.lastMessage,
    status: 'rate_limited',
    retryAfter: data.retryAfter || 'unknown'
  };

  // Save to local storage
  await saveCheckpoint(checkpoint);

  // Send to background script for monitoring
  chrome.runtime.sendMessage({
    type: 'RATE_LIMIT_HIT',
    payload: checkpoint
  });

  console.log('[Claude Resilience] Checkpoint saved:', checkpoint.id);
}

/**
 * Handle conversation update
 */
async function saveConversation(data) {
  const conversation = {
    conversationId: data.conversationId,
    conversationTitle: data.conversationTitle,
    messages: data.messages,
    lastUpdated: new Date().toISOString()
  };

  // Save to local storage
  chrome.storage.local.get('conversations', (result) => {
    const conversations = result.conversations || {};
    conversations[data.conversationId] = conversation;
    chrome.storage.local.set({ conversations });
  });
}

/**
 * Handle tokens available (from monitoring)
 */
async function handleTokensAvailable(data) {
  chrome.runtime.sendMessage({
    type: 'TOKENS_AVAILABLE',
    payload: data
  });
}

/**
 * Save checkpoint to local storage
 */
async function saveCheckpoint(checkpoint) {
  return new Promise((resolve) => {
    chrome.storage.local.get('checkpoints', (result) => {
      const checkpoints = result.checkpoints || {};
      checkpoints[checkpoint.id] = checkpoint;
      chrome.storage.local.set({ checkpoints }, resolve);
    });
  });
}

/**
 * Generate unique ID
 */
function generateId() {
  return `checkpoint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Inject monitoring script into page
 */
function injectMonitoringScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('src/injected.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

// Inject the monitoring script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectMonitoringScript);
} else {
  injectMonitoringScript();
}
