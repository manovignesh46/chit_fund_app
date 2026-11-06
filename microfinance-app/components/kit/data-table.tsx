'use client';

/**
 * The one data table (SPEC "List contract").
 *
 * Server mode (default): `rows` is one page from the API, already sorted; header
 * clicks call `onSortChange` (wire it to useListParams). Client mode: `rows` is the
 * whole dataset; sorting (and optional paging) happens here.
 *
 * Loading behaviour:
 *  - first load with nothing cached (`isInitialLoading`): skeleton rows of the same height
 *  - refetch (`isRefreshing`): previous rows stay, dimmed, `aria-busy`, and a thin
 *    progress bar appears after 150 ms — never a skeleton, never blank
 *  - root carries data-state="loading|refreshing|ready"
 *
 * Phones: with `renderCard`, rows become stacked cards below `md`; without it the
 * table scrolls sideways with a sticky first column.
 */
import * as React from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import type { SortOrder } from '@/lib/list/types';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { ListPagination, type ListPaginationProps } from './list-pagination';

export type RowId = string | number;

export interface SortState {
  sort: string | null;
  order: SortOrder | null;
}

export interface DataTableColumn<T> {
  /** Unique id; also the sort key unless `sortKey` is given. */
  id: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  /** Right-aligned, tabular numerals (amounts, counts). */
  numeric?: boolean;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  /** API sort key (server mode). Defaults to `id`. */
  sortKey?: string;
  /** Value to sort by in client mode. Defaults to `row[id]`. */
  sortValue?: (row: T) => string | number | Date | null | undefined;
  /** Hide the column below this breakpoint. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
  /** CSS width, e.g. '8rem'. */
  width?: string;
  className?: string;
  headerClassName?: string;
}

export interface DataTableSelection<T> {
  selected: ReadonlySet<RowId>;
  onChange: (next: Set<RowId>) => void;
  /** Accessible label for a row's checkbox. */
  rowLabel?: (row: T) => string;
}

export interface DataTableProps<T> {
  /** Accessible name of the table, e.g. "Loans". */
  label: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => RowId;
  mode?: 'server' | 'client';
  isInitialLoading?: boolean;
  isRefreshing?: boolean;
  /** A load error. Shown in place of rows when there are none; otherwise rows stay. */
  error?: unknown;
  onRetry?: () => void;
  /** Controlled sort. In client mode it may be omitted (sort is then internal). */
  sort?: SortState;
  onSortChange?: (next: SortState) => void;
  /** Footer pagination (server mode, or client mode with your own paging). */
  pagination?: Omit<ListPaginationProps, 'className'>;
  /** Client mode: page the rows locally with this page size. */
  clientPageSize?: number;
  /** Phone card renderer (below md). */
  renderCard?: (row: T, index: number) => React.ReactNode;
  /** Shown when loaded with zero rows. Default: a generic "Nothing here yet". */
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
  /** Hover/focus/touch on a row: use it to prefetch the detail. */
  onRowIntent?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  selection?: DataTableSelection<T>;
  /** Skeleton row count on first load. Default: pagination page size or 10. */
  skeletonRows?: number;
  className?: string;
}

const HIDE_BELOW: Record<NonNullable<DataTableColumn<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

function nextSort(current: SortState, key: string): SortState {
  if (current.sort !== key) return { sort: key, order: 'asc' };
  if (current.order === 'asc') return { sort: key, order: 'desc' };
  return { sort: null, order: null };
}

function compareValues(a: unknown, b: unknown): number {
  const empty = (v: unknown) => v === null || v === undefined || v === '';
  if (empty(a) && empty(b)) return 0;
  if (empty(a)) return 1;
  if (empty(b)) return -1;
  const norm = (v: unknown) => (v instanceof Date ? v.getTime() : v);
  const x = norm(a);
  const y = norm(b);
  if (typeof x === 'number' && typeof y === 'number') return x - y;
  return String(x).localeCompare(String(y), 'en-IN', { numeric: true, sensitivity: 'base' });
}

/** True after `value` has stayed true for `delay` ms. */
function useDelayedFlag(value: boolean, delay: number): boolean {
  const [flag, setFlag] = React.useState(false);
  React.useEffect(() => {
    if (!value) {
      setFlag(false);
      return;
    }
    const timer = setTimeout(() => setFlag(true), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return flag;
}

function ProgressBar({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden transition-opacity duration-150',
        visible ? 'opacity-100' : 'opacity-0'
      )}
    >
      <div className="h-full w-2/5 animate-progress-indeterminate bg-primary" />
    </div>
  );
}

function alignClass(column: { align?: 'left' | 'center' | 'right'; numeric?: boolean }): string {
  const align = column.align ?? (column.numeric ? 'right' : 'left');
  return align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
}

export function DataTable<T>({
  label,
  columns,
  rows,
  getRowId,
  mode = 'server',
  isInitialLoading = false,
  isRefreshing = false,
  error,
  onRetry,
  sort,
  onSortChange,
  pagination,
  clientPageSize,
  renderCard,
  emptyState,
  onRowClick,
  onRowIntent,
  rowClassName,
  selection,
  skeletonRows,
  className,
}: DataTableProps<T>) {
  // ── Sorting ──
  const [localSort, setLocalSort] = React.useState<SortState>({ sort: null, order: null });
  const sortState = sort ?? localSort;
  const canSort = mode === 'client' || !!onSortChange;
  const changeSort = (key: string) => {
    const next = nextSort(sortState, key);
    if (onSortChange) onSortChange(next);
    if (!sort) setLocalSort(next);
  };

  const sortedRows = React.useMemo(() => {
    if (mode !== 'client' || !sortState.sort || !sortState.order) return rows;
    const column = columns.find((c) => (c.sortKey ?? c.id) === sortState.sort);
    if (!column) return rows;
    const read = column.sortValue ?? ((row: T) => (row as unknown as Record<string, unknown>)[column.id] as string | number | null);
    const direction = sortState.order === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => compareValues(read(a), read(b)) * direction);
  }, [mode, rows, columns, sortState.sort, sortState.order]);

  // ── Client paging ──
  const [clientPage, setClientPage] = React.useState(1);
  React.useEffect(() => setClientPage(1), [sortState.sort, sortState.order, rows.length]);
  const pagedRows =
    mode === 'client' && clientPageSize
      ? sortedRows.slice((clientPage - 1) * clientPageSize, clientPage * clientPageSize)
      : sortedRows;
  const footer =
    pagination ??
    (mode === 'client' && clientPageSize && rows.length > clientPageSize
      ? { page: clientPage, pageSize: clientPageSize, totalCount: rows.length, onPageChange: setClientPage }
      : undefined);

  // ── Selection: cleared whenever the visible set of rows changes ──
  const rowIdsKey = pagedRows.map((r) => String(getRowId(r))).join('|');
  const selectionRef = React.useRef(selection);
  selectionRef.current = selection;
  React.useEffect(() => {
    const current = selectionRef.current;
    if (current && current.selected.size > 0) current.onChange(new Set());
  }, [rowIdsKey]);

  const selectedOnPage = selection ? pagedRows.filter((r) => selection.selected.has(getRowId(r))).length : 0;
  const allSelected = selection !== undefined && pagedRows.length > 0 && selectedOnPage === pagedRows.length;
  const someSelected = selectedOnPage > 0 && !allSelected;

  const toggleAll = () => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (allSelected) pagedRows.forEach((r) => next.delete(getRowId(r)));
    else pagedRows.forEach((r) => next.add(getRowId(r)));
    selection.onChange(next);
  };
  const toggleRow = (row: T) => {
    if (!selection) return;
    const id = getRowId(row);
    const next = new Set(selection.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selection.onChange(next);
  };

  // ── State ──
  const showProgress = useDelayedFlag(isRefreshing, 150);
  const state = isInitialLoading ? 'loading' : isRefreshing ? 'refreshing' : 'ready';
  const showError = !isInitialLoading && !!error && pagedRows.length === 0;
  const showEmpty = !isInitialLoading && !error && pagedRows.length === 0;
  const skeletonCount = skeletonRows ?? pagination?.pageSize ?? clientPageSize ?? 10;
  const colCount = columns.length + (selection ? 1 : 0);
  const stickyFirst = !renderCard;

  const rowInteraction = (row: T) => ({
    onClick: onRowClick ? () => onRowClick(row) : undefined,
    onKeyDown: onRowClick
      ? (event: React.KeyboardEvent) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onRowClick(row);
          }
        }
      : undefined,
    tabIndex: onRowClick ? 0 : undefined,
    onMouseEnter: onRowIntent ? () => onRowIntent(row) : undefined,
    onFocus: onRowIntent ? () => onRowIntent(row) : undefined,
    onTouchStart: onRowIntent ? () => onRowIntent(row) : undefined,
  });

  const stateBlock = showError ? (
    <ErrorState error={error} onRetry={onRetry} compact />
  ) : showEmpty ? (
    emptyState ?? <EmptyState compact />
  ) : null;

  const dim = isRefreshing ? 'opacity-60 transition-opacity duration-150' : 'transition-opacity duration-150';

  return (
    <div data-state={state} className={cn('space-y-3', className)}>
      {/* Table (all widths, or md+ when cards are used on phones) */}
      <div className={cn('relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm', renderCard && 'hidden md:block')}>
        <ProgressBar visible={showProgress} />
        <div className="overflow-x-auto">
          <table aria-label={label} aria-busy={isInitialLoading || isRefreshing || undefined} className="w-full caption-bottom border-collapse text-sm">
            <thead className="bg-elevated">
              <tr className="border-b">
                {selection ? (
                  <th scope="col" className="h-10 w-12 px-4">
                    <Checkbox
                      aria-label="Select all rows on this page"
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={toggleAll}
                      disabled={pagedRows.length === 0}
                    />
                  </th>
                ) : null}
                {columns.map((column, i) => {
                  const key = column.sortKey ?? column.id;
                  const sortable = canSort && column.sortable;
                  const active = sortState.sort === key && !!sortState.order;
                  const ariaSort = sortable ? (active ? (sortState.order === 'asc' ? 'ascending' : 'descending') : 'none') : undefined;
                  const SortIcon = active ? (sortState.order === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;
                  return (
                    <th
                      key={column.id}
                      scope="col"
                      aria-sort={ariaSort}
                      style={column.width ? { width: column.width } : undefined}
                      className={cn(
                        'h-10 whitespace-nowrap px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground',
                        alignClass(column),
                        column.hideBelow && HIDE_BELOW[column.hideBelow],
                        stickyFirst && i === 0 && !selection && 'sticky left-0 z-20 bg-elevated md:static',
                        column.headerClassName
                      )}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => changeSort(key)}
                          className={cn(
                            '-mx-2 inline-flex h-8 items-center gap-1 rounded-md px-2 uppercase tracking-wide hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            column.numeric && 'flex-row-reverse',
                            active && 'text-foreground'
                          )}
                        >
                          {column.header}
                          <SortIcon aria-hidden="true" className={cn('h-3.5 w-3.5 shrink-0', !active && 'opacity-50')} />
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className={dim}>
              {isInitialLoading
                ? Array.from({ length: skeletonCount }, (_, r) => (
                    <tr key={`sk-${r}`} className="h-12 border-b last:border-b-0">
                      {selection ? (
                        <td className="px-4">
                          <Skeleton className="h-4 w-4" />
                        </td>
                      ) : null}
                      {columns.map((column) => (
                        <td key={column.id} className={cn('px-4', alignClass(column), column.hideBelow && HIDE_BELOW[column.hideBelow])}>
                          <Skeleton className={cn('inline-block h-4', column.numeric ? 'w-16' : 'w-3/4 max-w-[10rem]')} />
                        </td>
                      ))}
                    </tr>
                  ))
                : pagedRows.map((row, r) => {
                    const id = getRowId(row);
                    const selected = selection?.selected.has(id) ?? false;
                    return (
                      <tr
                        key={String(id)}
                        data-state={selected ? 'selected' : undefined}
                        className={cn(
                          'group h-12 border-b transition-colors last:border-b-0 hover:bg-elevated data-[state=selected]:bg-primary-subtle',
                          onRowClick && 'cursor-pointer focus-visible:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                          rowClassName?.(row)
                        )}
                        {...rowInteraction(row)}
                      >
                        {selection ? (
                          <td className="w-12 px-4" onClick={(event) => event.stopPropagation()}>
                            <Checkbox
                              aria-label={selection.rowLabel?.(row) ?? `Select row ${r + 1}`}
                              checked={selected}
                              onCheckedChange={() => toggleRow(row)}
                            />
                          </td>
                        ) : null}
                        {columns.map((column, c) => (
                          <td
                            key={column.id}
                            className={cn(
                              'px-4 py-2 align-middle text-foreground',
                              alignClass(column),
                              column.numeric && 'whitespace-nowrap tabular-nums',
                              column.hideBelow && HIDE_BELOW[column.hideBelow],
                              stickyFirst && c === 0 && !selection &&
                                'sticky left-0 z-10 bg-card group-hover:bg-elevated group-data-[state=selected]:bg-primary-subtle md:static md:bg-transparent',
                              column.className
                            )}
                          >
                            {column.cell(row, r)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
              {stateBlock ? (
                <tr>
                  <td colSpan={colCount}>{stateBlock}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phone cards */}
      {renderCard ? (
        <div className="relative md:hidden" aria-busy={isInitialLoading || isRefreshing || undefined}>
          <ProgressBar visible={showProgress} />
          {stateBlock ? (
            <div className="rounded-xl border bg-card">{stateBlock}</div>
          ) : (
            <ul aria-label={label} className={cn('space-y-2', dim)}>
              {isInitialLoading
                ? Array.from({ length: Math.min(skeletonCount, 6) }, (_, r) => (
                    <li key={`skc-${r}`} className="rounded-xl border bg-card p-4">
                      <div className="flex items-center justify-between gap-3">
                        <Skeleton className="h-4 w-2/5" />
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </div>
                      <Skeleton className="mt-3 h-4 w-3/5" />
                      <Skeleton className="mt-2 h-4 w-1/3" />
                    </li>
                  ))
                : pagedRows.map((row, r) => (
                    <li
                      key={String(getRowId(row))}
                      className={cn(
                        'rounded-xl border bg-card p-4 text-card-foreground',
                        onRowClick && 'cursor-pointer active:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        rowClassName?.(row)
                      )}
                      {...rowInteraction(row)}
                    >
                      {renderCard(row, r)}
                    </li>
                  ))}
            </ul>
          )}
        </div>
      ) : null}

      {footer && !showError && (isInitialLoading || pagedRows.length > 0) ? (
        <ListPagination {...footer} disabled={footer.disabled || isInitialLoading} />
      ) : null}
    </div>
  );
}
