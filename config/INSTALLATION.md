# Installation Guide - Claude Free Tier Resilience Extension

Follow these steps to install and configure the extension. Should take **5 minutes total**.

## Step 1: Install the Extension (2 minutes)

### On Windows/Mac/Linux:

1. **Download the extension files**
   - Download the folder from GitHub or unzip the release
   - Remember where you saved it

2. **Open Chrome Extensions Page**
   - Open Google Chrome
   - Type in address bar: `chrome://extensions/`
   - Or: Menu → More tools → Extensions

3. **Enable Developer Mode**
   - Top right corner, toggle **"Developer mode"** ON
   - You should see new buttons appear

4. **Load the Extension**
   - Click **"Load unpacked"**
   - Navigate to the `claude-resilience-extension` folder
   - Click **"Select Folder"**

5. **Verify Installation**
   - You should see "Claude Free Tier Resilience" in the extensions list
   - Look for the 🚀 icon in your toolbar (top right)
   - You're done with installation! ✅

## Step 2: Configure Email (3 minutes)

### Choose ONE email provider:

#### Option A: Gmail (Recommended - Easiest)

1. **Enable 2-Factor Authentication on Google**
   - Go to [myaccount.google.com/security](https://myaccount.google.com/security)
   - Find "2-Step Verification"
   - Click "Enable" and follow prompts
   - (Skip if you already have 2FA enabled)

2. **Generate App Password**
   - Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - Select "Mail" in first dropdown
   - Select "Windows Computer" (or your device) in second dropdown
   - Click "Generate"
   - Google shows a 16-character password with spaces: `xxxx xxxx xxxx xxxx`

3. **Configure Extension**
   - Click the extension icon (🚀)
   - Go to **"Settings"** tab
   - Check ✓ "Enable email notifications"
   - Enter your email: `your-email@gmail.com`
   - Select "Gmail (Recommended)"
   - Paste the 16-character app password
   - Click **"Test Email"**
   - Check your Gmail inbox for test email ✅

#### Option B: Sendgrid (Reliable)

1. **Create Sendgrid Account**
   - Go to [sendgrid.com](https://sendgrid.com)
   - Click "Start Free"
   - Fill in your details and create account

2. **Generate API Key**
   - Login to Sendgrid
   - Go to Settings → API Keys
   - Click "Create API Key"
   - Copy the key (starts with `SG.`)

3. **Configure Extension**
   - Click extension icon (🚀)
   - Go to **"Settings"** tab
   - Check ✓ "Enable email notifications"
   - Enter your email address
   - Select "Sendgrid"
   - Paste your API key
   - Click **"Test Email"**
   - Verify email received ✅

#### Option C: Manual (No Setup)

1. **Configure Extension**
   - Click extension icon (🚀)
   - Go to **"Settings"** tab
   - Check ✓ "Enable email notifications"
   - Select "Manual (Copy notification text)"
   - Save settings

2. **When Rate Limit Hits**
   - Extension shows notification
   - You manually copy the text
   - Paste it in an email to yourself
   - (Less convenient but works!)

### Save Settings

- After configuring, click **"Save Settings"**
- Should show "Settings saved successfully!" ✓

## Step 3: Test It (Optional but Recommended)

### Verify Everything Works:

1. **Click extension icon** (🚀)
2. **Go to "Settings" tab**
3. **Click "Test Email"**
4. **Check your email inbox** within 1 minute

If test email arrives:
- ✅ Email configuration is working perfectly
- You're all set!

If test email doesn't arrive:
- Check spam/junk folder
- Verify email address is correct
- For Gmail: did you use the App Password?
- For Sendgrid: is API key correct?
- Try clicking "Test Email" again

## Step 4: Start Using It

1. **Go to claude.ai** - https://claude.ai
2. **Start chatting** - Ask Claude anything
3. **Extension monitors quietly** in background
4. **If rate limit hits:**
   - Extension auto-saves your chat
   - Sends you an email
   - Starts monitoring for tokens
5. **When tokens available:**
   - You'll get an email
   - Click "Resume" in extension
   - Continue your conversation

That's it! You're protected. 🎉

## Troubleshooting Installation

### Extension not appearing in toolbar?

- Go to `chrome://extensions/`
- Find "Claude Free Tier Resilience"
- Look for the pin icon on the right
- Click it to pin extension to toolbar

### "Load unpacked" button not showing?

- Make sure **"Developer mode"** is toggled ON (top right)
- The toggle should be blue/enabled

### Extension loads but not working?

- Right-click extension icon
- Click "Inspect"
- Check the console for errors
- Report the error if stuck

### Can't find extension icon?

- Click the extensions icon (puzzle piece) in top right
- Find "Claude Free Tier Resilience"
- Click pin icon to show in toolbar
- Icon should now appear

## Uninstall (If Needed)

To remove the extension:

1. Go to `chrome://extensions/`
2. Find "Claude Free Tier Resilience"
3. Click the trash icon
4. Confirm deletion

Your saved conversations will be deleted. Export/backup first if needed!

## Next Steps

1. ✅ Extension installed
2. ✅ Email configured
3. ✅ Settings saved
4. 🎯 **Go use claude.ai normally!**

The extension works silently in the background. You'll only see it when:
- You hit a rate limit (saves automatically)
- You want to resume a saved chat
- You need to change settings

## Need Help?

**Extension not detecting rate limit?**
- Make sure you're on https://claude.ai (not /chat)
- The error message should contain "rate limit", "too many", or "usage"

**Chat not being saved?**
- Check "Saved Chats" tab - do you see any saved chats?
- Try hitting the rate limit intentionally to test
- Check extension has storage permission

**Email configuration issues?**
- For Gmail: double-check you're using App Password (not regular password)
- For Sendgrid: verify API key starts with "SG."
- Try "Test Email" button again

**Still stuck?**
- Check the console for errors (Right-click extension → Inspect)
- Verify you followed each step above
- Try reloading the extension (toggle off/on in chrome://extensions)

---

**Congrats! You're ready to chat without worrying about rate limits.** 🚀

Go to claude.ai and start chatting. The extension will take care of the rest!
