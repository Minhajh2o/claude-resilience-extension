/**
 * Background Service Worker
 * Manages checkpoint storage, monitoring, and email notifications
 */

console.log('[Claude Resilience] Background service worker loaded');

// Global monitoring state
const monitoringState = {
  activeMonitors: new Map(), // conversationId -> monitor info
  emailNotifications: true
};

/**
 * Listen for messages from content script
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Claude Resilience] Message received:', request.type);

  if (request.type === 'RATE_LIMIT_HIT') {
    handleRateLimitHit(request.payload);
    sendResponse({ success: true });
  }

  if (request.type === 'TOKENS_AVAILABLE') {
    handleTokensAvailable(request.payload);
    sendResponse({ success: true });
  }

  if (request.type === 'GET_CHECKPOINTS') {
    chrome.storage.local.get('checkpoints', (result) => {
      sendResponse({ checkpoints: result.checkpoints || {} });
    });
    return true; // Async response
  }

  if (request.type === 'GET_CONVERSATIONS') {
    chrome.storage.local.get('conversations', (result) => {
      sendResponse({ conversations: result.conversations || {} });
    });
    return true; // Async response
  }

  if (request.type === 'RESUME_CONVERSATION') {
    resumeConversation(request.payload);
    sendResponse({ success: true });
  }

  if (request.type === 'DELETE_CHECKPOINT') {
    deleteCheckpoint(request.payload.checkpointId);
    sendResponse({ success: true });
  }

  if (request.type === 'CONFIGURE_EMAIL') {
    configureEmailSettings(request.payload);
    sendResponse({ success: true });
  }
});

/**
 * Handle rate limit detection
 */
async function handleRateLimitHit(checkpoint) {
  console.log('[Claude Resilience] Rate limit hit. Starting monitoring...');

  // Save checkpoint
  await new Promise((resolve) => {
    chrome.storage.local.get('checkpoints', (result) => {
      const checkpoints = result.checkpoints || {};
      checkpoints[checkpoint.id] = checkpoint;
      chrome.storage.local.set({ checkpoints }, resolve);
    });
  });

  // Update badge
  chrome.action.setBadgeText({ text: '⏳' });
  chrome.action.setBadgeBackgroundColor({ color: '#FFA500' });

  // Start monitoring for token availability
  startMonitoring(checkpoint);

  // Send email notification
  if (monitoringState.emailNotifications) {
    await sendEmail({
      subject: `⏳ Claude Hit Rate Limit: ${checkpoint.conversationTitle}`,
      body: `Your Claude conversation hit the free tier rate limit.
      
Conversation: ${checkpoint.conversationTitle || 'Untitled'}
Time: ${new Date(checkpoint.timestamp).toLocaleString()}

Your progress has been auto-saved. You'll receive another email when tokens are available.`,
      checkpointId: checkpoint.id
    });
  }

  console.log('[Claude Resilience] Checkpoint saved and monitoring started');
}

/**
 * Start monitoring for token availability
 */
function startMonitoring(checkpoint) {
  // Don't start multiple monitors for same conversation
  if (monitoringState.activeMonitors.has(checkpoint.id)) {
    console.log('[Claude Resilience] Monitor already active for this checkpoint');
    return;
  }

  const maxWaitTime = 24 * 60 * 60 * 1000; // 24 hours
  const startTime = Date.now();
  let lastNotificationTime = startTime;
  const notificationInterval = 4 * 60 * 60 * 1000; // Notify every 4 hours

  const monitor = setInterval(async () => {
    const elapsedTime = Date.now() - startTime;

    // Check if max wait time exceeded
    if (elapsedTime > maxWaitTime) {
      console.log('[Claude Resilience] Max wait time exceeded, stopping monitor');
      
      clearInterval(monitor);
      monitoringState.activeMonitors.delete(checkpoint.id);
      
      if (monitoringState.emailNotifications) {
        await sendEmail({
          subject: `❌ Token Wait Timeout: ${checkpoint.conversationTitle}`,
          body: `Your Claude conversation monitoring stopped after waiting 24 hours.

Conversation: ${checkpoint.conversationTitle || 'Untitled'}

Your progress was saved. You can resume manually from the extension popup.`,
          checkpointId: checkpoint.id
        });
      }

      chrome.action.setBadgeText({ text: '❌' });
      return;
    }

    // Send periodic "still waiting" notification
    if (elapsedTime - lastNotificationTime > notificationInterval) {
      if (monitoringState.emailNotifications) {
        const hoursWaited = Math.round(elapsedTime / (60 * 60 * 1000));
        await sendEmail({
          subject: `⏳ Still Waiting: ${checkpoint.conversationTitle} (${hoursWaited}h)`,
          body: `Still waiting for tokens to become available...

Conversation: ${checkpoint.conversationTitle || 'Untitled'}
Time Waiting: ${hoursWaited} hours

The extension is monitoring and will notify you when tokens are available.`
        });
      }
      lastNotificationTime = Date.now();
    }

    console.log(`[Claude Resilience] Monitoring checkpoint ${checkpoint.id.substring(0, 20)}...`);
  }, 30000); // Check every 30 seconds

  monitoringState.activeMonitors.set(checkpoint.id, {
    monitor,
    startTime,
    checkpoint
  });
}

/**
 * Handle tokens availability detection
 */
async function handleTokensAvailable(data) {
  console.log('[Claude Resilience] Tokens available detected!');

  // Find the checkpoint we were monitoring
  const checkpointId = data.checkpointId;
  const monitorInfo = monitoringState.activeMonitors.get(checkpointId);

  if (monitorInfo) {
    // Stop monitoring
    clearInterval(monitorInfo.monitor);
    monitoringState.activeMonitors.delete(checkpointId);

    const checkpoint = monitorInfo.checkpoint;
    const waitedTime = formatWaitTime(Date.now() - monitorInfo.startTime);

    // Send email notification
    if (monitoringState.emailNotifications) {
      await sendEmail({
        subject: `✅ Claude Tokens Available: ${checkpoint.conversationTitle}`,
        body: `Good news! Your free tier tokens are available again.

Conversation: ${checkpoint.conversationTitle || 'Untitled'}
Waited: ${waitedTime}

You can resume your conversation now. Click the extension popup to resume.`,
        checkpointId: checkpointId,
        action: 'resume'
      });
    }

    // Update badge
    chrome.action.setBadgeText({ text: '✅' });
    chrome.action.setBadgeBackgroundColor({ color: '#00AA00' });

    console.log('[Claude Resilience] Tokens available! Email sent.');
  }
}

/**
 * Resume a saved conversation
 */
async function resumeConversation(payload) {
  const { checkpointId, tabId } = payload;

  // Get checkpoint
  const checkpoint = await new Promise((resolve) => {
    chrome.storage.local.get('checkpoints', (result) => {
      const checkpoint = (result.checkpoints || {})[checkpointId];
      resolve(checkpoint);
    });
  });

  if (!checkpoint) {
    console.error('[Claude Resilience] Checkpoint not found:', checkpointId);
    return;
  }

  console.log('[Claude Resilience] Resuming conversation:', checkpoint.conversationId);

  // Navigate to conversation
  if (checkpoint.conversationId) {
    const url = `https://claude.ai/chat/${checkpoint.conversationId}`;
    chrome.tabs.update(tabId, { url });
  }

  // Mark as resumed
  checkpoint.status = 'resumed';
  checkpoint.resumedAt = new Date().toISOString();

  await new Promise((resolve) => {
    chrome.storage.local.get('checkpoints', (result) => {
      const checkpoints = result.checkpoints || {};
      checkpoints[checkpointId] = checkpoint;
      chrome.storage.local.set({ checkpoints }, resolve);
    });
  });
}

/**
 * Delete a checkpoint
 */
async function deleteCheckpoint(checkpointId) {
  return new Promise((resolve) => {
    chrome.storage.local.get('checkpoints', (result) => {
      const checkpoints = result.checkpoints || {};
      delete checkpoints[checkpointId];
      chrome.storage.local.set({ checkpoints }, resolve);
    });
  });
}

/**
 * Send email notification
 */
async function sendEmail(options) {
  // Get email settings from storage
  const settings = await new Promise((resolve) => {
    chrome.storage.sync.get('emailSettings', (result) => {
      resolve(result.emailSettings || {});
    });
  });

  if (!settings.enabled || !settings.emailAddress) {
    console.log('[Claude Resilience] Email notifications not configured');
    return;
  }

  // For now, store the email in storage for the user to review
  // In production, this would call a backend service to send actual emails
  await new Promise((resolve) => {
    chrome.storage.local.get('sentEmails', (result) => {
      const emails = result.sentEmails || [];
      emails.push({
        id: `email-${Date.now()}`,
        timestamp: new Date().toISOString(),
        subject: options.subject,
        body: options.body,
        to: settings.emailAddress,
        sent: false // Will be updated when actually sent
      });
      chrome.storage.local.set({ sentEmails: emails }, resolve);
    });
  });

  console.log('[Claude Resilience] Email queued:', options.subject);
}

/**
 * Configure email settings
 */
async function configureEmailSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ emailSettings: settings }, resolve);
  });
}

/**
 * Format wait time nicely
 */
function formatWaitTime(ms) {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / 60000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

console.log('[Claude Resilience] Background service worker ready');
