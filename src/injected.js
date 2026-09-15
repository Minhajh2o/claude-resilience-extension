/**
 * Injected Script - Runs in page context
 * Monitors Claude.ai React app for rate limits and captures conversations
 */

console.log('[Claude Resilience] Injected script running');

// Global monitoring state
const monitoringState = {
  isMonitoring: false,
  lastMessageCount: 0,
  rateLimitDetected: false,
  conversationId: null,
  conversationTitle: null
};

/**
 * Start monitoring for rate limits and conversation changes
 */
function startMonitoring() {
  if (monitoringState.isMonitoring) return;
  monitoringState.isMonitoring = true;

  console.log('[Claude Resilience] Started monitoring claude.ai');

  // Monitor DOM changes
  const observer = new MutationObserver(() => {
    checkForRateLimit();
    captureConversationState();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  // Also check periodically
  setInterval(() => {
    checkForRateLimit();
    captureConversationState();
  }, 2000);

  // Initial check
  checkForRateLimit();
  captureConversationState();
}

/**
 * Check for rate limit messages
 */
function checkForRateLimit() {
  // Look for error messages that indicate rate limiting
  const errorPatterns = [
    /rate limit/i,
    /too many requests/i,
    /token limit/i,
    /usage limit/i,
    /please try again/i,
    /wait before/i,
    /temporarily unavailable/i,
    /quota exceeded/i
  ];

  const allText = document.body.innerText;
  
  for (const pattern of errorPatterns) {
    if (pattern.test(allText) && !monitoringState.rateLimitDetected) {
      // Found rate limit message
      console.log('[Claude Resilience] Rate limit detected!');
      
      const retryAfter = extractRetryAfter(allText);
      
      window.postMessage({
        type: 'CLAUDE_RATE_LIMIT_DETECTED',
        payload: {
          conversationId: monitoringState.conversationId,
          conversationTitle: monitoringState.conversationTitle,
          messages: getConversationMessages(),
          lastMessage: getLastMessage(),
          retryAfter: retryAfter,
          detectedAt: new Date().toISOString()
        }
      }, '*');

      monitoringState.rateLimitDetected = true;
      break;
    }
  }

  // Check if rate limit is no longer visible (tokens available)
  if (monitoringState.rateLimitDetected) {
    const stillErrorVisible = errorPatterns.some(p => p.test(allText));
    if (!stillErrorVisible) {
      console.log('[Claude Resilience] Rate limit cleared - tokens available!');
      monitoringState.rateLimitDetected = false;

      window.postMessage({
        type: 'CLAUDE_TOKENS_AVAILABLE',
        payload: {
          conversationId: monitoringState.conversationId,
          availableAt: new Date().toISOString()
        }
      }, '*');
    }
  }
}

/**
 * Capture current conversation state
 */
function captureConversationState() {
  // Get conversation title from page
  const titleElement = document.querySelector('[class*="text-xl"], [class*="text-lg"], h1');
  if (titleElement) {
    monitoringState.conversationTitle = titleElement.innerText?.substring(0, 100);
  }

  // Get or generate conversation ID
  const urlMatch = window.location.pathname.match(/\/c\/([a-z0-9-]+)/i);
  if (urlMatch) {
    monitoringState.conversationId = urlMatch[1];
  }

  // Get message count to detect changes
  const messageElements = document.querySelectorAll('[class*="message"], [role="article"]');
  const currentCount = messageElements.length;

  if (currentCount !== monitoringState.lastMessageCount) {
    monitoringState.lastMessageCount = currentCount;

    // Conversation has been updated
    window.postMessage({
      type: 'CLAUDE_CONVERSATION_UPDATE',
      payload: {
        conversationId: monitoringState.conversationId,
        conversationTitle: monitoringState.conversationTitle,
        messages: getConversationMessages(),
        messageCount: currentCount
      }
    }, '*');
  }
}

/**
 * Extract retry-after time from error message
 */
function extractRetryAfter(text) {
  const matches = text.match(/(\d+)\s*(minute|second|hour)s?/i);
  if (matches) {
    return `${matches[1]} ${matches[2]}s`;
  }
  return 'unknown';
}

/**
 * Get all messages from conversation
 */
function getConversationMessages() {
  const messages = [];
  
  // Try multiple selectors to find message elements
  const messageSelectors = [
    '[data-testid="message"]',
    '[class*="message"]',
    '[role="article"]',
    '.prose',
    '[class*="bubble"]'
  ];

  for (const selector of messageSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      elements.forEach((el) => {
        const text = el.innerText?.trim();
        const isUser = el.className?.includes('user') || el.className?.includes('prompt');
        
        if (text && text.length > 0) {
          messages.push({
            role: isUser ? 'user' : 'assistant',
            content: text.substring(0, 5000) // Limit content size
          });
        }
      });
      break; // Stop if we found messages
    }
  }

  return messages;
}

/**
 * Get the last message (most recent)
 */
function getLastMessage() {
  const messages = getConversationMessages();
  return messages.length > 0 ? messages[messages.length - 1] : null;
}

/**
 * Detect when page is ready and start monitoring
 */
function waitForPageReady() {
  // Check if Claude.ai UI is loaded
  const isReady = () => {
    return document.querySelector('[class*="chat"], [role="main"]') !== null;
  };

  if (isReady()) {
    startMonitoring();
  } else {
    setTimeout(waitForPageReady, 1000);
  }
}

// Start waiting for page to be ready
waitForPageReady();

console.log('[Claude Resilience] Injected script initialized');
