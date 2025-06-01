import { NextRequest, NextResponse } from 'next/server';
import { createCompressedMySQLDump } from '../../../../lib/dbBackup';
import { sendEmail } from '../../../../lib/emailConfig';
import { logEmailSend } from '../../../../lib/emailRecovery';
import { readFile, unlink } from 'fs/promises';

// Scheduled DB backup endpoint
export async function POST(request: NextRequest) {
  try {
    // Security: internal key
    const authHeader = request.headers.get('authorization');
    const internalKey = process.env.INTERNAL_API_KEY || 'default-internal-key';
    if (authHeader !== `Bearer ${internalKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Recipients
    const defaultRecipients = process.env.DEFAULT_EMAIL_RECIPIENTS;
    const recipients = defaultRecipients
      ? defaultRecipients.split(',').map(e => e.trim()).filter(Boolean)
      : [];
    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients configured' }, { status: 400 });
    }

    // Create DB backup
    const { zipPath, fileName } = await createCompressedMySQLDump();
    const fileBuffer = await readFile(zipPath);

    // Email subject/body
    const period = new Date().toISOString().slice(0, 7); // YYYY-MM
    const subject = `Monthly Database Backup - ${period}`;
    const html = `<p>Attached is the compressed MySQL database backup for ${period}.</p>`;

    // Send email
    await sendEmail({
      to: recipients,
      subject,
      html,
      attachments: [{
        filename: fileName,
        content: fileBuffer,
        contentType: 'application/zip'
      }]
    });

    // Log
    await logEmailSend({
      emailType: 'monthly',
      period,
      sentDate: new Date(),
      status: 'sent',
      recipients,
      fileName
    });

    // Clean up zip
    await unlink(zipPath);

    return NextResponse.json({ success: true, fileName, recipients });
  } catch (error) {
    // Log failure
    try {
      const period = new Date().toISOString().slice(0, 7);
      const defaultRecipients = process.env.DEFAULT_EMAIL_RECIPIENTS;
      const recipients = defaultRecipients
        ? defaultRecipients.split(',').map(e => e.trim()).filter(Boolean)
        : [];
      await logEmailSend({
        emailType: 'monthly',
        period,
        sentDate: new Date(),
        status: 'failed',
        recipients,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    } catch {}
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
