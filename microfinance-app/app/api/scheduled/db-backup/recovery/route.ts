import { NextRequest, NextResponse } from 'next/server';
import { createCompressedMySQLDump } from '../../../../../lib/dbBackup';
import { sendEmail } from '../../../../../lib/emailConfig';
import { logEmailSend } from '../../../../../lib/emailRecovery';
import { readFile, unlink } from 'fs/promises';

// Recovery endpoint for missed DB backups
export async function POST(request: NextRequest) {
  try {
    // Security: internal key
    const authHeader = request.headers.get('authorization');
    const internalKey = process.env.INTERNAL_API_KEY || 'default-internal-key';
    if (authHeader !== `Bearer ${internalKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { period } = body;
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: 'Invalid period format. Expected YYYY-MM' }, { status: 400 });
    }

    // Recipients
    const defaultRecipients = process.env.DEFAULT_EMAIL_RECIPIENTS;
    const recipients = defaultRecipients
      ? defaultRecipients.split(',').map(e => e.trim()).filter(Boolean)
      : [];
    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients configured' }, { status: 400 });
    }

    // Create DB backup (for the current DB state, as point-in-time recovery is not supported)
    const { zipPath, fileName } = await createCompressedMySQLDump();
    const fileBuffer = await readFile(zipPath);

    // Email subject/body
    const subject = `[RECOVERY] Monthly Database Backup - ${period}`;
    const html = `<p>This is a <strong>recovery email</strong> for the missed database backup for ${period}.<br>Attached is the current database backup.</p>`;

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
      status: 'recovered',
      recipients,
      fileName,
      isRecovery: true
    });

    // Clean up zip
    await unlink(zipPath);

    return NextResponse.json({ success: true, fileName, recipients, isRecovery: true });
  } catch (error) {
    // Log failure
    try {
      const body = await request.json();
      const { period } = body;
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
        isRecovery: true,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    } catch {}
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
