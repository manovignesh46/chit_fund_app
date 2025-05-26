import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '../../../lib/auth';
import { sendEmail, testEmailConfiguration, emailTemplates, EmailAttachment } from '../../../lib/emailConfig';
import prisma from '../../../lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, role: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Parse request body
    let body;
    try {
      const text = await request.text();
      if (!text.trim()) {
        return NextResponse.json(
          { error: 'Request body is empty' },
          { status: 400 }
        );
      }
      body = JSON.parse(text);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { action, ...emailData } = body;

    switch (action) {
      case 'test-config':
        return await handleTestConfiguration();

      case 'send-dashboard-export':
        return await handleSendDashboardExport(emailData, user);

      case 'send-custom':
        return await handleSendCustomEmail(emailData, user);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Email API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Test email configuration
async function handleTestConfiguration() {
  try {
    const isValid = await testEmailConfiguration();

    if (isValid) {
      return NextResponse.json({
        success: true,
        message: 'Email configuration is valid'
      });
    } else {
      return NextResponse.json(
        { error: 'Email configuration is invalid' },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: `Email configuration test failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// Send dashboard export email
async function handleSendDashboardExport(emailData: any, user: any) {
  try {
    const {
      recipients,
      exportType = 'Financial Data',
      period = 'Monthly',
      attachmentData,
      attachmentFilename,
      customMessage
    } = emailData;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: 'Recipients are required' },
        { status: 400 }
      );
    }

    // Prepare email template
    const template = emailTemplates.dashboardExport(user.name, exportType, period);

    // Add custom message if provided
    let htmlContent = template.html;
    let textContent = template.text;

    if (customMessage) {
      const customSection = `
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <h4 style="margin-top: 0; color: #92400e;">Additional Message:</h4>
          <p style="color: #92400e; margin-bottom: 0;">${customMessage}</p>
        </div>
      `;
      htmlContent = htmlContent.replace('</div>', customSection + '</div>');
      textContent += `\n\nAdditional Message:\n${customMessage}`;
    }

    // Prepare attachments
    let attachments: EmailAttachment[] = [];
    if (attachmentData && attachmentFilename) {
      attachments.push({
        filename: attachmentFilename,
        content: Buffer.from(attachmentData, 'base64'),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
    }

    // Send email
    await sendEmail({
      to: recipients,
      subject: template.subject,
      html: htmlContent,
      text: textContent,
      attachments: attachments.length > 0 ? attachments : undefined
    });

    return NextResponse.json({
      success: true,
      message: `Email sent successfully to ${recipients.length} recipient(s)`
    });
  } catch (error) {
    console.error('Error sending dashboard export email:', error);
    return NextResponse.json(
      { error: `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// Send custom email
async function handleSendCustomEmail(emailData: any, user: any) {
  try {
    const { recipients, subject, message, attachments } = emailData;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: 'Recipients are required' },
        { status: 400 }
      );
    }

    if (!subject || !message) {
      return NextResponse.json(
        { error: 'Subject and message are required' },
        { status: 400 }
      );
    }

    // Prepare email template
    const template = emailTemplates.notification(user.name, subject, message);

    // Prepare attachments if provided
    let emailAttachments: EmailAttachment[] = [];
    if (attachments && Array.isArray(attachments)) {
      emailAttachments = attachments.map((att: any) => ({
        filename: att.filename,
        content: Buffer.from(att.data, 'base64'),
        contentType: att.contentType || 'application/octet-stream'
      }));
    }

    // Send email
    await sendEmail({
      to: recipients,
      subject: template.subject,
      html: template.html,
      text: template.text,
      attachments: emailAttachments.length > 0 ? emailAttachments : undefined
    });

    return NextResponse.json({
      success: true,
      message: `Custom email sent successfully to ${recipients.length} recipient(s)`
    });
  } catch (error) {
    console.error('Error sending custom email:', error);
    return NextResponse.json(
      { error: `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if this is a test-config request
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'test-config') {
      return await handleTestConfiguration();
    }

    // Default: Test email configuration and return status
    const isConfigured = await testEmailConfiguration();

    return NextResponse.json({
      configured: isConfigured,
      settings: {
        host: process.env.SMTP_HOST || 'Not configured',
        port: process.env.SMTP_PORT || 'Not configured',
        user: process.env.SMTP_USER || 'Not configured',
        fromName: process.env.SMTP_FROM_NAME || 'Microfinance App'
      }
    });
  } catch (error) {
    console.error('Email status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check email configuration' },
      { status: 500 }
    );
  }
}
