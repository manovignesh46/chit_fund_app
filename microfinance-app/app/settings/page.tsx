'use client';

/**
 * Settings (Form template): profile (read-only), change password, appearance.
 */
import React from 'react';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { FormSection } from '@/components/kit/form-section';
import { ThemePicker } from '../theme';
import ProfileSettings from './ProfileSettings';

export default function SettingsPage() {
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Settings" description="Your account and how the app looks." />
      <div className="space-y-6">
        <ProfileSettings />
        <FormSection title="Appearance" description="Choose how AM Fincorp looks." columns={1}>
          <ThemePicker />
        </FormSection>
      </div>
    </PageContainer>
  );
}
