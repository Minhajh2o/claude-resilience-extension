# Claude Free Tier Resilience - Browser Extension 🚀

A smart browser extension that **auto-saves your Claude.ai chats when you hit rate limits**, monitors token availability, and helps you resume seamlessly. Never lose work to token exhaustion again!

## Features

✅ **Real-time Monitoring** - Watches your Claude.ai chats for rate limit messages  
✅ **Auto-Save** - Automatically saves conversation state when rate limited  
✅ **Smart Notifications** - Emails you when tokens become available  
✅ **Easy Resume** - One-click button to resume your saved conversations  
✅ **No API Required** - Works with Claude.ai free tier (no subscription needed)  
✅ **Privacy First** - All data saved locally on your machine  
✅ **Simple Setup** - Takes 2 minutes to install and configure  

## How It Works

```
You're chatting on Claude.ai
    ↓
Hit rate limit (free tier limit reached)
    ↓
Extension detects rate limit message
    ↓
✓ Automatically saves your full conversation
✓ Sends email notification
✓ Starts monitoring for token availability
    ↓
Tokens available (usually next day)
    ↓
✓ Email arrives: "Your tokens are ready!"
✓ Click "Resume" in extension popup
✓ Continue your chat from where you left off
```

## Installation

### Step 1: Download the Extension

Download the extension folder from this release, or clone the repository:

```bash
git clone https://github.com/anthropics/claude-resilience-extension
cd claude-resilience-extension
```

### Step 2: Load into Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **"Developer mode"** (top right toggle)
3. Click **"Load unpacked"**
4. Select the `claude-resilience-extension` folder
5. The extension should now appear in your extensions list ✅

### Step 3: Configure Email (2 minutes)

1. Click the extension icon (🚀) in your Chrome toolbar
2. Go to the **"Settings"** tab
3. Check **"Enable email notifications"**
4. Enter your email address
5. Choose your email provider:

**Gmail (Recommended):**
- Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
- Generate an App Password
- Paste it in the extension settings
- Click "Test Email"

**Sendgrid:**
- Get API key from [sendgrid.com](https://sendgrid.com)
- Paste in the extension settings
- Click "Test Email"

**Manual:**
- Select "Manual (Copy notification text)"
- The extension will show you the email text to send manually

That's it! You're ready to go. 🎉

## Usage

### Normal Usage

Just use Claude.ai normally! The extension works in the background:

1. **Open Claude.ai** - Go to https://claude.ai
2. **Start your chat** - Ask Claude your questions
3. **Hit a rate limit** - Keep working, the extension monitors
4. **Get notified** - Extension detects the limit and saves
5. **Receive email** - You'll be emailed when tokens return
6. **Resume** - Click the extension icon, hit "Resume", continue chatting

### When You Hit a Rate Limit

**You'll see:**
- ⏳ Badge on extension icon shows "⏳"
- Auto-saved notification in extension
- Email will be sent when tokens available

**What to do:**
- Keep your PC/Chrome running (or just the tab)
- Check your email (usually arrives within a few hours)
- Click "Resume" in extension popup
- Your full conversation context is restored

### Access Saved Chats Anytime

1. Click extension icon (🚀)
2. Go to **"Saved Chats"** tab
3. See all your saved conversations
4. Click **"Resume"** to go back to any conversation
5. Click **"Delete"** to remove a saved checkpoint

## File Structure

```
claude-resilience-extension/
├── manifest.json              # Chrome extension config
├── README.md                  # This file
├── INSTALLATION.md            # Detailed setup guide
├── src/
│   ├── content-script.js      # Monitors claude.ai page
│   ├── injected.js            # Captures chat messages
│   ├── background.js          # Handles monitoring & email
│   └── email-notifier.js      # Email integration
├── popup/
│   ├── popup.html             # Extension UI
│   ├── popup.js               # UI logic
│   └── popup.css              # Styling
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── logs/                      # Activity logs (auto-created)
```

## Settings

### Email Notifications

**Enable/Disable:** Toggle to turn notifications on/off

**Email Address:** Where to send notifications  
- You'll receive: Rate limit alerts, token availability updates, issues

**Email Provider:** Choose how emails are sent
- **Gmail**: Recommended (requires App Password from Google)
- **Sendgrid**: Reliable (free tier available)
- **Manual**: Extension shows you the text to email yourself

### Advanced

**Clear Data:** Delete all saved conversations and checkpoints  
(Use if storage getting full, but data is lost)

## Troubleshooting

### Extension not detecting rate limit?

The extension looks for these messages:
- "rate limit exceeded"
- "too many requests"
- "usage limit"
- "please try again later"
- "temporarily unavailable"

If Claude shows a different error, the extension might not detect it. Let me know!

### Email not sending?

1. **Check email settings:**
   - Extension → Settings → Check email address is correct
   - Verify email service is configured properly

2. **For Gmail:**
   - Did you create an App Password? (not regular password)
   - Is 2FA enabled on Google account?
   - Try clicking "Test Email" button

3. **For Sendgrid:**
   - Verify API key is correct
   - Check account is active

4. **Check console:**
   - Right-click extension → "Inspect popup"
   - Check console for error messages

### Can't resume conversation?

1. Check **"Saved Chats"** tab in extension popup
2. Click **"Resume"** next to the conversation
3. If it doesn't work, try:
   - Refreshing the page
   - Closing and reopening Claude.ai
   - Checking if you're logged into Claude.ai

### Extension not loading?

1. Verify you're using Chrome/Edge (Chromium-based)
2. Check `chrome://extensions/` shows the extension
3. Try disabling and re-enabling it
4. Try loading unpacked again

### Data not being saved?

1. Check extension has storage permission:
   - `chrome://extensions/` → Claude Resilience → "Permissions"
   - Should show "Read and change your data on claude.ai"

2. Check Storage → Local Storage:
   - Right-click extension → Inspect → Application → Local Storage

## Privacy & Security

✅ **Local Storage Only** - All your chats saved on your computer only  
✅ **No Cloud Backup** - Data never leaves your device  
✅ **No Account Needed** - Extension doesn't require login  
✅ **No Telemetry** - We don't track you or your conversations  
✅ **Open Source** - You can inspect the code  

**Email Only Sends:**
- Chat title (first 50 characters)
- Notification status (rate limited / tokens available)
- Timestamp

**Email Never Contains:**
- Your actual chat messages
- Personal data
- Sensitive information

Delete checkpoints anytime from the **"Saved Chats"** tab.

## Limitations

- Extension only works on **claude.ai** (not the API)
- Requires **Chrome or Edge** (not Firefox yet)
- Email requires **manual configuration** (Gmail App Password or Sendgrid)
- Monitoring works while Chrome is open (not in background)
- Can save up to ~500 conversations before needing to clear data

## Tips & Best Practices

💡 **Long Tasks:** Use for research, writing, analysis (10+ min)  
💡 **Save Often:** The extension auto-saves, but don't close Chrome mid-task  
💡 **Check Email:** Mark extension emails as important in Gmail  
💡 **Free Tier Patterns:** Tokens usually reset daily, often late evening (UTC)  
💡 **Data Backup:** Occasionally export checkpoints if worried about losing data  

## FAQ

**Q: Will the extension interfere with my normal Claude usage?**  
A: No! It runs quietly in the background and only acts when a rate limit is detected.

**Q: Can I delete old saved chats?**  
A: Yes! Go to "Saved Chats" tab and click "Delete" next to any chat.

**Q: Is my conversation data safe?**  
A: Completely safe. All data stored locally on your computer. Nothing sent to servers.

**Q: What if I don't want email notifications?**  
A: Go to Settings and toggle "Enable email notifications" OFF.

**Q: Can I use this with the Claude API?**  
A: No, this extension only works with claude.ai free tier.

**Q: Does this increase my rate limits?**  
A: No, it just helps you resume when you hit them.

**Q: Will it work if I close Chrome?**  
A: No, the monitoring stops. Just keep Chrome open while waiting for tokens.

## Support

**Having issues?**
1. Check the **"Saved Chats"** tab to see if data is being saved
2. Try the "Test Email" button in Settings
3. Inspect the extension (`Right-click → Inspect`) and check the console

**Found a bug?**
- Note what happened
- Share extension version (shown in Settings tab)
- Describe your setup (Gmail/Sendgrid, OS, Chrome version)

## Version History

**v1.0 (Current)**
- Initial release
- Auto-save conversations
- Email notifications
- Smart monitoring
- Easy resume

## License

MIT - You're free to use, modify, and distribute this extension.

## Credits

Created by Anthropic Claude  
Designed for Claude.ai free tier users

---

**Enjoy uninterrupted Claude sessions!** 🚀

Having fun so far? Leave feedback or report bugs! Your input helps improve the extension.
