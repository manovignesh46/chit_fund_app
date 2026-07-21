'use client';

import React, { useEffect, useState } from 'react';
import { authAPI } from '../../lib/api';
import PasswordInput from '../components/ui/PasswordInput';

export default function ProfileSettings() {
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState({ name: '', email: '' });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await authAPI.getCurrentUser();
        setProfile({ name: user.name || '', email: user.email || '' });
      } catch {
        // Header/sidebar already surface auth failures; nothing to show here.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      return;
    }

    setPasswordSubmitting(true);
    try {
      await authAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordSuccess('Password changed successfully.');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="themed-card p-6 max-w-2xl">
        <div className="animate-pulse bg-gray-200 dark:bg-surface-elevated rounded-lg h-6 w-32 mb-4"></div>
        <div className="animate-pulse bg-gray-200 dark:bg-surface-elevated rounded-lg h-32 w-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="themed-card p-6 max-w-2xl">
        <h3 className="card-title !mb-2">Profile</h3>
        <p className="text-sm text-gray-500 dark:text-theme-muted mb-6">
          Your account details. Contact an administrator to change these.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">Name</label>
            <input
              type="text"
              disabled
              readOnly
              value={profile.name}
              className="w-full px-3 py-2 border border-gray-200 dark:border-surface-border rounded-lg bg-gray-50 dark:bg-surface-elevated text-gray-500 dark:text-theme-muted cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">Email</label>
            <input
              type="email"
              disabled
              readOnly
              value={profile.email}
              className="w-full px-3 py-2 border border-gray-200 dark:border-surface-border rounded-lg bg-gray-50 dark:bg-surface-elevated text-gray-500 dark:text-theme-muted cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      <div className="themed-card p-6 max-w-2xl">
        <h3 className="card-title !mb-2">Change Password</h3>
        <p className="text-sm text-gray-500 dark:text-theme-muted mb-6">
          Enter your current password to set a new one.
        </p>

        {passwordError && (
          <div className="mb-4 p-3 alert-error text-red-700 rounded-lg text-sm">{passwordError}</div>
        )}
        {passwordSuccess && (
          <div className="mb-4 p-3 alert-success text-green-700 rounded-lg text-sm">{passwordSuccess}</div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">Current Password</label>
            <PasswordInput
              required
              autoComplete="current-password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-surface-border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">New Password</label>
            <PasswordInput
              required
              minLength={8}
              autoComplete="new-password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-surface-border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Min 8 characters"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">Confirm New Password</label>
            <PasswordInput
              required
              minLength={8}
              autoComplete="new-password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-surface-border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" disabled={passwordSubmitting} className="btn-primary disabled:opacity-50">
            {passwordSubmitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
