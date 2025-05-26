'use client';

import { useState, useEffect } from 'react';
import { emailAPI, dashboardAPI } from '../lib/api';

interface EmailExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportType?: string;
  duration?: string;
  limit?: number;
  period?: string;
  startDate?: string;
  endDate?: string;
}

export default function EmailExportModal({
  isOpen,
  onClose,
  exportType = 'Financial Data',
  duration = 'monthly',
  limit = 12,
  period,
  startDate,
  endDate
}: EmailExportModalProps) {
  const [recipients, setRecipients] = useState<string[]>(['']);
  const [customMessage, setCustomMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState<any>(null);
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
        ...(duration === 'single' && { period, startDate, endDate })
      };

      // Send email using dashboard API
      const result = await dashboardAPI.emailExport(emailData);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Email Export</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Email Configuration Status */}
        {emailStatus && (
          <div className={`mb-4 p-3 rounded-lg ${emailStatus.configured ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${emailStatus.configured ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <span className={`text-sm font-medium ${emailStatus.configured ? 'text-green-800' : 'text-yellow-800'}`}>
                Email Configuration: {emailStatus.configured ? 'Configured' : 'Not Configured'}
              </span>
            </div>
            {emailStatus.configured && (
              <div className="mt-2 text-xs text-gray-600">
                <p>Host: {emailStatus.settings.host}</p>
                <p>User: {emailStatus.settings.user}</p>
              </div>
            )}
          </div>
        )}

        {/* Test Configuration Button */}
        {emailStatus && !emailStatus.configured && (
          <div className="mb-4">
            <button
              onClick={testEmailConfiguration}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Testing...' : 'Test Email Configuration'}
            </button>
          </div>
        )}

        {/* Export Details */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">Export Details</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Type:</strong> {exportType}</p>
            <p><strong>Period:</strong> {duration === 'single' ? period : `Last ${limit} ${duration}`}</p>
            {duration === 'single' && startDate && endDate && (
              <p><strong>Date Range:</strong> {startDate} to {endDate}</p>
            )}
          </div>
        </div>

        {/* Recipients */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Recipients *
          </label>

          {/* Default Recipients Toggle */}
          <div className="mb-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={useDefaultRecipients}
                onChange={(e) => setUseDefaultRecipients(e.target.checked)}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">
                Use default recipients from configuration
              </span>
            </label>
            {useDefaultRecipients && (
              <p className="text-xs text-gray-500 mt-1 ml-6">
                Emails will be sent to the default recipients configured in the system
              </p>
            )}
          </div>

          {/* Custom Recipients Input */}
          {!useDefaultRecipients && (
            <>
              {recipients.map((recipient, index) => (
                <div key={index} className="flex items-center mb-2">
                  <input
                    type="email"
                    value={recipient}
                    onChange={(e) => updateRecipient(index, e.target.value)}
                    placeholder="Enter email address"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {recipients.length > 1 && (
                    <button
                      onClick={() => removeRecipient(index)}
                      className="ml-2 p-2 text-red-600 hover:text-red-800"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addRecipient}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                + Add another recipient
              </button>
            </>
          )}
        </div>

        {/* Custom Message */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Message (Optional)
          </label>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Add a custom message to include in the email..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSendEmail}
            disabled={isLoading || !emailStatus?.configured}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  );
}
