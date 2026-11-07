'use client';

/**
 * Styleguide: every token, primitive and kit component in its states, plus a live
 * DataTable over the real loans endpoint wired through useListParams + useListQuery
 * (the nuqs / force-static spike and the data-layer integration test).
 */
import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Banknote,
  CalendarClock,
  Download,
  Eye,
  Moon,
  Pencil,
  Plus,
  Sun,
  Trash2,
  TriangleAlert,
  Users,
} from 'lucide-react';

import { useTheme } from '@/app/theme/useTheme';
import { formatDate, formatMoney, formatMoneyCompact } from '@/lib/format';
import { apiFetch } from '@/lib/query/fetcher';
import { keyToEndpoint } from '@/lib/query/keys';
import { useListParams } from '@/lib/list/useListParams';
import { useListQuery } from '@/lib/list/useListQuery';
import { ALL } from '@/lib/list/types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

import { ConfirmDialog } from '@/components/kit/confirm-dialog';
import { DataTable, type DataTableColumn, type RowId, type SortState } from '@/components/kit/data-table';
import { DateInput } from '@/components/kit/date-input';
import { DateText } from '@/components/kit/date-text';
import { DescriptionList } from '@/components/kit/description-list';
import { EmptyState } from '@/components/kit/empty-state';
import { EntityCombobox } from '@/components/kit/entity-combobox';
import { ErrorState } from '@/components/kit/error-state';
import { FilterChips } from '@/components/kit/filter-chips';
import { FormActions } from '@/components/kit/form-actions';
import { FormField } from '@/components/kit/form-field';
import { FormSection } from '@/components/kit/form-section';
import { formatRange, ListPagination } from '@/components/kit/list-pagination';
import { ListToolbar } from '@/components/kit/list-toolbar';
import { Money } from '@/components/kit/money';
import { NativeSelect } from '@/components/kit/native-select';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { ResponsiveDialog } from '@/components/kit/responsive-dialog';
import { RowActions } from '@/components/kit/row-actions';
import { SearchInput } from '@/components/kit/search-input';
import { SectionCard } from '@/components/kit/section-card';
import { StatCard } from '@/components/kit/stat-card';
import { STATUS_MAP } from '@/components/kit/status';
import { StatusBadge } from '@/components/kit/status-badge';
import { UrlTabPanel, UrlTabs, useUrlTabs } from '@/components/kit/url-tabs';

// ─────────────────────────────────────────────────────────────── tokens

const TOKEN_GROUPS: Array<{ title: string; tokens: string[] }> = [
  {
    title: 'Surfaces and text',
    tokens: ['background', 'foreground', 'card', 'popover', 'elevated', 'muted', 'muted-foreground', 'subtle-foreground', 'secondary', 'secondary-foreground', 'accent', 'accent-foreground', 'field', 'border', 'input', 'ring', 'overlay'],
  },
  { title: 'Primary (the one action colour)', tokens: ['primary', 'primary-foreground', 'primary-hover', 'primary-text', 'primary-subtle', 'primary-border'] },
  { title: 'Destructive', tokens: ['destructive', 'destructive-foreground', 'destructive-text', 'destructive-subtle', 'destructive-border'] },
  { title: 'Success', tokens: ['success', 'success-foreground', 'success-text', 'success-subtle', 'success-border'] },
  { title: 'Warning', tokens: ['warning', 'warning-foreground', 'warning-text', 'warning-subtle', 'warning-border'] },
  { title: 'Info', tokens: ['info-text', 'info-subtle', 'info-border'] },
  { title: 'Chart series (fixed order: 1 Loans, 2 Chit Funds)', tokens: ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'chart-6'] },
  {
    title: 'Sidebar',
    tokens: ['sidebar-background', 'sidebar-foreground', 'sidebar-primary', 'sidebar-primary-foreground', 'sidebar-accent', 'sidebar-accent-foreground', 'sidebar-border', 'sidebar-ring'],
  },
];

function toHex(rgb: string): string {
  const m = rgb.match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3) return rgb;
  return '#' + m.slice(0, 3).map((v) => Math.round(Number(v)).toString(16).padStart(2, '0')).join('');
}

function TokenSwatches() {
  const { resolved } = useTheme();
  const [values, setValues] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    const probe = document.createElement('div');
    document.body.appendChild(probe);
    const out: Record<string, string> = {};
    for (const group of TOKEN_GROUPS) {
      for (const token of group.tokens) {
        probe.style.color = `hsl(var(--${token}))`;
        out[token] = toHex(getComputedStyle(probe).color);
      }
    }
    probe.remove();
    setValues(out);
  }, [resolved]);

  return (
    <div className="space-y-6">
      {TOKEN_GROUPS.map((group) => (
        <div key={group.title}>
          <h3 className="mb-2 text-sm font-semibold text-foreground">{group.title}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {group.tokens.map((token) => (
              <div key={token} className="overflow-hidden rounded-lg border bg-card">
                <div className="h-12 border-b" style={{ background: `hsl(var(--${token}))` }} />
                <div className="px-2 py-1.5">
                  <p className="truncate font-mono text-xs text-foreground">--{token}</p>
                  <p className="font-mono text-xs text-muted-foreground">{values[token] ?? '…'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── loans (server-mode DataTable)

interface LoanRow {
  id: number;
  amount: number;
  remainingAmount: number | null;
  overdueAmount: number | null;
  disbursementDate: string | null;
  nextPaymentDate: string | null;
  status: string;
  borrower?: { name?: string | null; contact?: string | null } | null;
}

const LOAN_SORTS = ['borrower', 'amount', 'disbursementDate', 'remainingAmount', 'overdueAmount', 'nextPaymentDate', 'status', 'createdAt'] as const;
const LOAN_STATUSES = ['Active', 'Completed', 'Defaulted', 'Non-Recoverable'];

function LoansTableDemo() {
  const list = useListParams({
    id: 'styleguide-loans',
    filters: ['status', 'repaymentType'] as const,
    defaults: { status: 'Active' },
    sortable: LOAN_SORTS,
  });
  const query = useListQuery<LoanRow>('loans', list, { itemsKey: 'loans' });
  const [selected, setSelected] = React.useState<Set<RowId>>(new Set());
  const [requests, setRequests] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!query.key) return;
    const url = `/api${keyToEndpoint(query.key)}`;
    setRequests((prev) => (prev[prev.length - 1] === url ? prev : [...prev.slice(-5), url]));
  }, [query.key]);

  const columns: DataTableColumn<LoanRow>[] = [
    {
      id: 'borrower',
      header: 'Borrower',
      sortable: true,
      cell: (loan) => (
        <div className="min-w-0">
          <Link href={`/loans/${loan.id}`} className="font-medium text-foreground hover:text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {loan.borrower?.name ?? `Loan #${loan.id}`}
          </Link>
          <div className="text-xs text-muted-foreground">{loan.borrower?.contact ?? '—'}</div>
        </div>
      ),
    },
    { id: 'amount', header: 'Amount', numeric: true, sortable: true, cell: (loan) => <Money value={loan.amount} tone="plain" /> },
    { id: 'disbursementDate', header: 'Disbursed', sortable: true, hideBelow: 'lg', cell: (loan) => <DateText value={loan.disbursementDate} /> },
    { id: 'remainingAmount', header: 'Remaining', numeric: true, sortable: true, cell: (loan) => <Money value={loan.remainingAmount} /> },
    { id: 'overdueAmount', header: 'Overdue', numeric: true, sortable: true, hideBelow: 'md', cell: (loan) => <Money value={loan.overdueAmount} tone="overdue" /> },
    { id: 'nextPaymentDate', header: 'Next payment', sortable: true, hideBelow: 'xl', cell: (loan) => <DateText value={loan.nextPaymentDate} /> },
    { id: 'status', header: 'Status', sortable: true, cell: (loan) => <StatusBadge status={loan.status} /> },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      width: '3.5rem',
      align: 'right',
      cell: (loan) => (
        <RowActions
          label={`Actions for ${loan.borrower?.name ?? `loan ${loan.id}`}`}
          actions={[
            { label: 'View', icon: Eye, href: `/loans/${loan.id}` },
            { label: 'Edit', icon: Pencil, href: `/loans/${loan.id}/edit` },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              separatorBefore: true,
              confirm: {
                title: 'Delete this loan?',
                description: 'Styleguide demo: nothing is deleted. Confirm shows a toast.',
                onConfirm: async () => {
                  await new Promise((r) => setTimeout(r, 600));
                  toast.success('Demo: loan would be deleted');
                },
              },
            },
          ]}
        />
      ),
    },
  ];

  const sortState: SortState = { sort: list.params.sort, order: list.params.order };
  const chips = list.activeFilters.map((f) => ({
    key: f.name,
    label: f.name === 'q' ? `Search: ${f.value}` : `${f.name === 'status' ? 'Status' : 'Repayment'}: ${f.value === ALL ? 'All' : f.value}`,
    onRemove: () => list.setParams({ [f.name]: null } as Parameters<typeof list.setParams>[0]),
  }));

  return (
    <div data-testid="loans-demo">
      <ListToolbar
        search={<SearchInput value={list.params.q} onChange={(q) => list.setParams({ q })} placeholder="Search borrower or phone" label="Search loans" />}
        primaryFilter={
          <NativeSelect
            aria-label="Status"
            className="w-40"
            value={list.params.status ?? 'Active'}
            onValueChange={(status) => list.setParams({ status })}
            options={[{ value: ALL, label: 'All statuses' }, ...LOAN_STATUSES.map((s) => ({ value: s, label: s }))]}
          />
        }
        filters={
          <FormField label="Repayment type">
            <NativeSelect
              value={list.params.repaymentType ?? ''}
              onValueChange={(v) => list.setParams({ repaymentType: v || null })}
              placeholder="Any"
              options={[
                { value: 'Monthly', label: 'Monthly' },
                { value: 'Weekly', label: 'Weekly' },
              ]}
            />
          </FormField>
        }
        filterCount={list.params.repaymentType ? 1 : 0}
        sort={
          <NativeSelect
            aria-label="Sort by"
            size="sm"
            value={list.params.sort ? `${list.params.sort}:${list.params.order}` : ''}
            onValueChange={(v) => {
              const [sort, order] = v.split(':');
              list.setParams({ sort: sort || null, order: (order as 'asc' | 'desc') || null });
            }}
            placeholder="Default order"
            options={[
              { value: 'amount:desc', label: 'Amount, high to low' },
              { value: 'amount:asc', label: 'Amount, low to high' },
              { value: 'nextPaymentDate:asc', label: 'Next payment, soonest' },
            ]}
          />
        }
        actions={
          <Button variant="outline" onClick={() => toast('Export is a Phase 4 feature')}>
            <Download aria-hidden="true" />
            Export
          </Button>
        }
        chips={<FilterChips chips={chips} onClearAll={list.clearFilters} />}
        resultSummary={query.meta ? formatRange(query.meta.page, query.meta.pageSize, query.meta.totalCount) : null}
      />
      <DataTable<LoanRow>
        label="Loans"
        columns={columns}
        rows={query.items}
        getRowId={(loan) => loan.id}
        isInitialLoading={query.isInitialLoading}
        isRefreshing={query.isRefreshing}
        error={query.error}
        onRetry={() => void query.mutate()}
        sort={sortState}
        onSortChange={(next) => list.setParams({ sort: next.sort, order: next.order })}
        selection={{ selected, onChange: setSelected, rowLabel: (loan) => `Select ${loan.borrower?.name ?? `loan ${loan.id}`}` }}
        emptyState={
          list.isFiltered ? (
            <EmptyState variant="no-results" onClearFilters={list.clearFilters} />
          ) : (
            <EmptyState title="No loans yet" description="Loans you create appear here." action={<Button size="sm"><Plus aria-hidden="true" />New loan</Button>} />
          )
        }
        pagination={
          query.meta
            ? {
                page: query.meta.page,
                pageSize: list.params.pageSize,
                totalCount: query.meta.totalCount,
                onPageChange: (page) => list.setParams({ page }),
                onPageSizeChange: (pageSize) => list.setParams({ pageSize }),
              }
            : undefined
        }
        renderCard={(loan) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/loans/${loan.id}`} className="font-medium text-foreground hover:underline">
                  {loan.borrower?.name ?? `Loan #${loan.id}`}
                </Link>
                <div className="text-xs text-muted-foreground">{loan.borrower?.contact ?? '—'}</div>
              </div>
              <StatusBadge status={loan.status} />
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Remaining</dt>
                <dd><Money value={loan.remainingAmount} /></dd>
              </div>
              <div className="text-right">
                <dt className="text-xs text-muted-foreground">Next payment</dt>
                <dd><DateText value={loan.nextPaymentDate} /></dd>
              </div>
            </dl>
          </div>
        )}
      />
      {selected.size > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{selected.size} selected (selection clears when the page, search or filters change)</p>
      ) : null}
      <SpikePanel ready={list.ready} params={list.params} apiParams={list.apiParams} requests={requests} state={query.isInitialLoading ? 'loading' : query.isRefreshing ? 'refreshing' : 'ready'} />
    </div>
  );
}

function SpikePanel({ ready, params, apiParams, requests, state }: { ready: boolean; params: object; apiParams: object; requests: string[]; state: string }) {
  return (
    <details className="mt-4 rounded-lg border bg-elevated p-3 text-xs" data-testid="spike-panel">
      <summary className="cursor-pointer text-sm font-medium text-foreground">URL state and request log (spike evidence)</summary>
      <dl className="mt-2 grid gap-1 font-mono text-muted-foreground">
        <div>ready: <span data-testid="spike-ready">{String(ready)}</span></div>
        <div>state: <span data-testid="spike-state">{state}</span></div>
        <div>params: <span data-testid="spike-params">{JSON.stringify(params)}</span></div>
        <div>apiParams: <span data-testid="spike-api">{JSON.stringify(apiParams)}</span></div>
        <div>
          requests:
          <ol data-testid="spike-requests" className="list-decimal pl-6">
            {requests.map((r, i) => (
              <li key={`${r}-${i}`}>{r}</li>
            ))}
          </ol>
        </div>
      </dl>
    </details>
  );
}

// ─────────────────────────────────────────────────────────────── small client-mode table

interface Txn {
  id: number;
  date: string;
  party: string;
  type: 'Inflow' | 'Outflow';
  amount: number;
  status: string;
}
const TXNS: Txn[] = [
  { id: 1, date: '2026-11-02', party: 'Anitha Devi', type: 'Inflow', amount: 13111, status: 'Paid' },
  { id: 2, date: '2026-11-03', party: 'Ravi Kumar', type: 'Outflow', amount: 125000, status: 'Completed' },
  { id: 3, date: '2026-10-28', party: 'Lakshmi Narayan', type: 'Inflow', amount: 2500, status: 'Partial' },
  { id: 4, date: '2026-10-15', party: 'Suresh Babu', type: 'Inflow', amount: 0, status: 'Missed' },
  { id: 5, date: '2026-11-05', party: 'Meena Raj', type: 'Outflow', amount: 4250000, status: 'Pending' },
  { id: 6, date: '2026-09-30', party: 'Karthik S', type: 'Inflow', amount: 98000, status: 'Overdue' },
];

function ClientTableDemo() {
  const columns: DataTableColumn<Txn>[] = [
    { id: 'date', header: 'Date', sortable: true, cell: (t) => <DateText value={t.date} /> },
    { id: 'party', header: 'Party', sortable: true, cell: (t) => t.party },
    { id: 'type', header: 'Type', cell: (t) => t.type, hideBelow: 'sm' },
    { id: 'amount', header: 'Amount', numeric: true, sortable: true, cell: (t) => <Money value={t.type === 'Inflow' ? t.amount : t.amount} tone={t.type === 'Inflow' ? 'inflow' : 'outflow'} /> },
    { id: 'status', header: 'Status', sortable: true, cell: (t) => <StatusBadge status={t.status} /> },
  ];
  return <DataTable<Txn> label="Recent transactions (client mode)" mode="client" clientPageSize={4} columns={columns} rows={TXNS} getRowId={(t) => t.id} />;
}

// ─────────────────────────────────────────────────────────────── page

interface MemberOption {
  id: number;
  name: string;
  contact?: string | null;
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 space-y-4">
      <div className="border-b pb-2">
        <h2 id={`${id}-title`} className="text-lg font-semibold text-foreground">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

const SECTIONS = [
  ['tokens', 'Tokens'],
  ['buttons', 'Buttons'],
  ['fields', 'Fields'],
  ['display', 'Display'],
  ['status', 'Status'],
  ['money', 'Money and dates'],
  ['overlays', 'Overlays'],
  ['lists', 'Lists'],
  ['states', 'Empty, error, loading'],
  ['forms', 'Forms'],
  ['tabs', 'Tabs'],
] as const;

export default function StyleguideClient() {
  const { resolved, setPreference } = useTheme();
  const tabs = useUrlTabs({ values: ['overview', 'repayments', 'documents'] as const, defaultValue: 'overview' });
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [sheetDialogOpen, setSheetDialogOpen] = React.useState(false);
  const [member, setMember] = React.useState<MemberOption | null>(null);
  const [page, setPage] = React.useState(5);
  const [loadingCards, setLoadingCards] = React.useState(true);
  const [switchOn, setSwitchOn] = React.useState(true);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Internal"
        title="Styleguide"
        description="Tokens, primitives and app kit. Hidden unless built with ENABLE_STYLEGUIDE=1."
        actions={
          <>
            <Button variant="outline" onClick={() => setPreference(resolved === 'dark' ? 'light' : 'dark')}>
              {resolved === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
              {resolved === 'dark' ? 'Light theme' : 'Dark theme'}
            </Button>
            <Button>
              <Plus aria-hidden="true" />
              Primary action
            </Button>
          </>
        }
      />

      <nav aria-label="Styleguide sections" className="mb-8 flex flex-wrap gap-2">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-full border bg-card px-3 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {label}
          </a>
        ))}
      </nav>

      <div className="space-y-12">
        <Section id="tokens" title="Tokens" description="HSL channels in styles/theme/variables.css; values below are computed for the current theme.">
          <TokenSwatches />
        </Section>

        <Section id="buttons" title="Buttons" description="One blue for actions. 44px tall on phones, denser from md.">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">
              <Trash2 aria-hidden="true" />
              Delete
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Add">
              <Plus aria-hidden="true" />
            </Button>
            <Button disabled>Disabled</Button>
            <Button disabled>
              <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" aria-hidden="true" />
              Saving…
            </Button>
            <Button variant="outline" disabled>
              Disabled outline
            </Button>
          </div>
        </Section>

        <Section id="fields" title="Fields" description="Kit fields look the same in pages and in dialogs.">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <FormField label="Borrower name" description="As on the ID proof.">
                <Input placeholder="e.g. Anitha Devi" data-testid="sg-input-main" />
              </FormField>
              <FormField label="Phone" error="Enter a 10-digit number." required>
                <Input defaultValue="98765" inputMode="numeric" />
              </FormField>
              <FormField label="Disabled">
                <Input disabled defaultValue="Read only value" />
              </FormField>
              <FormField label="Notes">
                <Textarea placeholder="Anything the collector should know" />
              </FormField>
            </div>
            <div className="space-y-4">
              <FormField label="Repayment type (NativeSelect)">
                <NativeSelect
                  defaultValue="Monthly"
                  options={[
                    { value: 'Monthly', label: 'Monthly' },
                    { value: 'Weekly', label: 'Weekly' },
                  ]}
                />
              </FormField>
              <FormField label="Disbursement date (DateInput)">
                <DateInput defaultValue="2026-11-06" />
              </FormField>
              <FormField label="Partner (Radix Select)">
                <Select defaultValue="a">
                  <SelectTrigger>
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a">Partner A</SelectItem>
                    <SelectItem value="b">Partner B</SelectItem>
                    <SelectItem value="c" disabled>
                      Partner C (inactive)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Member (EntityCombobox, live search)">
                <EntityCombobox<MemberOption>
                  value={member}
                  onChange={setMember}
                  loadOptions={(q, signal) =>
                    apiFetch<{ members?: MemberOption[] }>(
                      `/members/consolidated?action=list&page=1&pageSize=20${q ? `&search=${encodeURIComponent(q)}` : ''}`,
                      { signal }
                    ).then((r) => r.members ?? [])
                  }
                  getOptionValue={(m) => m.id}
                  getOptionLabel={(m) => m.name}
                  renderOption={(m) => (
                    <>
                      <span className="truncate">{m.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{m.contact ?? ''}</span>
                    </>
                  )}
                  placeholder="Search members"
                />
              </FormField>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox id="sg-check" defaultChecked />
                  <Label htmlFor="sg-check">Send receipt</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="sg-check-off" disabled />
                  <Label htmlFor="sg-check-off" className="text-muted-foreground">Disabled</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="sg-switch" checked={switchOn} onCheckedChange={setSwitchOn} />
                  <Label htmlFor="sg-switch">Auto-reminders</Label>
                </div>
              </div>
              <RadioGroup defaultValue="cash" className="flex gap-6" aria-label="Payment mode">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="cash" id="sg-cash" />
                  <Label htmlFor="sg-cash">Cash</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="upi" id="sg-upi" />
                  <Label htmlFor="sg-upi">UPI</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="bank" id="sg-bank" disabled />
                  <Label htmlFor="sg-bank" className="text-muted-foreground">Bank (disabled)</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </Section>

        <Section id="display" title="Display" description="Cards, key figures, description lists, breadcrumbs, badges, separators, scroll area.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Outstanding" value={<Money value={12500000} compact tone="plain" />} hint="Across 240 active loans" icon={Banknote} trend={{ label: '+4.2% vs Oct', direction: 'up' }} />
            <StatCard label="Overdue" value={<Money value={350000} tone="plain" />} tone="destructive" hint="18 accounts" icon={TriangleAlert} href="/dues" />
            <StatCard label="Due this week" value={<Money value={82000} tone="plain" />} hint="Includes today" icon={CalendarClock} trend={{ label: '-3 accounts', direction: 'down', positive: true }} />
            <StatCard label="Members" value={(500).toLocaleString('en-IN')} icon={Users} loading={loadingCards} hint="placeholder" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setLoadingCards((v) => !v)}>
            Toggle stat-card loading
          </Button>
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Borrower" description="DescriptionList, grid layout" actions={<Button variant="outline" size="sm"><Pencil aria-hidden="true" />Edit</Button>}>
              <DescriptionList
                items={[
                  { label: 'Name', value: 'Anitha Devi' },
                  { label: 'Phone', value: '97340 38149' },
                  { label: 'Member since', value: <DateText value="2025-04-06" /> },
                  { label: 'Email', value: '—' },
                  { label: 'Address', value: '44, Bharathi Street, Coimbatore', full: true },
                ]}
              />
            </SectionCard>
            <SectionCard title="Loan summary" description="DescriptionList, inline layout">
              <DescriptionList
                layout="inline"
                items={[
                  { label: 'Principal', value: <Money value={125000} tone="plain" />, numeric: true },
                  { label: 'Repaid', value: <Money value={70000} tone="inflow" />, numeric: true },
                  { label: 'Overdue', value: <Money value={35000} tone="overdue" />, numeric: true, hint: '2 instalments' },
                  { label: 'Interest outstanding', value: <Money value={0} />, numeric: true },
                ]}
              />
            </SectionCard>
          </div>
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Card primitive</CardTitle>
              <CardDescription>shadcn Card with header, content and footer.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link href="/loans">Loans</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Anitha Devi</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </div>
              <Separator />
              <ScrollArea className="h-24 rounded-md border">
                <div className="space-y-1 p-3 text-sm">
                  {Array.from({ length: 12 }, (_, i) => (
                    <p key={i}>Scrollable row {i + 1}</p>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
            <CardFooter className="gap-2">
              <Skeleton className="h-4 w-24" />
              <span className="text-xs text-muted-foreground">Skeleton</span>
            </CardFooter>
          </Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Primitive table</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Row one</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(125000)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Row two</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(9850)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Section>

        <Section id="status" title="Status" description="Every status in components/kit/status.ts; label plus icon or dot.">
          <div className="flex flex-wrap gap-2" data-testid="status-badges">
            {Object.entries(STATUS_MAP).map(([key, style]) => (
              <StatusBadge key={key} status={style.label} />
            ))}
            <StatusBadge status="InterestOnly" label="InterestOnly (alias)" />
            <StatusBadge status="Some new status" />
          </div>
          <div className="flex flex-wrap gap-2">
            {['Active', 'Overdue', 'Defaulted', 'Non-Recoverable', 'Completed'].map((s) => (
              <StatusBadge key={s} status={s} size="md" />
            ))}
          </div>
        </Section>

        <Section id="money" title="Money and dates" description="Indian grouping, tabular numerals, one date format.">
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-sm" data-testid="money-samples">
              <thead className="bg-elevated text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Case</th>
                  <th className="px-4 py-2 text-right font-medium">Rendered</th>
                  <th className="hidden px-4 py-2 text-left font-medium sm:table-cell">Function</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ['formatMoney(125000)', <span key="a" data-testid="fm-125000">{formatMoney(125000)}</span>, 'formatMoney'],
                  ['formatMoney(12345678.9)', formatMoney(12345678.9), 'formatMoney'],
                  ['formatMoney(1234.5, decimals 2)', formatMoney(1234.5, { decimals: 2 }), 'formatMoney'],
                  ['Inflow', <Money key="b" value={13111} tone="inflow" />, 'Money tone="inflow"'],
                  ['Outflow', <Money key="c" value={125000} tone="outflow" />, 'Money tone="outflow"'],
                  ['Overdue above zero', <Money key="d" value={35000} tone="overdue" />, 'Money tone="overdue"'],
                  ['Negative balance', <Money key="e" value={-4200} />, 'Money (auto)'],
                  ['Zero', <Money key="f" value={0} />, 'Money (muted dash)'],
                  ['Missing', <Money key="g" value={null} />, 'Money'],
                  ['Compact (hover/focus for full)', <Money key="h" value={24000000} compact tone="plain" />, `${formatMoneyCompact(24000000)} / ${formatMoneyCompact(125000)}`],
                  ['Date', <DateText key="i" value="2026-11-06" />, formatDate('2026-11-06')],
                  ['Date with time', <DateText key="j" value={new Date(2026, 10, 6, 14, 5)} withTime />, 'DateText withTime'],
                  ['Missing date', <DateText key="k" value={null} />, 'DateText'],
                ].map(([label, rendered, fn], i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-muted-foreground">{label}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{rendered}</td>
                    <td className="hidden px-4 py-2 font-mono text-xs text-muted-foreground sm:table-cell">{fn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="overlays" title="Overlays" description="Escape closes; focus returns to the trigger; dialogs trap focus. ResponsiveDialog is a sheet below md.">
          <div className="flex flex-wrap gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="open-dialog">Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record a payment</DialogTitle>
                  <DialogDescription>Same Input as the Fields section, rendered in a portal outside main.</DialogDescription>
                </DialogHeader>
                <FormField label="Amount">
                  <Input placeholder="₹" inputMode="decimal" data-testid="sg-input-dialog" />
                </FormField>
                <DialogFooter>
                  <Button variant="outline">Cancel</Button>
                  <Button>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <ResponsiveDialog
              open={sheetDialogOpen}
              onOpenChange={setSheetDialogOpen}
              trigger={<Button variant="outline" data-testid="open-responsive">ResponsiveDialog</Button>}
              title="Add member to chit fund"
              description="Centred dialog on desktop, bottom sheet on phones."
              footer={
                <>
                  <Button variant="outline" onClick={() => setSheetDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => { setSheetDialogOpen(false); toast.success('Member added (demo)'); }}>Add member</Button>
                </>
              }
            >
              <div className="space-y-4">
                <FormField label="Name" required>
                  <Input placeholder="Full name" />
                </FormField>
                <FormField label="Contact number" required>
                  <Input inputMode="tel" placeholder="10-digit number" />
                </FormField>
              </div>
            </ResponsiveDialog>
            <ConfirmDialog
              trigger={<Button variant="destructive" data-testid="open-confirm">ConfirmDialog</Button>}
              title="Delete this repayment?"
              description="The loan's remaining amount is recalculated. This cannot be undone."
              onConfirm={async () => {
                await new Promise((r) => setTimeout(r, 500));
                toast.success('Repayment deleted (demo)');
              }}
            />
            <Button variant="outline" onClick={() => setConfirmOpen(true)} data-testid="open-confirm-fail">
              ConfirmDialog (fails)
            </Button>
            <ConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              title="Mark as non-recoverable?"
              description="This demo's confirm action throws, to show the error state."
              confirmLabel="Mark"
              onConfirm={async () => {
                await new Promise((r) => setTimeout(r, 400));
                throw new Error('Server said no (demo error).');
              }}
            />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Sheet (right)</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription>Right-hand sheet primitive.</SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">Popover</Button>
              </PopoverTrigger>
              <PopoverContent className="space-y-2">
                <p className="text-sm font-medium">Popover</p>
                <p className="text-sm text-muted-foreground">Escape closes it.</p>
              </PopoverContent>
            </Popover>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Dropdown menu</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Loan</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Eye aria-hidden="true" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem disabled>Disabled item</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive-text focus:bg-destructive-subtle focus:text-destructive-text">
                  <Trash2 aria-hidden="true" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <RowActions
              label="Row actions demo"
              actions={[
                { label: 'View', icon: Eye, onSelect: () => toast('View selected') },
                { label: 'Delete', icon: Trash2, destructive: true, separatorBefore: true, confirm: { title: 'Delete row?', onConfirm: () => { toast.success('Deleted (demo)'); } } },
              ]}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">Tooltip</Button>
                </TooltipTrigger>
                <TooltipContent>Neutral tooltip</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => toast.success('Repayment recorded', { description: '₹13,111 from Anitha Devi' })} data-testid="toast-success">
              Toast: success
            </Button>
            <Button variant="outline" onClick={() => toast.error('Could not save', { description: 'Network error. Try again.' })}>
              Toast: error
            </Button>
            <Button variant="outline" onClick={() => toast('Loan archived', { action: { label: 'Undo', onClick: () => toast('Undone') } })}>
              Toast: with action
            </Button>
          </div>
          <div className="max-w-sm overflow-hidden rounded-lg border">
            <Command>
              <CommandInput placeholder="Command (inline)…" />
              <CommandList>
                <CommandEmpty>No results.</CommandEmpty>
                <CommandGroup heading="Go to">
                  <CommandItem>Dashboard</CommandItem>
                  <CommandItem>Loans</CommandItem>
                  <CommandItem>Chit Funds</CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </Section>

        <Section id="lists" title="Lists" description="Server mode over /api/loans (search and sort are sent; the endpoint honours them from Phase 4). Client mode below.">
          <LoansTableDemo />
          <h3 className="pt-4 text-sm font-semibold text-foreground">Client mode (local sort and paging)</h3>
          <ClientTableDemo />
          <h3 className="pt-4 text-sm font-semibold text-foreground">ListPagination (standalone)</h3>
          <ListPagination page={page} pageSize={10} totalCount={200} onPageChange={setPage} onPageSizeChange={() => undefined} />
        </Section>

        <Section id="states" title="Empty, error, loading">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card">
              <EmptyState title="No loans yet" description="Create the first loan to start tracking repayments." action={<Button size="sm"><Plus aria-hidden="true" />New loan</Button>} />
            </div>
            <div className="rounded-xl border bg-card">
              <EmptyState variant="no-results" onClearFilters={() => toast('Filters cleared')} />
            </div>
            <div className="rounded-xl border bg-card">
              <ErrorState error={new Error('500: Internal Server Error')} onRetry={() => toast('Retrying…')} />
            </div>
            <DataTable<Txn>
              label="Loading demo"
              columns={[
                { id: 'party', header: 'Party', cell: (t) => t.party },
                { id: 'amount', header: 'Amount', numeric: true, cell: (t) => <Money value={t.amount} /> },
              ]}
              rows={[]}
              getRowId={(t) => t.id}
              isInitialLoading
              skeletonRows={3}
            />
          </div>
        </Section>

        <Section id="forms" title="Forms" description="FormSection: two columns on desktop, one on phones; FormActions sticks to the bottom on phones.">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              toast.success('Saved (demo)');
            }}
          >
            <FormSection title="Loan details" description="Amounts in rupees.">
              <FormField label="Amount" required>
                <Input inputMode="decimal" placeholder="1,25,000" />
              </FormField>
              <FormField label="Interest rate (per month)" description="Flat, in rupees per instalment.">
                <Input inputMode="decimal" />
              </FormField>
              <FormField label="Repayment type">
                <NativeSelect
                  options={[
                    { value: 'Monthly', label: 'Monthly' },
                    { value: 'Weekly', label: 'Weekly' },
                  ]}
                />
              </FormField>
              <FormField label="First payment date">
                <DateInput />
              </FormField>
            </FormSection>
            <FormActions>
              <Button type="button" variant="outline">
                Cancel
              </Button>
              <Button type="submit">Save loan</Button>
            </FormActions>
          </form>
        </Section>

        <Section id="tabs" title="Tabs" description="UrlTabs keeps the tab in ?tab= (replace, default omitted). The shadcn Tabs primitive is below it.">
          <UrlTabs
            tabs={tabs}
            aria-label="Loan sections"
            items={[
              { value: 'overview', label: 'Overview' },
              { value: 'repayments', label: 'Repayments', count: 24 },
              { value: 'documents', label: 'Documents' },
            ]}
          />
          <UrlTabPanel tabs={tabs} value="overview" className="text-sm text-muted-foreground">
            Overview panel.
          </UrlTabPanel>
          <UrlTabPanel tabs={tabs} value="repayments" className="text-sm text-muted-foreground">
            Repayments panel.
          </UrlTabPanel>
          <UrlTabPanel tabs={tabs} value="documents" className="text-sm text-muted-foreground">
            Documents panel.
          </UrlTabPanel>
          <Tabs defaultValue="one" className="pt-4">
            <TabsList>
              <TabsTrigger value="one">Primitive one</TabsTrigger>
              <TabsTrigger value="two">Primitive two</TabsTrigger>
            </TabsList>
            <TabsContent value="one" className="text-sm text-muted-foreground">
              Content one
            </TabsContent>
            <TabsContent value="two" className="text-sm text-muted-foreground">
              Content two
            </TabsContent>
          </Tabs>
        </Section>
      </div>
    </PageContainer>
  );
}
