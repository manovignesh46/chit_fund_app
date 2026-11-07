'use client';

/**
 * Chit fund templates (List template). List state lives in the URL (page, pageSize, q,
 * sort, order, type); search, filter, sort and paging run on the server. Archive is a
 * soft delete (existing chit funds are not affected) behind a confirmation.
 */
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Archive, Eye, Pencil, Plus, PlusCircle } from 'lucide-react';

import { toast } from '@/lib/toast';
import { useListParams } from '@/lib/list/useListParams';
import { useListQuery } from '@/lib/list/useListQuery';
import { ALL } from '@/lib/list/types';
import { invalidateTemplates, TEMPLATES, templateWrites, type ChitFundTemplate } from '@/lib/query/chit-fund-templates';
import { errorMessage } from '@/components/kit/error-state';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/kit/data-table';
import { EmptyState } from '@/components/kit/empty-state';
import { FilterChips } from '@/components/kit/filter-chips';
import { formatRange } from '@/components/kit/list-pagination';
import { ListToolbar } from '@/components/kit/list-toolbar';
import { Money } from '@/components/kit/money';
import { NativeSelect } from '@/components/kit/native-select';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { RowActions } from '@/components/kit/row-actions';
import { SearchInput } from '@/components/kit/search-input';

const SORTS = ['name', 'chitFundType', 'totalAmount', 'duration', 'membersCount', 'chitFunds', 'createdAt'] as const;
const FILTERS = ['type'] as const;
type Filter = (typeof FILTERS)[number];

const TYPE_OPTIONS = [
  { value: ALL, label: 'All types' },
  { value: 'Auction', label: 'Auction' },
  { value: 'Fixed', label: 'Fixed' },
];
const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'name:asc', label: 'Name, A to Z' },
  { value: 'totalAmount:desc', label: 'Largest total amount' },
  { value: 'chitFunds:desc', label: 'Most used' },
];

function TypeTag({ type }: { type: string }) {
  return (
    <span className="inline-flex h-6 items-center rounded-full border bg-muted px-2 text-xs font-medium text-muted-foreground">{type}</span>
  );
}

export default function ChitFundTemplatesPage() {
  return (
    <PageContainer>
      <TemplatesList />
    </PageContainer>
  );
}

function TemplatesList() {
  const router = useRouter();
  // Default sort sent explicitly so the server adds the id tiebreaker (stable pages).
  const list = useListParams<Filter>({ id: 'chit-fund-templates', filters: FILTERS, defaults: { sort: 'createdAt', order: 'desc' }, sortable: SORTS });
  const query = useListQuery<ChitFundTemplate>(TEMPLATES, list, { itemsKey: 'templates' });
  const meta = query.meta;

  const archive = async (template: ChitFundTemplate) => {
    try {
      await templateWrites.archive(template.id);
    } catch (error) {
      throw new Error(errorMessage(error) ?? 'Failed to archive template');
    }
    toast.success('Template archived', { description: `${template.name}. Existing chit funds are not affected.` });
    void invalidateTemplates();
  };

  const columns: DataTableColumn<ChitFundTemplate>[] = [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      cell: (t) => (
        <Link
          href={`/chit-fund-templates/${t.id}`}
          className="font-medium text-foreground hover:text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t.name}
        </Link>
      ),
    },
    { id: 'chitFundType', header: 'Type', sortable: true, cell: (t) => <TypeTag type={t.chitFundType} /> },
    { id: 'totalAmount', header: 'Total amount', numeric: true, sortable: true, cell: (t) => <Money value={t.totalAmount} tone="plain" /> },
    { id: 'duration', header: 'Duration', numeric: true, sortable: true, cell: (t) => `${t.duration} mo` },
    { id: 'membersCount', header: 'Members', numeric: true, sortable: true, cell: (t) => t.membersCount },
    { id: 'chitFunds', header: 'Used by', numeric: true, sortable: true, cell: (t) => t._count?.chitFunds ?? 0 },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      width: '3.5rem',
      align: 'right',
      cell: (t) => (
        <RowActions
          label={`Actions for ${t.name}`}
          actions={[
            { label: 'View', icon: Eye, href: `/chit-fund-templates/${t.id}` },
            { label: 'Create fund', icon: PlusCircle, href: `/chit-funds/new?template=${t.id}` },
            { label: 'Edit', icon: Pencil, href: `/chit-fund-templates/${t.id}/edit` },
            {
              label: 'Archive',
              icon: Archive,
              destructive: true,
              separatorBefore: true,
              confirm: {
                title: `Archive template "${t.name}"?`,
                description: 'Existing chit funds are not affected. Archived templates are no longer offered when creating a chit fund.',
                confirmLabel: 'Archive',
                onConfirm: () => archive(t),
              },
            },
          ]}
        />
      ),
    },
  ];

  const chips = list.activeFilters.map((f) => ({
    key: f.name,
    label: f.name === 'q' ? `Search: ${f.value}` : `Type: ${f.value}`,
    onRemove: () => list.setParams({ [f.name]: null } as Parameters<typeof list.setParams>[0]),
  }));

  const emptyState = list.isFiltered ? (
    <EmptyState variant="no-results" onClearFilters={list.clearFilters} />
  ) : (
    <EmptyState
      title="No templates yet."
      description="A template stores a chit fund's amounts and duration, so new funds start from it."
      action={
        <Button size="sm" asChild>
          <Link href="/chit-fund-templates/new">
            <Plus aria-hidden="true" />
            Create your first template
          </Link>
        </Button>
      }
    />
  );

  return (
    <div>
      <PageHeader
        title="Chit fund templates"
        count={meta?.totalCount}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/chit-funds">Chit funds</Link>
            </Button>
            <Button asChild>
              <Link href="/chit-fund-templates/new">
                <Plus aria-hidden="true" />
                New template
              </Link>
            </Button>
          </>
        }
      />

      <ListToolbar
        search={<SearchInput value={list.params.q} onChange={(q) => list.setParams({ q })} placeholder="Search templates" label="Search templates by name or description" />}
        primaryFilter={
          <NativeSelect
            aria-label="Type"
            className="w-36"
            value={list.params.type ?? ALL}
            onValueChange={(value) => list.setParams({ type: value === ALL ? null : value })}
            options={TYPE_OPTIONS}
          />
        }
        sort={
          <NativeSelect
            aria-label="Sort by"
            size="sm"
            value={list.params.sort ? `${list.params.sort}:${list.params.order ?? 'asc'}` : 'createdAt:desc'}
            onValueChange={(value) => {
              if (value === 'createdAt:desc') return list.setParams({ sort: null, order: null });
              const [sort, order] = value.split(':');
              list.setParams({ sort, order: order as 'asc' | 'desc' });
            }}
            options={SORT_OPTIONS}
          />
        }
        chips={<FilterChips chips={chips} onClearAll={list.clearFilters} />}
        resultSummary={meta ? formatRange(meta.page, meta.pageSize, meta.totalCount) : null}
      />

      <DataTable<ChitFundTemplate>
        label="Chit fund templates"
        columns={columns}
        rows={query.items}
        getRowId={(t) => t.id}
        isInitialLoading={query.isInitialLoading}
        isRefreshing={query.isRefreshing}
        error={query.error}
        onRetry={() => void query.mutate()}
        sort={{ sort: list.params.sort, order: list.params.order }}
        onSortChange={(next) => list.setParams({ sort: next.sort, order: next.order })}
        onRowClick={(t) => router.push(`/chit-fund-templates/${t.id}`)}
        emptyState={emptyState}
        pagination={
          meta
            ? {
                page: meta.page,
                pageSize: list.params.pageSize,
                totalCount: meta.totalCount,
                onPageChange: (page) => list.setParams({ page }),
                onPageSizeChange: (pageSize) => list.setParams({ pageSize }),
              }
            : undefined
        }
      />
    </div>
  );
}
