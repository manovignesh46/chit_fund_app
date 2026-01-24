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
  // Transaction export email template
  transactionExport: (recipientName: string, data: any) => {
    const { details, summaryByType, partnerSummary, filename } = data;
    
    const formatINR = (amount: number) => {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
      }).format(amount);
    };

    // Construct dynamic subject based on dates
    let subjectRange = '';
    if (details.startDate && details.startDate !== 'N/A' && details.endDate && details.endDate !== 'N/A') {
      subjectRange = `(${details.startDate} to ${details.endDate})`;
    } else if (details.endDate && details.endDate !== 'N/A') {
      subjectRange = `(Until ${details.endDate})`;
    } else {
      subjectRange = filename.replace('.xlsx', '').replace('Transactions_', '');
      if (subjectRange === '') subjectRange = '(Full History)';
    }

    return {
      subject: `Transaction Export - ${subjectRange}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #374151;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Transaction Export Report</h2>
          <p>Please find attached the transaction export file with detailed transaction data and summary.</p>

          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
            <h3 style="margin-top: 0; color: #1e40af;">Export Details:</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Export Type:</strong> ${details.exportType}</li>
              <li><strong>Total Transactions:</strong> ${details.totalTransactions}</li>
              <li><strong>Transaction Amount Total:</strong> ${formatINR(details.totalAmount)}</li>
              <li><strong>Start Date:</strong> ${details.startDate}</li>
              <li><strong>End Date:</strong> ${details.endDate}</li>
            </ul>
          </div>

          <h3 style="color: #1e40af; border-left: 4px solid #2563eb; padding-left: 10px;">Transaction Summary by Type:</h3>
          <ul style="list-style: none; padding: 0; margin-bottom: 20px;">
            <li><strong>Loan Repayments:</strong> ${formatINR(summaryByType.loanRepayments)}</li>
            <li><strong>Loan Disbursements:</strong> ${formatINR(summaryByType.loanDisbursements)}</li>
            <li><strong>Document Charges:</strong> ${formatINR(summaryByType.documentCharges)}</li>
            <li><strong>Chit Contributions:</strong> ${formatINR(summaryByType.chitContributions)}</li>
            <li><strong>Auction Payouts:</strong> ${formatINR(summaryByType.auctionPayouts)}</li>
            <li><strong>Net Recorded Amount:</strong> ${formatINR(summaryByType.netRecordedAmount)}</li>
            <li><strong>Partner Transfers:</strong> ${formatINR(summaryByType.partnerTransfers)}</li>
            <li><strong>Net Total Amount:</strong> <span style="color: ${summaryByType.netTotalAmount >= 0 ? '#059669' : '#dc2626'}">${formatINR(summaryByType.netTotalAmount)}</span></li>
          </ul>

          <h3 style="color: #1e40af; border-left: 4px solid #2563eb; padding-left: 10px;">Partner-wise Summary:</h3>
          <div style="overflow-x: auto; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="background-color: #f3f4f6;">
                  <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">Partner</th>
                  <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">Loan Repayments</th>
                  <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">Chit Contributions</th>
                  <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">Recorded Amounts</th>
                  <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">Loan Disbursements</th>
                  <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">Document Charges</th>
                  <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">Auction Payouts</th>
                  <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">Partner Transfers</th>
                  <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                ${partnerSummary.map((p: any) => `
                  <tr>
                    <td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: ${p.Partner === 'TOTAL' ? 'bold' : 'normal'}">${p.Partner}</td>
                    <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">${p['Loan Repayments']}</td>
                    <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">${p['Chit Contributions']}</td>
                    <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">${p['Recorded Amounts']}</td>
                    <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">${p['Loan Disbursements']}</td>
                    <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">${p['Document Charges']}</td>
                    <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">${p['Auction Payouts']}</td>
                    <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">${p['Partner Transfers']}</td>
                    <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: ${p.Partner === 'TOTAL' ? 'bold' : 'normal'}; color: ${p.TotalValue >= 0 ? '#059669' : '#dc2626'}">${p['Total Amount']}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <p style="font-size: 14px; margin-top: 20px;">
            <strong>Generated on:</strong> ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px;">The attached Excel file contains two worksheets:</p>
            <ul style="margin: 10px 0 0 0; font-size: 14px;">
              <li><strong>Transactions:</strong> Detailed transaction list</li>
              <li><strong>Transaction Summary:</strong> Partner-wise summary data</li>
            </ul>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="font-size: 12px; color: #9ca3af;">
            Best regards,<br>
            <strong>Microfinance Management System</strong>
          </p>
        </div>
      `,
      text: `
Transaction Export Report
Please find attached the transaction export file with detailed transaction data and summary.

Export Details:
Export Type: ${details.exportType}
Total Transactions: ${details.totalTransactions}
Transaction Amount Total: ${formatINR(details.totalAmount)}
Start Date: ${details.startDate}
End Date: ${details.endDate}

Transaction Summary by Type:
Loan Repayments: ${formatINR(summaryByType.loanRepayments)}
Loan Disbursements: ${formatINR(summaryByType.loanDisbursements)}
Document Charges: ${formatINR(summaryByType.documentCharges)}
Chit Contributions: ${formatINR(summaryByType.chitContributions)}
Auction Payouts: ${formatINR(summaryByType.auctionPayouts)}
Net Recorded Amount: ${formatINR(summaryByType.netRecordedAmount)}
Partner Transfers: ${formatINR(summaryByType.partnerTransfers)}
Net Total Amount: ${formatINR(summaryByType.netTotalAmount)}

Partner-wise Summary Table included in HTML version.
TOTAL: ${partnerSummary.find((p: any) => p.Partner === 'TOTAL')?.['Total Amount'] || 'N/A'}

Generated on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}

The attached Excel file contains two worksheets:
1. Transactions: Detailed transaction list
2. Transaction Summary: Partner-wise summary data

Best regards,
Microfinance Management System
      `
    };
  },

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
