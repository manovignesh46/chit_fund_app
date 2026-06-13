'use client';

import React, { createContext, useCallback, useEffect, useState } from 'react';
import { applyThemeToDocument, getSystemTheme, resolveTheme } from './resolve';
import { readStoredPreference, writeStoredPreference } from './storage';
import type { ResolvedTheme, ThemeContextValue, ThemePreference } from './types';

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [resolved, setResolved] = useState<ResolvedTheme>('light');

  const setPreference = useCallback((next: ThemePreference) => {
    writeStoredPreference(next);
    const nextResolved = resolveTheme(next);
    setPreferenceState(next);
    setResolved(nextResolved);
    applyThemeToDocument(nextResolved);
  }, []);

  useEffect(() => {
    const stored = readStoredPreference();
    const initialResolved = resolveTheme(stored);
    setPreferenceState(stored);
    setResolved(initialResolved);
    applyThemeToDocument(initialResolved);

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      if (readStoredPreference() === 'system') {
        const nextResolved = getSystemTheme();
        setResolved(nextResolved);
        applyThemeToDocument(nextResolved);
      }
    };

    media.addEventListener('change', onSystemChange);
    return () => media.removeEventListener('change', onSystemChange);
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}
