// Test script to verify email configuration
// Run with: node test-email-config.js

const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmailConfiguration() {
  console.log('🧪 Testing Email Configuration...\n');

  // Check environment variables
  console.log('📧 Email Configuration:');
  console.log(`SMTP Host: ${process.env.SMTP_HOST}`);
  console.log(`SMTP Port: ${process.env.SMTP_PORT}`);
  console.log(`SMTP User: ${process.env.SMTP_USER}`);
  console.log(`SMTP Pass: ${process.env.SMTP_PASS ? '***configured***' : 'NOT SET'}`);
  console.log(`From Name: ${process.env.SMTP_FROM_NAME}`);
  console.log(`Recipients: ${process.env.DEFAULT_EMAIL_RECIPIENTS}`);
  console.log('');

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  try {
    // Test connection
    console.log('🔗 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');

    // Send test email
    console.log('📤 Sending test email...');

    const recipients = process.env.DEFAULT_EMAIL_RECIPIENTS
      ? process.env.DEFAULT_EMAIL_RECIPIENTS.split(',').map(email => email.trim())
      : [];

    if (recipients.length === 0) {
      console.log('❌ No recipients configured in DEFAULT_EMAIL_RECIPIENTS');
      return;
    }

    const testEmailOptions = {
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_USER}>`,
      to: recipients,
      subject: '[TEST] Email Configuration Test - Microfinance App',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">📧 Email Configuration Test</h2>
          <p>This is a test email to verify that your email configuration is working correctly.</p>

          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Configuration Details:</h3>
            <ul style="color: #6b7280;">
              <li><strong>SMTP Host:</strong> ${process.env.SMTP_HOST}</li>
              <li><strong>SMTP Port:</strong> ${process.env.SMTP_PORT}</li>
              <li><strong>From:</strong> ${process.env.SMTP_FROM_NAME} &lt;${process.env.SMTP_USER}&gt;</li>
              <li><strong>Recipients:</strong> ${recipients.join(', ')}</li>
              <li><strong>Test Time:</strong> ${new Date().toLocaleString()}</li>
            </ul>
          </div>

          <p style="color: #059669;"><strong>✅ If you received this email, your configuration is working correctly!</strong></p>

          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
            This test email was sent from your Microfinance Application.<br>
            If you continue to have issues with scheduled emails, please check the server logs for errors.
          </p>
        </div>
      `,
      text: `
Email Configuration Test - Microfinance App

This is a test email to verify that your email configuration is working correctly.

Configuration Details:
- SMTP Host: ${process.env.SMTP_HOST}
- SMTP Port: ${process.env.SMTP_PORT}
- From: ${process.env.SMTP_FROM_NAME} <${process.env.SMTP_USER}>
- Recipients: ${recipients.join(', ')}
- Test Time: ${new Date().toLocaleString()}

✅ If you received this email, your configuration is working correctly!

This test email was sent from your Microfinance Application.
If you continue to have issues with scheduled emails, please check the server logs for errors.
      `
    };

    const info = await transporter.sendMail(testEmailOptions);
    console.log('✅ Test email sent successfully!');
    console.log(`Message ID: ${info.messageId}`);
    console.log(`Recipients: ${recipients.join(', ')}`);
    console.log('\n📬 Please check your email inbox (including spam folder) for the test email.');

  } catch (error) {
    console.error('❌ Email test failed:', error.message);

    if (error.code === 'EAUTH') {
      console.log('\n🔧 Authentication Error Solutions:');
      console.log('1. Make sure you\'re using an App Password, not your regular Gmail password');
      console.log('2. Enable 2-Factor Authentication on your Gmail account');
      console.log('3. Generate an App Password: https://myaccount.google.com/apppasswords');
      console.log('4. Update SMTP_PASS in your .env file with the App Password');
    } else if (error.code === 'ECONNECTION') {
      console.log('\n🔧 Connection Error Solutions:');
      console.log('1. Check your internet connection');
      console.log('2. Verify SMTP settings (host, port)');
      console.log('3. Check if your firewall is blocking the connection');
    }
  }
}

// Run the test
testEmailConfiguration().catch(console.error);
