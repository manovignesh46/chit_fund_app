import nodemailer from 'nodemailer';

// Email configuration interface
export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

// Email attachment interface
export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

// Email options interface
export interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

// Create email transporter
export function createEmailTransporter(): nodemailer.Transporter {
  // Validate required environment variables
  const requiredEnvVars = [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  const config: EmailConfig = {
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT!),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!, // App password for Gmail
    },
  };

  // Create transporter
  const transporter = nodemailer.createTransport(config);

  return transporter;
}

// Send email function
export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    const transporter = createEmailTransporter();

    // Verify transporter configuration
    await transporter.verify();

    // Prepare email options
    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME || 'Microfinance App'}" <${process.env.SMTP_USER}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
      bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments?.map(attachment => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
      })),
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);

    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Test email configuration
export async function testEmailConfiguration(): Promise<boolean> {
  try {
    const transporter = createEmailTransporter();
    await transporter.verify();
    console.log('Email configuration is valid');
    return true;
  } catch (error) {
    console.error('Email configuration test failed:', error);
    return false;
  }
}

// Generate email templates
export const emailTemplates = {
  // Dashboard export email template
  dashboardExport: (recipientName: string, exportType: string, period: string) => ({
    subject: `Dashboard Export - ${exportType} Report (${period})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Dashboard Export Report</h2>
        <p>Dear ${recipientName},</p>
        <p>Please find attached your requested dashboard export report.</p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Report Details:</h3>
          <ul style="color: #6b7280;">
            <li><strong>Export Type:</strong> ${exportType}</li>
            <li><strong>Period:</strong> ${period}</li>
            <li><strong>Generated On:</strong> ${new Date().toLocaleString()}</li>
          </ul>
        </div>

        <p>This report contains comprehensive financial data including:</p>
        <ul style="color: #6b7280;">
          <li>Cash inflow and outflow analysis</li>
          <li>Profit breakdown by category</li>
          <li>Transaction details</li>
          <li>Financial metrics and trends</li>
        </ul>

        <p style="margin-top: 30px;">
          Best regards,<br>
          <strong>Microfinance Management System</strong>
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="font-size: 12px; color: #9ca3af;">
          This is an automated email. Please do not reply to this message.
          If you have any questions, please contact your system administrator.
        </p>
      </div>
    `,
    text: `
Dashboard Export Report

Dear ${recipientName},

Please find attached your requested dashboard export report.

Report Details:
- Export Type: ${exportType}
- Period: ${period}
- Generated On: ${new Date().toLocaleString()}

This report contains comprehensive financial data including cash inflow and outflow analysis, profit breakdown by category, transaction details, and financial metrics and trends.

Best regards,
Microfinance Management System

This is an automated email. Please do not reply to this message.
    `
  }),

  // General notification template
  notification: (recipientName: string, title: string, message: string) => ({
    subject: title,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">${title}</h2>
        <p>Dear ${recipientName},</p>
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          ${message}
        </div>
        <p style="margin-top: 30px;">
          Best regards,<br>
          <strong>Microfinance Management System</strong>
        </p>
      </div>
    `,
    text: `${title}\n\nDear ${recipientName},\n\n${message}\n\nBest regards,\nMicrofinance Management System`
  })
};
