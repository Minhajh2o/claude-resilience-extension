/**
 * src/email-notifier.js
 * High-Security Notification Engine for Claude Resilience Extension
 */

export class SecureEmailNotifier {
  constructor() {
    this.RATE_LIMIT = {
      MAX_PER_HOUR: 10,
      MIN_COOLDOWN_SECONDS: 60,
      history: []
    };

    this.VALID_EVENTS = new Set([
      'CLAUDE_TASK_COMPLETED',
      'CLAUDE_RATE_LIMIT_HIT',
      'CLAUDE_NETWORK_ERROR',
      'CLAUDE_HEARTBEAT_TIMEOUT',
      'CLAUDE_QUOTA_RESET',        
      'CLAUDE_AUTO_RESUMED'        
    ]);
  }

  /**
   * Sanitizes all output to prevent HTML or script injection in emails.
   */
  sanitize(input) {
    if (typeof input !== 'string') return '';
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .slice(0, 4000);
  }

  /**
   * Anti-spam and loop protection.
   */
  canSend() {
    const now = Date.now();
    const oneHourAgo = now - 3600 * 1000;
    this.RATE_LIMIT.history = this.RATE_LIMIT.history.filter(ts => ts > oneHourAgo);

    if (this.RATE_LIMIT.history.length >= this.RATE_LIMIT.MAX_PER_HOUR) {
      console.warn('[Security] Notification blocked: Exceeded hourly rate limit.');
      return false;
    }

    const lastSent = this.RATE_LIMIT.history[this.RATE_LIMIT.history.length - 1] || 0;
    if (now - lastSent < this.RATE_LIMIT.MIN_COOLDOWN_SECONDS * 1000) {
      console.warn('[Security] Notification throttled: Minimum cooldown active.');
      return false;
    }

    return true;
  }

  async getCredentials() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['resilienceConfig'], (res) => {
        resolve(res.resilienceConfig || null);
      });
    });
  }

  async sendAlert({ event, title, details }) {
    if (!this.VALID_EVENTS.has(event)) {
      console.error(`[Security] Rejected unauthorized event: ${event}`);
      return { success: false, error: 'INVALID_EVENT' };
    }

    if (!this.canSend()) {
      return { success: false, error: 'RATE_LIMITED' };
    }

    const config = await this.getCredentials();
    if (!config?.apiKey || !config?.toEmail) {
      console.warn('[EmailNotifier] Email notifications not configured in popup.');
      return { success: false, error: 'NOT_CONFIGURED' };
    }

    const safeTitle = this.sanitize(title || `Claude Alert: ${event}`);
    const safeDetails = this.sanitize(details || 'No additional details provided.');
    const timestamp = new Date().toLocaleString();

    const payload = {
      from: 'Claude Resilience <onboarding@resend.dev>',
      to: [config.toEmail],
      subject: `[Claude Resilience] ${safeTitle}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #ea580c; margin-top: 0;">Claude Resilience Alert</h2>
          <p style="margin: 4px 0;"><strong>Event:</strong> <code>${this.sanitize(event)}</code></p>
          <p style="margin: 4px 0;"><strong>Timestamp:</strong> ${timestamp}</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;">
          <p style="font-weight: bold; margin-bottom: 6px;">Status Information:</p>
          <pre style="background: #f8fafc; padding: 12px; border-radius: 6px; white-space: pre-wrap; font-size: 13px; border: 1px solid #cbd5e1;">${safeDetails}</pre>
          <p style="font-size: 11px; color: #94a3b8; margin-top: 20px;">
            Sent automatically by Claude Resilience Extension.
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
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${errorData.message || 'API request rejected'}`);
      }

      this.RATE_LIMIT.history.push(Date.now());
      console.log(`[EmailNotifier] Alert delivered successfully: ${event}`);
      return { success: true };
    } catch (err) {
      console.error('[EmailNotifier] Delivery failed:', err.message);
      return { success: false, error: err.message };
    }
  }
}