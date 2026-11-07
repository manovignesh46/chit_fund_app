'use client';

/**
 * Human labels for dynamic breadcrumb levels ("Ravi Kumar" instead of "Loan #12").
 *
 *   useBreadcrumbLabel(`/loans/${id}`, loan?.borrower?.name);
 *
 * Call it once the name is known (undefined/empty is ignored, so it can run on every
 * render). Labels are kept for the session, so child pages (/loans/12/repayments)
 * show the name without setting it again. Pages that never call it keep the
 * fallback from nav-config ("Loan #12").
 */
import * as React from 'react';

type Labels = Readonly<Record<string, string>>;

const MAX_LABELS = 200;
const EMPTY: Labels = Object.freeze({});

interface LabelStore {
  set(path: string, label: string): void;
  subscribe(listener: () => void): () => void;
  get(): Labels;
}

function createLabelStore(): LabelStore {
  let labels: Labels = EMPTY;
  const listeners = new Set<() => void>();
  return {
    set(path, label) {
      if (labels[path] === label) return;
      const next: Record<string, string> = { ...labels };
      delete next[path];
      next[path] = label;
      const keys = Object.keys(next);
      for (let i = 0; i < keys.length - MAX_LABELS; i++) delete next[keys[i]];
      labels = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get: () => labels,
  };
}

const BreadcrumbLabelsContext = React.createContext<LabelStore | null>(null);

export function BreadcrumbLabelsProvider({ children }: { children: React.ReactNode }) {
  const [store] = React.useState(createLabelStore);
  return <BreadcrumbLabelsContext.Provider value={store}>{children}</BreadcrumbLabelsContext.Provider>;
}

/** Set the breadcrumb label for a concrete path such as `/loans/12`. No-op outside the shell. */
export function useBreadcrumbLabel(path: string | null | undefined, label: string | null | undefined): void {
  const store = React.useContext(BreadcrumbLabelsContext);
  const text = typeof label === 'string' ? label.trim() : label == null ? '' : String(label).trim();
  React.useEffect(() => {
    if (store && path && text) store.set(path, text);
  }, [store, path, text]);
}

const noopSubscribe = () => () => {};

/** All labels set so far (empty on the server and during hydration). */
export function useBreadcrumbLabels(): Labels {
  const store = React.useContext(BreadcrumbLabelsContext);
  return React.useSyncExternalStore(store ? store.subscribe : noopSubscribe, store ? store.get : () => EMPTY, () => EMPTY);
}
