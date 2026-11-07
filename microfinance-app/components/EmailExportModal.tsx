'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveDialog } from '@/components/kit/responsive-dialog';
import { emailAPI, dashboardAPI } from '../lib/api';
import { buildTransactionFilterObject, type TransactionFilters } from '../lib/transactionFilterUtils';

interface EmailExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportType?: string;
  duration?: string;
  limit?: number;
  period?: string;
  startDate?: string;
  endDate?: string;
  transactionFilters?: TransactionFilters;
}

export default function EmailExportModal({
  isOpen,
  onClose,
  exportType = 'Financial Data',
  duration = 'monthly',
  limit = 12,
  period,
  startDate,
  endDate,
  transactionFilters
}: EmailExportModalProps) {
  const [recipients, setRecipients] = useState([''] as string[]);
  const [customMessage, setCustomMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null as any);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [useDefaultRecipients, setUseDefaultRecipients] = useState(true);

  // Check email configuration status and load default recipients
  useEffect(() => {
    if (isOpen) {
      checkEmailStatus();
      // Reset to use default recipients when modal opens
      setUseDefaultRecipients(true);
      setRecipients(['']);
    }
  }, [isOpen]);

  const checkEmailStatus = async () => {
    try {
      const status = await emailAPI.getStatus();
      setEmailStatus(status);
    } catch (error) {
      console.error('Error checking email status:', error);
    }
  };

  const addRecipient = () => {
    setRecipients([...recipients, '']);
  };

  const removeRecipient = (index: number) => {
    if (recipients.length > 1) {
      setRecipients(recipients.filter((_, i) => i !== index));
    }
  };

  const updateRecipient = (index: number, value: string) => {
    const updated = [...recipients];
    updated[index] = value;
    setRecipients(updated);
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendEmail = async () => {
    setError('');
    setSuccess('');

    let emailRecipients: string[] = [];

    if (useDefaultRecipients) {
      // Use default recipients from environment variable (empty array triggers server default)
      emailRecipients = [];
    } else {
      // Validate custom recipients
      const validRecipients = recipients.filter(email => email.trim() && validateEmail(email.trim()));
      if (validRecipients.length === 0) {
        setError('Please enter at least one valid email address');
        return;
      }

      const invalidEmails = recipients.filter(email => email.trim() && !validateEmail(email.trim()));
      if (invalidEmails.length > 0) {
        setError('Please enter valid email addresses');
        return;
      }

      emailRecipients = validRecipients;
    }

    setIsLoading(true);

    try {
      // Prepare email data
      const emailData = {
        recipients: emailRecipients,
        exportType,
        period: duration === 'single' ? period : `Last ${limit} ${duration}`,
        duration,
        limit,
        customMessage: customMessage.trim(),
        ...(duration === 'single' && { period, startDate, endDate }),
        // Include transaction filters for transaction exports
        ...(exportType === 'Transactions' && transactionFilters && buildTransactionFilterObject(transactionFilters))
      };

      // Send email using appropriate API based on export type
      let result;
      if (exportType === 'Transactions') {
        result = await dashboardAPI.emailTransactions(emailData);
      } else {
        result = await dashboardAPI.emailExport(emailData);
      }

      setSuccess(result.message || 'Email sent successfully!');

      // Reset form after successful send
      setTimeout(() => {
        onClose();
        setRecipients(['']);
        setCustomMessage('');
        setSuccess('');
        setUseDefaultRecipients(true);
      }, 2000);

    } catch (error: any) {
      console.error('Error sending email:', error);
      setError(error.message || 'Failed to send email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const testEmailConfiguration = async () => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const result = await emailAPI.testConfiguration();
      setSuccess('Email configuration is working correctly!');
      checkEmailStatus(); // Refresh status
    } catch (error: any) {
      setError(error.message || 'Email configuration test failed');
    } finally {
      setIsLoading(false);
    }
  };

  const periodLabel = duration === 'single' ? period : `Last ${limit} ${duration}`;

  return (
    <ResponsiveDialog
      open={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Email Export"
      description={`Send the ${exportType.toLowerCase()} export by email.`}
      hideDescription
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSendEmail} disabled={isLoading || !emailStatus?.configured}>
            {isLoading ? 'Sending...' : 'Send Email'}
          </Button>
        </>
      }
    >
      <div className="max-h-[65vh] space-y-4 overflow-y-auto">
        {/* Email configuration status */}
        {emailStatus && (
          <div className={`rounded-lg border p-3 ${emailStatus.configured ? 'border-success-border bg-success-subtle' : 'border-warning-border bg-warning-subtle'}`}>
            <div className="flex items-center">
              <span aria-hidden="true" className={`mr-2 h-2 w-2 rounded-full ${emailStatus.configured ? 'bg-success' : 'bg-warning'}`} />
              <span className={`text-sm font-medium ${emailStatus.configured ? 'text-success-text' : 'text-warning-text'}`}>
                Email Configuration: {emailStatus.configured ? 'Configured' : 'Not Configured'}
              </span>
            </div>
            {emailStatus.configured && (
              <div className="mt-2 text-xs text-muted-foreground">
                <p>Host: {emailStatus.settings.host}</p>
                <p>User: {emailStatus.settings.user}</p>
              </div>
            )}
          </div>
        )}

        {emailStatus && !emailStatus.configured && (
          <Button type="button" variant="outline" onClick={testEmailConfiguration} disabled={isLoading}>
            {isLoading ? 'Testing...' : 'Test Email Configuration'}
          </Button>
        )}

        {/* Export details */}
        <div className="rounded-lg bg-muted p-4">
          <h3 className="mb-2 font-medium text-foreground">Export Details</h3>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Type:</strong> {exportType}</p>
            <p><strong className="text-foreground">Period:</strong> {periodLabel}</p>
            {duration === 'single' && startDate && endDate && (
              <p><strong className="text-foreground">Date Range:</strong> {startDate} to {endDate}</p>
            )}
          </div>
        </div>

        {/* Recipients */}
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-foreground">Email Recipients</legend>
          <div className="flex items-center gap-2">
            <Checkbox
              id="email-export-default-recipients"
              checked={useDefaultRecipients}
              onCheckedChange={(checked) => setUseDefaultRecipients(checked === true)}
            />
            <Label htmlFor="email-export-default-recipients" className="text-sm font-normal text-foreground">
              Use default recipients from configuration
            </Label>
          </div>
          {useDefaultRecipients && (
            <p className="ml-6 text-xs text-muted-foreground">
              Emails will be sent to the default recipients configured in the system
            </p>
          )}

          {!useDefaultRecipients && (
            <>
              {recipients.map((recipient, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="email"
                    value={recipient}
                    onChange={(e) => updateRecipient(index, e.target.value)}
                    placeholder="Enter email address"
                    aria-label={`Recipient ${index + 1}`}
                    className="flex-1"
                  />
                  {recipients.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRecipient(index)}
                      aria-label={`Remove recipient ${index + 1}`}
                      className="text-destructive-text hover:text-destructive-text"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="link" size="sm" onClick={addRecipient} className="h-auto px-0">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add another recipient
              </Button>
            </>
          )}
        </fieldset>

        {/* Custom message */}
        <div className="space-y-1.5">
          <Label htmlFor="email-export-message" className="text-sm font-medium text-foreground">
            Custom Message (Optional)
          </Label>
          <Textarea
            id="email-export-message"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Add a custom message to include in the email..."
            rows={3}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-destructive-border bg-destructive-subtle p-3 text-sm text-destructive-text">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="rounded-lg border border-success-border bg-success-subtle p-3 text-sm text-success-text">
            {success}
          </p>
        )}
      </div>
    </ResponsiveDialog>
  );
}
