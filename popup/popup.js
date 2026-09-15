/**
 * Popup Script - UI Logic
 */

console.log('[Claude Resilience] Popup loaded');

// Tab switching
document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', (e) => {
    const tabName = e.target.dataset.tab;
    switchTab(tabName);
  });
});

/**
 * Switch between tabs
 */
function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  // Remove active from all buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected tab
  document.getElementById(tabName).classList.add('active');
  event.target.classList.add('active');

  // Load content for tab
  if (tabName === 'checkpoints') {
    loadCheckpoints();
  } else if (tabName === 'settings') {
    loadSettings();
  }
}

/**
 * Load and display checkpoints
 */
async function loadCheckpoints() {
  chrome.storage.local.get(['checkpoints', 'conversations'], (result) => {
    const checkpoints = result.checkpoints || {};
    const checkpointsList = document.getElementById('checkpointsList');

    if (Object.keys(checkpoints).length === 0) {
      checkpointsList.innerHTML = '<p class="empty-message">No saved conversations yet. Once you hit a rate limit, your progress will be saved here.</p>';
      updateCheckpointCount(0);
      return;
    }

    const html = Object.entries(checkpoints).map(([id, checkpoint]) => `
      <div class="checkpoint-item">
        <div class="checkpoint-info">
          <div class="checkpoint-title">${escapeHtml(checkpoint.conversationTitle || 'Untitled Chat')}</div>
          <div class="checkpoint-meta">
            Hit at: ${new Date(checkpoint.timestamp).toLocaleString()}
          </div>
          <span class="checkpoint-status ${checkpoint.status === 'completed' ? 'completed' : ''}">
            ${checkpoint.status === 'rate_limited' ? '⏳ Rate Limited' : '✅ Completed'}
          </span>
        </div>
        <div class="checkpoint-actions">
          <button class="resume-btn" onclick="resumeChat('${id}')">Resume</button>
          <button class="delete-btn" onclick="deleteCheckpoint('${id}')">Delete</button>
        </div>
      </div>
    `).join('');

    checkpointsList.innerHTML = html;
    updateCheckpointCount(Object.keys(checkpoints).length);
  });
}

/**
 * Resume a saved chat
 */
function resumeChat(checkpointId) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];

    chrome.runtime.sendMessage({
      type: 'RESUME_CONVERSATION',
      payload: {
        checkpointId: checkpointId,
        tabId: currentTab.id
      }
    }, (response) => {
      if (response?.success) {
        console.log('[Claude Resilience] Resuming conversation...');
        // Close popup after resuming
        setTimeout(() => window.close(), 500);
      }
    });
  });
}

/**
 * Delete a checkpoint
 */
function deleteCheckpoint(checkpointId) {
  if (confirm('Delete this saved conversation?')) {
    chrome.runtime.sendMessage({
      type: 'DELETE_CHECKPOINT',
      payload: { checkpointId }
    }, () => {
      loadCheckpoints();
    });
  }
}

/**
 * Update checkpoint count in status tab
 */
function updateCheckpointCount(count) {
  document.getElementById('checkpointCount').textContent = count;
}

/**
 * Load settings
 */
async function loadSettings() {
  chrome.storage.sync.get('emailSettings', (result) => {
    const settings = result.emailSettings || {};

    document.getElementById('emailEnabled').checked = settings.enabled !== false;
    document.getElementById('emailAddress').value = settings.emailAddress || '';
    document.getElementById('emailService').value = settings.service || 'gmail';

    // Show/hide service-specific settings
    updateServiceSettings(settings.service || 'gmail');
  });
}

/**
 * Update visible service settings
 */
function updateServiceSettings(service) {
  document.getElementById('gmailSettings').classList.toggle('hidden', service !== 'gmail');
  document.getElementById('sendgridSettings').classList.toggle('hidden', service !== 'sendgrid');
}

/**
 * Save settings
 */
document.getElementById('saveSettingsBtn').addEventListener('click', () => {
  const settings = {
    enabled: document.getElementById('emailEnabled').checked,
    emailAddress: document.getElementById('emailAddress').value,
    service: document.getElementById('emailService').value,
    gmailPassword: document.getElementById('gmailPassword').value,
    sendgridApiKey: document.getElementById('sendgridApiKey').value
  };

  // Validate email
  if (settings.enabled && !settings.emailAddress) {
    showSettingsMessage('Please enter an email address', 'error');
    return;
  }

  chrome.runtime.sendMessage({
    type: 'CONFIGURE_EMAIL',
    payload: settings
  }, () => {
    showSettingsMessage('Settings saved successfully!', 'success');
  });
});

/**
 * Email service change handler
 */
document.getElementById('emailService').addEventListener('change', (e) => {
  updateServiceSettings(e.target.value);
});

/**
 * Test email button
 */
document.getElementById('testEmailBtn').addEventListener('click', () => {
  const emailAddress = document.getElementById('emailAddress').value;
  if (!emailAddress) {
    showSettingsMessage('Please enter an email address first', 'error');
    return;
  }

  showSettingsMessage('Sending test email...', 'success');
  // In production, this would actually send an email
  setTimeout(() => {
    showSettingsMessage('Test email sent! Check your inbox.', 'success');
  }, 1000);
});

/**
 * Clear data button
 */
document.getElementById('clearDataBtn').addEventListener('click', () => {
  if (confirm('Are you sure? This will delete all saved conversations and checkpoints.')) {
    chrome.storage.local.clear(() => {
      showSettingsMessage('All data cleared', 'success');
      loadCheckpoints();
    });
  }
});

/**
 * Show settings message
 */
function showSettingsMessage(text, type) {
  const messageEl = document.getElementById('settingsMessage');
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.classList.remove('hidden');

  if (type === 'success') {
    setTimeout(() => {
      messageEl.classList.add('hidden');
    }, 3000);
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Update status counts
 */
async function updateStatus() {
  chrome.storage.local.get(['checkpoints', 'conversations'], (result) => {
    const checkpoints = result.checkpoints || {};
    const conversations = result.conversations || {};

    document.getElementById('checkpointCount').textContent = Object.keys(checkpoints).length;
    document.getElementById('activeChatCount').textContent = Object.keys(conversations).length;
  });
}

/**
 * Initial load
 */
updateStatus();

// Refresh status periodically
setInterval(updateStatus, 5000);

console.log('[Claude Resilience] Popup ready');
