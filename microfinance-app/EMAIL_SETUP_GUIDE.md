# Email Configuration Guide

This guide will help you set up email functionality for the Microfinance Application using Gmail SMTP with two-step authentication.

## 📧 **Gmail SMTP Setup with App Passwords**

### Step 1: Enable Two-Step Authentication

1. **Go to your Google Account settings**:
   - Visit [myaccount.google.com](https://myaccount.google.com)
   - Click on "Security" in the left sidebar

2. **Enable 2-Step Verification**:
   - Under "Signing in to Google", click "2-Step Verification"
   - Follow the setup process to enable 2FA using your phone number
   - Complete the verification process

### Step 2: Generate App Password

1. **Access App Passwords**:
   - Go back to Security settings
   - Under "Signing in to Google", click "App passwords"
   - You may need to sign in again

2. **Create App Password**:
   - Select "Mail" as the app
   - Select "Other (Custom name)" as the device
   - Enter "Microfinance App" as the custom name
   - Click "Generate"

3. **Save the App Password**:
   - Copy the 16-character app password (e.g., `abcd efgh ijkl mnop`)
   - **Important**: Save this password securely - you won't be able to see it again

### Step 3: Configure Environment Variables

Add the following variables to your `.env` file:

```env
# Email Configuration (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
SMTP_FROM_NAME=Microfinance Management System

# JWT Secret (if not already set)
JWT_SECRET=your-jwt-secret-key
```

### Step 4: Environment Variables Explanation

| Variable | Description | Example |
|----------|-------------|---------|
| `SMTP_HOST` | Gmail SMTP server | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port (587 for TLS) | `587` |
| `SMTP_SECURE` | Use SSL (false for TLS) | `false` |
| `SMTP_USER` | Your Gmail address | `your-email@gmail.com` |
| `SMTP_PASS` | 16-character app password | `abcd efgh ijkl mnop` |
| `SMTP_FROM_NAME` | Display name for emails | `Microfinance Management System` |

## 🔧 **Alternative SMTP Providers**

### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

### Yahoo Mail
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@yahoo.com
SMTP_PASS=your-app-password
```

### Custom SMTP Server
```env
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-password
```

## 🧪 **Testing Email Configuration**

### Method 1: Using the Application
1. Start the application: `npm run dev`
2. Login to the dashboard
3. Click the "Email" button next to "Export"
4. The modal will show configuration status
5. Click "Test Email Configuration" if needed

### Method 2: Using API Endpoint
```bash
curl -X GET "http://localhost:3002/api/email" \
  -H "Cookie: auth_token=your-jwt-token"
```

### Method 3: Using Node.js Script
Create a test script:

```javascript
// test-email.js
const { testEmailConfiguration } = require('./lib/emailConfig');

async function test() {
  try {
    const isValid = await testEmailConfiguration();
    console.log('Email configuration is', isValid ? 'valid' : 'invalid');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

test();
```

Run: `node test-email.js`

## 📨 **Email Features**

### Dashboard Export Email
- **Purpose**: Send financial reports via email
- **Features**:
  - Multiple recipients support
  - Custom message option
  - Excel attachment with financial data
  - Professional email template
  - Period-specific reports (weekly/monthly/yearly)

### Email Templates
- **Dashboard Export**: Professional template with financial data summary
- **Custom Notifications**: Flexible template for general communications

### Security Features
- **Authentication Required**: All email endpoints require valid JWT token
- **Input Validation**: Email addresses and content are validated
- **Error Handling**: Comprehensive error messages and logging
- **Rate Limiting**: Built-in protection against spam

## 🚨 **Troubleshooting**

### Common Issues

#### 1. "Authentication failed" Error
- **Cause**: Incorrect email/password or 2FA not enabled
- **Solution**: 
  - Verify email address is correct
  - Ensure 2-Step Verification is enabled
  - Generate new app password
  - Check for typos in app password

#### 2. "Connection timeout" Error
- **Cause**: Network or firewall issues
- **Solution**:
  - Check internet connection
  - Verify SMTP_HOST and SMTP_PORT
  - Try different port (465 for SSL)

#### 3. "Invalid recipients" Error
- **Cause**: Malformed email addresses
- **Solution**: Verify email format (user@domain.com)

#### 4. "Email configuration not found" Error
- **Cause**: Missing environment variables
- **Solution**: Check all required SMTP_* variables are set

### Debug Steps

1. **Check Environment Variables**:
   ```bash
   echo $SMTP_HOST
   echo $SMTP_USER
   # Don't echo SMTP_PASS for security
   ```

2. **Test SMTP Connection**:
   ```bash
   telnet smtp.gmail.com 587
   ```

3. **Check Application Logs**:
   - Look for email-related errors in console
   - Check network tab in browser dev tools

4. **Verify Gmail Settings**:
   - Ensure 2-Step Verification is active
   - Check that app password is correctly generated
   - Verify account is not locked

## 🔒 **Security Best Practices**

### Environment Variables
- **Never commit** `.env` files to version control
- Use **different credentials** for development and production
- **Rotate app passwords** regularly
- Use **environment-specific** configurations

### Email Security
- **Validate all inputs** before sending emails
- **Limit recipient count** to prevent spam
- **Log email activities** for audit trails
- **Use rate limiting** to prevent abuse

### Production Deployment
- Use **secure environment variable** management (e.g., Vercel Environment Variables)
- Enable **email monitoring** and alerts
- Set up **backup SMTP** providers for redundancy
- Implement **email queue** for high-volume sending

## 📋 **Email API Reference**

### Test Configuration
```
GET /api/email
POST /api/email (action: test-config)
```

### Send Dashboard Export
```
POST /api/email
{
  "action": "send-dashboard-export",
  "recipients": ["user@example.com"],
  "exportType": "Financial Data",
  "period": "Monthly",
  "customMessage": "Optional message"
}
```

### Send Custom Email
```
POST /api/email
{
  "action": "send-custom",
  "recipients": ["user@example.com"],
  "subject": "Subject",
  "message": "Message content"
}
```

## ✅ **Verification Checklist**

- [ ] Two-step authentication enabled on Gmail
- [ ] App password generated and saved
- [ ] Environment variables configured in `.env`
- [ ] Application restarted after adding variables
- [ ] Email configuration test passes
- [ ] Test email sent successfully
- [ ] Dashboard email button works
- [ ] Email modal opens and functions correctly

## 🆘 **Support**

If you encounter issues:

1. **Check this guide** for common solutions
2. **Review application logs** for specific error messages
3. **Test with a simple email** first
4. **Verify Gmail account settings** are correct
5. **Try alternative SMTP providers** if Gmail doesn't work

For additional help, check the application logs and ensure all environment variables are properly configured.
