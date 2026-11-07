'use client';

/**
 * Settings: the signed-in account (read-only) and the change-password form.
 * The request is the one this page always sent: `authAPI.changePassword` →
 * POST /api/user?action=change-password `{ currentPassword, newPassword }`; the
 * confirmation is only compared in the browser and never sent.
 */
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { authAPI } from '../../lib/api';
import { usePartner } from '../contexts/PartnerContext';
import PasswordInput from '../components/ui/PasswordInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { FormActions } from '@/components/kit/form-actions';
import { FormField } from '@/components/kit/form-field';
import { FormSection } from '@/components/kit/form-section';
import { ErrorState } from '@/components/kit/error-state';

const EMPTY_PASSWORDS = { currentPassword: '', newPassword: '', confirmPassword: '' };

export default function ProfileSettings() {
  // The account is already loaded by PartnerContext (/api/user?action=me).
  const { currentUser, loading, error: accountError, refreshPartners } = usePartner();

  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORDS);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordSubmitting) return;
    setPasswordError(null);
    setMismatch(false);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMismatch(true);
      return;
    }

    setPasswordSubmitting(true);
    try {
      await authAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm(EMPTY_PASSWORDS);
      toast.success('Password changed successfully.');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const profileLoading = loading && !currentUser;

  return (
    <>
      <FormSection title="Profile" description="Your account details. Contact an administrator to change these.">
        {!profileLoading && !currentUser && accountError ? (
          <ErrorState compact title="Couldn't load your account" error={accountError} onRetry={() => void refreshPartners()} className="md:col-span-2" />
        ) : null}
        <FormField label="Name">
          {profileLoading ? <Skeleton className="h-11 w-full md:h-9" /> : <Input type="text" disabled readOnly value={currentUser?.name ?? ''} />}
        </FormField>
        <FormField label="Email">
          {profileLoading ? <Skeleton className="h-11 w-full md:h-9" /> : <Input type="email" disabled readOnly value={currentUser?.email ?? ''} />}
        </FormField>
      </FormSection>

      <FormSection title="Change password" description="Enter your current password to set a new one." columns={1}>
        <form onSubmit={handlePasswordSubmit} className="max-w-md space-y-4">
          {passwordError ? (
            <p role="alert" className="rounded-md border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-text">
              {passwordError}
            </p>
          ) : null}
          <FormField label="Current password" required>
            <PasswordInput
              autoComplete="current-password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
            />
          </FormField>
          <FormField label="New password" required description="At least 8 characters.">
            <PasswordInput
              minLength={8}
              autoComplete="new-password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              placeholder="Min 8 characters"
            />
          </FormField>
          <FormField label="Confirm new password" required error={mismatch ? 'New password and confirmation do not match' : undefined}>
            <PasswordInput
              minLength={8}
              autoComplete="new-password"
              value={passwordForm.confirmPassword}
              onChange={(e) => {
                setMismatch(false);
                setPasswordForm({ ...passwordForm, confirmPassword: e.target.value });
              }}
            />
          </FormField>
          <FormActions sticky={false} align="end" className="sm:justify-start">
            <Button type="submit" disabled={passwordSubmitting} aria-busy={passwordSubmitting || undefined}>
              {passwordSubmitting ? <Loader2 aria-hidden="true" className="motion-safe:animate-spin" /> : null}
              {passwordSubmitting ? 'Updating…' : 'Update password'}
            </Button>
          </FormActions>
        </form>
      </FormSection>
    </>
  );
}
