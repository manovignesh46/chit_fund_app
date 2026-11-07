'use client';

/**
 * Sign in. Rendered without the app shell (nav-config `isShellless`).
 * Inputs `#username` and `#password` are relied on by tests and scripts: keep the ids.
 * The request, the stored partner keys and the `?from=` / `?error=` handling are the ones
 * this page always had.
 */
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { authAPI } from '../../lib/api';
import PasswordInput from '../components/ui/PasswordInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'access_denied') {
      setError('Access denied. Please contact your administrator.');
    } else if (errorParam === 'session_expired') {
      setError('Your session has expired. Please log in again.');
    }

    const checkAuth = async () => {
      try {
        const userData = await authAPI.getCurrentUser();
        if (userData) {
          const from = searchParams.get('from') || '/dashboard';
          router.push(from);
        }
      } catch (error) {
        // Not logged in
      }
    };

    checkAuth();
  }, [router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login(username.trim(), password);

      if (response?.partner && typeof window !== 'undefined') {
        localStorage.setItem('selectedPartnerId', String(response.partner.id));
        localStorage.setItem('selectedPartnerName', response.partner.name);
      } else if (response?.name && typeof window !== 'undefined') {
        // Admin login without linked partner
        localStorage.removeItem('selectedPartnerId');
        localStorage.removeItem('selectedPartnerName');
      }

      const from = searchParams.get('from') || '/dashboard';
      // Deliberately a full page load, not router.push: the signed-in identity has just
      // changed, so every client cache, context (partner, user) and SSE connection must
      // start again from scratch for the new account.
      window.location.href = from;
    } catch (error: unknown) {
      setError((error instanceof Error && error.message) || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  const disabled = loading || !username.trim();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-xl border bg-card p-6 text-card-foreground shadow-md sm:p-10">
        <div className="text-center">
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">AM Fincorp</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in with your username or email</p>
        </div>

        {error ? (
          <div role="alert" className="rounded-md border border-destructive-border bg-destructive-subtle px-4 py-3 text-sm text-destructive-text">
            {error}
          </div>
        ) : null}

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-sm font-medium text-foreground">
              Username or Email
            </Label>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              placeholder="e.g. Username or partner@email.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={disabled} className="w-full" aria-busy={loading || undefined}>
            {loading ? <Loader2 aria-hidden="true" className="motion-safe:animate-spin" /> : null}
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
