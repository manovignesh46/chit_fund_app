'use client';

import React from 'react';
import {
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/outline';
import { THEME_OPTION_META, THEME_PREFERENCES } from './config';
import { themeText } from './classes';
import { useTheme } from './useTheme';
import type { ThemePreference } from './types';

const THEME_ICONS: Record<ThemePreference, React.ReactNode> = {
  light: <SunIcon className="w-5 h-5" />,
  dark: <MoonIcon className="w-5 h-5" />,
  system: <ComputerDesktopIcon className="w-5 h-5" />,
};

export default function ThemePicker() {
  const { preference, resolved, setPreference } = useTheme();

  return (
    <div className="themed-card p-6 max-w-2xl">
      <h3 className="card-title !mb-2">Appearance</h3>
      <p className={`${themeText.muted} text-sm mb-6`}>
        Choose how AM Fincorp looks. Currently using{' '}
        <span className={`${themeText.primary} font-medium`}>{resolved}</span> mode
        {preference === 'system' ? ' (from system)' : ''}.
      </p>

      <div className="grid gap-3">
        {THEME_PREFERENCES.map((value) => {
          const selected = preference === value;
          const { label, description } = THEME_OPTION_META[value];

          return (
            <button
              key={value}
              type="button"
              onClick={() => setPreference(value)}
              className={`w-full text-left p-4 rounded-xl border transition-colors ${
                selected
                  ? 'border-blue-500 bg-blue-500 bg-opacity-10'
                  : 'border-gray-200 dark:border-surface-border hover:bg-gray-50 dark:hover:bg-surface-hover'
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    selected ? 'text-blue-400' : themeText.muted
                  }`}
                  style={{
                    backgroundColor: selected
                      ? 'rgba(59, 130, 246, 0.15)'
                      : 'var(--color-surface-elevated)',
                  }}
                >
                  {THEME_ICONS[value]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`${themeText.primary} font-medium`}>{label}</p>
                  <p className={`${themeText.muted} text-sm`}>{description}</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selected ? 'border-blue-500' : 'border-gray-200 dark:border-surface-border'
                  }`}
                >
                  {selected && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
