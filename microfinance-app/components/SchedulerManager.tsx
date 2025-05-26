'use client';

import React, { useState, useEffect } from 'react';

interface SchedulerStatus {
  enabled: boolean;
  running: boolean;
  configuration: {
    day: number;
    hour: number;
    timezone: string;
  };
  nextRun: string;
}

export default function SchedulerManager() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/scheduler');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else {
        setError('Failed to fetch scheduler status');
      }
    } catch (err) {
      setError('Error fetching scheduler status');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    try {
      setLoading(true);
      setMessage('');
      setError('');

      const response = await fetch('/api/scheduler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        await fetchStatus(); // Refresh status
      } else {
        setError(data.error || 'Action failed');
      }
    } catch (err) {
      setError('Error performing action');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !status) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Automatic Monthly Email Scheduler
        </h3>
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading scheduler status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Automatic Monthly Email Scheduler
      </h3>

      {/* Status Display */}
      {status && (
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Status</h4>
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-2 ${status.enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-sm">
                    {status.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-2 ${status.running ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm">
                    {status.running ? 'Running' : 'Stopped'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Schedule</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>Day: {status.configuration.day} of each month</p>
                <p>Time: {status.configuration.hour}:00</p>
                <p>Timezone: {status.configuration.timezone}</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Next Run</h4>
            <p className="text-sm text-gray-600">{status.nextRun}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-4">
        <button
          onClick={() => handleAction('start')}
          disabled={loading || (status?.running && status?.enabled)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : 'Start Scheduler'}
        </button>

        <button
          onClick={() => handleAction('stop')}
          disabled={loading || !status?.running}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : 'Stop Scheduler'}
        </button>

        <button
          onClick={() => handleAction('trigger')}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : 'Send Now (Test)'}
        </button>

        <button
          onClick={fetchStatus}
          disabled={loading}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : 'Refresh Status'}
        </button>
      </div>

      {/* Messages */}
      {message && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 text-sm">{message}</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Information */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-medium text-yellow-800 mb-2">How it works</h4>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Automatically sends monthly financial reports via email</li>
          <li>• Runs on the configured day of each month at the specified time</li>
          <li>• Sends to recipients configured in DEFAULT_EMAIL_RECIPIENTS</li>
          <li>• Includes comprehensive Excel report with all financial data</li>
          <li>• Use "Send Now (Test)" to manually trigger an email for testing</li>
        </ul>
      </div>
    </div>
  );
}
