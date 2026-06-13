'use client';

import React from 'react';
import PageSectionHeader from '../components/layout/PageSectionHeader';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { ThemePicker } from '../theme';

export default function SettingsPage() {
  return (
    <div className="page-container">
      <PageSectionHeader
        icon={<Cog6ToothIcon className="w-5 h-5" />}
        title="Settings"
        subtitle="Customize your application experience"
      />
      <ThemePicker />
    </div>
  );
}
