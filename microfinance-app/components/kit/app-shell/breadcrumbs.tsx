'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getBreadcrumbs, type Crumb } from './nav-config';
import { useBreadcrumbLabels } from './breadcrumb-labels';

function useCrumbs(): Crumb[] {
  const pathname = usePathname();
  const labels = useBreadcrumbLabels();
  return React.useMemo(() => getBreadcrumbs(pathname, labels), [pathname, labels]);
}

/**
 * Top-bar location. From `md`: the full trail (Loans › Ravi Kumar › Repayments).
 * Below `md`: a back chevron to the nearest linked ancestor plus the current title.
 */
export function Breadcrumbs() {
  const crumbs = useCrumbs();
  const current = crumbs[crumbs.length - 1];
  const parent = [...crumbs.slice(0, -1)].reverse().find((crumb) => crumb.href);

  return (
    <>
      <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 md:block">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li key={crumb.path} className={`flex min-w-0 items-center gap-1.5 ${last ? 'shrink' : 'shrink-[2]'}`}>
                {index > 0 ? <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : null}
                {last ? (
                  <span aria-current="page" className="truncate font-medium text-foreground">
                    {crumb.label}
                  </span>
                ) : crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="truncate rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="truncate">{crumb.label}</span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex min-w-0 flex-1 items-center gap-1 md:hidden">
        {parent?.href ? (
          <Link
            href={parent.href}
            aria-label={`Back to ${parent.label}`}
            className="-ml-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          </Link>
        ) : (
          <Link
            href="/dashboard"
            aria-label="AM Fincorp, go to dashboard"
            className="mr-1.5 inline-flex h-11 shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              AF
            </span>
          </Link>
        )}
        <span className="truncate text-base font-semibold text-foreground">{current?.label}</span>
      </div>
    </>
  );
}
