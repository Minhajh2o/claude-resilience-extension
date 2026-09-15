document.addEventListener('DOMContentLoaded', () => {
  const toEmailInput = document.getElementById('toEmail');
  const apiKeyInput = document.getElementById('apiKey');
  const saveBtn = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');
  const metricsDiv = document.getElementById('metrics');

  // Load saved credentials
  chrome.storage.local.get(['resilienceConfig'], (res) => {
    if (res.resilienceConfig) {
      toEmailInput.value = res.resilienceConfig.toEmail || '';
      apiKeyInput.value = res.resilienceConfig.apiKey || '';
    }
  });

  // Query background worker for live status
  chrome.runtime.sendMessage({ type: 'GET_STATUS_METRICS' }, (response) => {
    if (response) {
      metricsDiv.textContent = `Active Claude Tabs: ${response.activeTabsCount} | Alerts Sent: ${response.stats?.alertsSent || 0}`;
    } else {
      metricsDiv.textContent = 'Active Claude Tabs: 0 (No active tab)';
    }
  });

  saveBtn.addEventListener('click', () => {
    const toEmail = toEmailInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!toEmail || !apiKey) {
      statusDiv.style.color = '#dc2626';
      statusDiv.textContent = 'Both fields are required.';
      return;
    }

    chrome.storage.local.set({
      resilienceConfig: { toEmail, apiKey }
    }, () => {
      statusDiv.style.color = '#16a34a';
      statusDiv.textContent = 'Settings saved successfully!';
      setTimeout(() => { statusDiv.textContent = ''; }, 2500);
    });
  });
});