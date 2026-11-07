'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { NativeSelect } from './native-select';
import { PAGE_SIZES } from '@/lib/list/types';

export interface ListPaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  /** Shows the rows-per-page select when given. */
  onPageSizeChange?: (pageSize: number) => void;
  pageSizes?: readonly number[];
  disabled?: boolean;
  className?: string;
}

/** "11–20 of 143" */
export function formatRange(page: number, pageSize: number, totalCount: number): string {
  if (totalCount === 0) return '0 results';
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  const n = (v: number) => v.toLocaleString('en-IN');
  return `${n(from)}–${n(to)} of ${n(totalCount)}`;
}

/** Page numbers with ellipses: 1 … 4 [5] 6 … 20 */
export function pageItems(page: number, totalPages: number): Array<number | 'ellipsis-start' | 'ellipsis-end'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const items: Array<number | 'ellipsis-start' | 'ellipsis-end'> = [1];
  const start = Math.max(2, Math.min(page - 1, totalPages - 4));
  const end = Math.min(totalPages - 1, Math.max(page + 1, 5));
  if (start > 2) items.push('ellipsis-start');
  for (let p = start; p <= end; p++) items.push(p);
  if (end < totalPages - 1) items.push('ellipsis-end');
  items.push(totalPages);
  return items;
}

/**
 * Footer for paged lists. Desktop: rows per page, range, Prev 1 … 4 [5] 6 … 20 Next.
 * Phone: full-width Prev | Page 5 of 20 | Next with 44px targets.
 */
export function ListPagination({ page, pageSize, totalCount, onPageChange, onPageSizeChange, pageSizes = PAGE_SIZES, disabled = false, className }: ListPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)));
  const current = Math.min(Math.max(1, page), totalPages);
  const canPrev = current > 1 && !disabled;
  const canNext = current < totalPages && !disabled;
  const sizeId = React.useId();

  return (
    <nav aria-label="Pagination" className={cn('flex flex-col gap-3 md:flex-row md:items-center md:justify-between', className)}>
      <div className="hidden items-center gap-4 text-sm text-muted-foreground md:flex">
        {onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <label htmlFor={sizeId} className="whitespace-nowrap">
              Rows per page
            </label>
            <NativeSelect
              id={sizeId}
              size="sm"
              className="w-[4.75rem]"
              value={String(pageSize)}
              disabled={disabled}
              onValueChange={(v) => onPageSizeChange(Number(v))}
              options={pageSizes.map((s) => ({ value: String(s), label: String(s) }))}
            />
          </div>
        ) : null}
        <span className="tabular-nums" aria-live="polite">
          {formatRange(current, pageSize, totalCount)}
        </span>
      </div>

      {/* Desktop page list */}
      <div className="hidden items-center gap-1 md:flex">
        <Button variant="ghost" size="sm" onClick={() => onPageChange(current - 1)} disabled={!canPrev} aria-label="Previous page">
          <ChevronLeft aria-hidden="true" />
          Prev
        </Button>
        {pageItems(current, totalPages).map((item) =>
          typeof item === 'number' ? (
            <Button
              key={item}
              variant={item === current ? 'default' : 'ghost'}
              size="sm"
              className="min-w-8 px-2 tabular-nums"
              aria-label={`Page ${item}`}
              aria-current={item === current ? 'page' : undefined}
              disabled={disabled && item !== current}
              onClick={() => item !== current && onPageChange(item)}
            >
              {item}
            </Button>
          ) : (
            <span key={item} aria-hidden="true" className="px-1 text-sm text-muted-foreground">
              …
            </span>
          )
        )}
        <Button variant="ghost" size="sm" onClick={() => onPageChange(current + 1)} disabled={!canNext} aria-label="Next page">
          Next
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      {/* Phone */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:hidden">
        <Button variant="outline" onClick={() => onPageChange(current - 1)} disabled={!canPrev} aria-label="Previous page">
          <ChevronLeft aria-hidden="true" />
          Prev
        </Button>
        <span className="px-2 text-center text-sm tabular-nums text-muted-foreground" aria-live="polite">
          Page {current} of {totalPages}
        </span>
        <Button variant="outline" onClick={() => onPageChange(current + 1)} disabled={!canNext} aria-label="Next page">
          Next
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
      {onPageSizeChange ? (
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground md:hidden">
          <span className="tabular-nums">{formatRange(current, pageSize, totalCount)}</span>
          <NativeSelect
            aria-label="Rows per page"
            size="sm"
            className="w-32"
            value={String(pageSize)}
            disabled={disabled}
            onValueChange={(v) => onPageSizeChange(Number(v))}
            options={pageSizes.map((s) => ({ value: String(s), label: `${s} / page` }))}
          />
        </div>
      ) : null}
    </nav>
  );
}
