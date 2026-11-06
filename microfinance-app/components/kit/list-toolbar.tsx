'use client';

import * as React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DESKTOP_QUERY, useMediaQuery } from '@/hooks/use-media-query';

export interface ListToolbarProps {
  /** Usually <SearchInput />. */
  search?: React.ReactNode;
  /** The one filter that stays visible (e.g. a status NativeSelect). */
  primaryFilter?: React.ReactNode;
  /** Secondary filters, shown in a popover (desktop) or bottom sheet (phone) behind "Filters". */
  filters?: React.ReactNode;
  /** Number of active secondary filters, shown on the Filters button. */
  filterCount?: number;
  /** Sort control for phones (tables sort by header click on desktop). */
  sort?: React.ReactNode;
  /** Right-aligned actions: export, column options. */
  actions?: React.ReactNode;
  /** Second row: <FilterChips />. */
  chips?: React.ReactNode;
  /** Second row, right: e.g. formatRange(…) "11–20 of 143". */
  resultSummary?: React.ReactNode;
  className?: string;
}

const FiltersButton = React.forwardRef<HTMLButtonElement, ButtonProps & { count: number }>(({ count, ...props }, ref) => {
  return (
    <Button ref={ref} variant="outline" className="gap-2" {...props}>
      <SlidersHorizontal aria-hidden="true" />
      Filters
      {count > 0 ? (
        <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
          {count}
          <span className="sr-only"> active</span>
        </span>
      ) : null}
    </Button>
  );
});
FiltersButton.displayName = 'FiltersButton';

/** The list toolbar: same layout on every list (SPEC "List contract"). */
export function ListToolbar({ search, primaryFilter, filters, filterCount = 0, sort, actions, chips, resultSummary, className }: ListToolbarProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  const filterControl = filters ? (
    isDesktop ? (
      <Popover>
        <PopoverTrigger asChild>
          <FiltersButton count={filterCount} />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 space-y-4">
          <p className="text-sm font-semibold">Filters</p>
          {filters}
        </PopoverContent>
      </Popover>
    ) : (
      <Sheet>
        <SheetTrigger asChild>
          <FiltersButton count={filterCount} />
        </SheetTrigger>
        <SheetContent side="bottom" className="space-y-4">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription className="sr-only">Narrow down the list</SheetDescription>
          </SheetHeader>
          {filters}
        </SheetContent>
      </Sheet>
    )
  ) : null;

  return (
    <div className={cn('mb-4 space-y-3', className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {search ? <div className="w-full sm:w-auto sm:flex-1 sm:max-w-sm">{search}</div> : null}
        {primaryFilter || filterControl || sort ? (
          <div className="flex flex-wrap items-center gap-2">
            {primaryFilter}
            {filterControl}
            {sort ? <div className="md:hidden">{sort}</div> : null}
          </div>
        ) : null}
        {actions ? <div className="flex items-center gap-2 sm:ml-auto">{actions}</div> : null}
      </div>
      {chips || resultSummary ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">{chips}</div>
          {resultSummary ? <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite">{resultSummary}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
