'use client';

/**
 * The theme control (Settings → Appearance): light, dark or follow the system.
 * Writes through useTheme (localStorage `am-fincorp-theme`, applied before paint by the
 * inline script). Radio semantics: one choice, arrow keys move between options.
 */
import React from 'react';
import { Check, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { THEME_OPTION_META, THEME_PREFERENCES } from './config';
import { useTheme } from './useTheme';
import type { ThemePreference } from './types';

const THEME_ICONS: Record<ThemePreference, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export default function ThemePicker() {
  const { preference, resolved, setPreference } = useTheme();
  const refs = React.useRef(new Map<ThemePreference, HTMLButtonElement>());

  const move = (event: React.KeyboardEvent, index: number) => {
    let next = -1;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % THEME_PREFERENCES.length;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + THEME_PREFERENCES.length) % THEME_PREFERENCES.length;
    if (next < 0) return;
    event.preventDefault();
    const value = THEME_PREFERENCES[next];
    setPreference(value);
    refs.current.get(value)?.focus();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Currently using <span className="font-medium text-foreground">{resolved}</span> mode
        {preference === 'system' ? ' (from system)' : ''}.
      </p>

      <div role="radiogroup" aria-label="Theme" className="grid gap-3">
        {THEME_PREFERENCES.map((value, index) => {
          const selected = preference === value;
          const { label, description } = THEME_OPTION_META[value];
          const Icon = THEME_ICONS[value];

          return (
            <button
              key={value}
              ref={(node) => {
                if (node) refs.current.set(value, node);
                else refs.current.delete(value);
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setPreference(value)}
              onKeyDown={(event) => move(event, index)}
              className={cn(
                'w-full rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected ? 'border-primary bg-primary-subtle' : 'hover:bg-accent'
              )}
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg',
                    selected ? 'bg-primary/15 text-primary-text' : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{label}</p>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <div
                  aria-hidden="true"
                  className={cn(
                    'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2',
                    selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                  )}
                >
                  {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
