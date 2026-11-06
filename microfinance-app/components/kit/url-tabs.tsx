'use client';

/**
 * Tabs whose selection lives in the URL (`?tab=…`, replace, default omitted), so a
 * detail page reopens on the same tab after refresh or Back.
 *
 *   const tabs = useUrlTabs({ values: ['overview', 'repayments'] as const, defaultValue: 'overview' });
 *   <UrlTabs tabs={tabs} items={[{ value: 'overview', label: 'Overview' }, …]} aria-label="Loan sections" />
 *   <UrlTabPanel tabs={tabs} value="overview">…</UrlTabPanel>
 *
 * On swipe pages keep SwipeableTabs for the panels and drive it from `tabs.value`
 * / `tabs.setValue`; UrlTabs owns only the tab bar and the URL.
 * Pages never import nuqs directly.
 */
import * as React from 'react';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { cn } from '@/lib/utils';
import { useHydrated } from '@/hooks/use-hydrated';

export interface UrlTabsController<V extends string> {
  value: V;
  setValue: (value: V) => void;
  values: readonly V[];
  /** id of a tab button / panel, for aria wiring */
  tabId: (value: V) => string;
  panelId: (value: V) => string;
}

export function useUrlTabs<V extends string>({ values, defaultValue, param = 'tab' }: { values: readonly V[]; defaultValue: V; param?: string }): UrlTabsController<V> {
  const valuesKey = values.join('|');
  const parser = React.useMemo(
    () => parseAsStringLiteral(valuesKey.split('|') as V[]).withDefault(defaultValue),
    [valuesKey, defaultValue]
  );
  const [urlValue, setRaw] = useQueryState(param, parser.withOptions({ history: 'replace', shallow: true, scroll: false, clearOnDefault: true }));
  // Prerendered HTML has no search params: show the default tab until hydration is over.
  const hydrated = useHydrated();
  const value = hydrated ? urlValue : defaultValue;
  const baseId = React.useId();
  return {
    value: value as V,
    setValue: React.useCallback((next: V) => void setRaw(next), [setRaw]),
    values,
    tabId: (v: V) => `${baseId}-tab-${v}`,
    panelId: (v: V) => `${baseId}-panel-${v}`,
  };
}

export interface UrlTabItem<V extends string> {
  value: V;
  label: React.ReactNode;
  /** Small count after the label, e.g. Repayments (24). */
  count?: number;
  disabled?: boolean;
}

export interface UrlTabsProps<V extends string> {
  tabs: UrlTabsController<V>;
  items: UrlTabItem<V>[];
  'aria-label': string;
  className?: string;
}

/** Underlined tab bar in the primary colour; scrolls sideways on phones. Arrow keys move between tabs. */
export function UrlTabs<V extends string>({ tabs, items, className, ...props }: UrlTabsProps<V>) {
  const refs = React.useRef(new Map<V, HTMLButtonElement>());
  const enabled = items.filter((i) => !i.disabled);

  const focusTab = (value: V) => {
    tabs.setValue(value);
    refs.current.get(value)?.focus();
    refs.current.get(value)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  const onKeyDown = (event: React.KeyboardEvent, current: V) => {
    const index = enabled.findIndex((i) => i.value === current);
    let next: UrlTabItem<V> | undefined;
    if (event.key === 'ArrowRight') next = enabled[(index + 1) % enabled.length];
    else if (event.key === 'ArrowLeft') next = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (event.key === 'Home') next = enabled[0];
    else if (event.key === 'End') next = enabled[enabled.length - 1];
    if (next) {
      event.preventDefault();
      focusTab(next.value);
    }
  };

  return (
    <div className={cn('-mx-4 mb-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0', className)}>
      <div role="tablist" aria-label={props['aria-label']} className="flex min-w-max gap-1">
        {items.map((item) => {
          const selected = item.value === tabs.value;
          return (
            <button
              key={item.value}
              ref={(node) => {
                if (node) refs.current.set(item.value, node);
                else refs.current.delete(item.value);
              }}
              type="button"
              role="tab"
              id={tabs.tabId(item.value)}
              aria-controls={tabs.panelId(item.value)}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => tabs.setValue(item.value)}
              onKeyDown={(event) => onKeyDown(event, item.value)}
              className={cn(
                'relative -mb-px inline-flex h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
                selected
                  ? 'border-primary text-primary-text'
                  : 'border-transparent text-muted-foreground hover:border-input hover:text-foreground'
              )}
            >
              {item.label}
              {typeof item.count === 'number' ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-xs tabular-nums',
                    selected ? 'bg-primary-subtle text-primary-text' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface UrlTabPanelProps<V extends string> extends React.HTMLAttributes<HTMLDivElement> {
  tabs: UrlTabsController<V>;
  value: V;
  /** Keep the panel mounted when hidden (preserves its state). Default false. */
  keepMounted?: boolean;
}

export function UrlTabPanel<V extends string>({ tabs, value, keepMounted = false, className, children, ...props }: UrlTabPanelProps<V>) {
  const selected = tabs.value === value;
  if (!selected && !keepMounted) return null;
  return (
    <div
      role="tabpanel"
      id={tabs.panelId(value)}
      aria-labelledby={tabs.tabId(value)}
      hidden={!selected}
      tabIndex={0}
      className={cn('focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md', className)}
      {...props}
    >
      {children}
    </div>
  );
}
