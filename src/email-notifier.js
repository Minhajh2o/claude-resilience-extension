/**
 * email-notifier.js
 * High-Security Notification Module for Claude Resilience Extension
 * Manifest V3 Service Worker Compatible
 */

class SecureEmailNotifier {
  constructor() {
    // Defense against runaway loops / wallet-draining API abuse
    this.RATE_LIMIT = {
      MAX_EMAILS_PER_HOUR: 15,
      MIN_INTERVAL_SECONDS: 45, // Minimum seconds between two emails
      history: []
    };

    // Allowed status types to reject malicious spoofed actions
    this.ALLOWED_EVENTS = new Set([
      'CLAUDE_TASK_COMPLETED',
      'CLAUDE_RATE_LIMIT_HIT',
      'CLAUDE_SESSION_CRASHED',
      'CLAUDE_PROMPT_WAITING',
      'CLAUDE_HEARTBEAT_TIMEOUT'
    ]);
  }

  /**
   * Sanitizes strings to prevent HTML/XSS injection into emails
   * Safe for background service workers (no DOM access required)
   */
  sanitizeText(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .slice(0, 5000); // Limit length to avoid buffer/payload abuse
  }

  /**
   * Validates if sending is permitted under rate-limiting constraints
   */
  canSend() {
    const now = Date.now();
    const oneHourAgo = now - 3600 * 1000;

    // Filter out records older than 1 hour
    this.RATE_LIMIT.history = this.RATE_LIMIT.history.filter(ts => ts > oneHourAgo);

    if (this.RATE_LIMIT.history.length >= this.RATE_LIMIT.MAX_EMAILS_PER_HOUR) {
      console.warn('[Security] Notification blocked: Exceeded hourly rate limit.');
      return false;
    }

    const lastSent = this.RATE_LIMIT.history[this.RATE_LIMIT.history.length - 1] || 0;
    if ((now - lastSent) < (this.RATE_LIMIT.MIN_INTERVAL_SECONDS * 1000)) {
      console.warn('[Security] Notification throttled: Triggered too quickly.');
      return false;
    }

    return true;
  }

  /**
   * Loads configurations securely from chrome.storage.local
   * Secrets are NEVER hardcoded in source code
   */
  async getConfig() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['emailConfig'], (result) => {
        if (!result.emailConfig) {
          resolve(null);
        } else {
          resolve(result.emailConfig);
        }
      });
    });
  }

  /**
   * Core notification dispatcher
   * @param {Object} payload 
   * @param {string} payload.event - Must be one of ALLOWED_EVENTS
   * @param {string} payload.title - Notification title
   * @param {string} payload.details - Descriptive context (sanitized)
   */
  async notify({ event, title, details }) {
    // 1. Strict Event Validation
    if (!this.ALLOWED_EVENTS.has(event)) {
      console.error(`[Security] Rejected unauthorized event type: ${event}`);
      return { success: false, reason: 'INVALID_EVENT' };
    }

    // 2. Enforce Anti-Spam / Anti-Drain Rate Limit
    if (!this.canSend()) {
      return { success: false, reason: 'RATE_LIMITED' };
    }

    // 3. Load user credentials safely
    const config = await this.getConfig();
    if (!config || !config.apiKey || !config.toEmail) {
      console.error('[EmailNotifier] Missing valid email configuration.');
      return { success: false, reason: 'MISSING_CONFIGURATION' };
    }

    // 4. Sanitize inputs against Prompt/HTML Injection
    const safeTitle = this.sanitizeText(title || `Claude Notification: ${event}`);
    const safeDetails = this.sanitizeText(details || 'No additional details provided.');
    const timestamp = new Date().toISOString();

    // 5. Construct Safe Payload (Default provider: Resend API)
    // You can switch to SendGrid or a self-hosted webhook server
    const emailPayload = {
      from: config.fromEmail || 'Claude Resilience <notifications@resend.dev>',
      to: [config.toEmail],
      subject: `[Claude Alert] ${safeTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #222; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #d97706; margin-top: 0;">Claude Resilience Alert</h2>
          <p><strong>Event:</strong> <code>${this.sanitizeText(event)}</code></p>
          <p><strong>Timestamp:</strong> ${timestamp}</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;">
          <p><strong>Details:</strong></p>
          <pre style="background: #f4f4f5; padding: 12px; border-radius: 4px; white-space: pre-wrap;">${safeDetails}</pre>
          <p style="font-size: 11px; color: #71717a; margin-top: 25px;">
            Sent securely by your Claude Resilience Extension.
          </p>
        </div>
      `
    };

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailPayload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${errorData.message || 'Transmission failed'}`);
      }

      // Record successful dispatch timestamp
      this.RATE_LIMIT.history.push(Date.now());
      console.log(`[EmailNotifier] Alert sent successfully: ${event}`);
      return { success: true };

    } catch (err) {
      // Do not log raw headers or API keys in standard error outputs
      console.error('[EmailNotifier] Failed to send email alert:', err.message);
      return { success: false, error: err.message };
    }
  }
}

// Export for ES6 module environments or attach to self in MV3 service workers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SecureEmailNotifier;
} else {
  self.SecureEmailNotifier = SecureEmailNotifier;
}