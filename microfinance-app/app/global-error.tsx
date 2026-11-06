'use client';

import '../styles/globals.css';
import { THEME_INIT_SCRIPT } from './theme/inline-script';

/**
 * Last-resort boundary: replaces the root layout when the layout itself fails,
 * so it renders its own <html>/<body>, stylesheet and theme script.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <title>Something went wrong · AM Fincorp</title>
      </head>
      <body className="bg-background text-foreground antialiased">
        <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center px-4 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            AM Fincorp could not load. Try again; if it keeps happening, reload the page.
          </p>
          {error.digest ? <p className="mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-9"
            >
              Try again
            </button>
            <a
              href="/dashboard"
              className="inline-flex h-11 items-center rounded-md border border-input bg-card px-4 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-9"
            >
              Go to dashboard
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
