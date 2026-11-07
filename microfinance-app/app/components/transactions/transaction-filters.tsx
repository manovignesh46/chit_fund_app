'use client';

/**
 * The transactions list's secondary filters (inside the toolbar's Filters popover / sheet):
 * partner, period, and the advanced loan / chit fund filter. Loaded with next/dynamic when
 * the Filters panel first opens, so the member search (cmdk) stays out of the page bundle.
 */
import * as React from 'react';
import useSWR from 'swr';
import { apiFetch } from '@/lib/query/fetcher';
import type { ListController, ListPatch } from '@/lib/list/useListParams';
import { Button } from '@/components/ui/button';
import { EntityCombobox } from '@/components/kit/entity-combobox';
import { FormField } from '@/components/kit/form-field';
import { NativeSelect } from '@/components/kit/native-select';
import { DateRangePicker } from '@/components/kit/period-picker';

export const TRANSACTION_FILTERS = ['type', 'partner', 'from', 'to', 'advType', 'advMember', 'advMemberName', 'advEntity', 'advSubType', 'txn'] as const;
export type TransactionFilter = (typeof TRANSACTION_FILTERS)[number];
type Filter = TransactionFilter;
const ADVANCED: Filter[] = ['advType', 'advMember', 'advMemberName', 'advEntity', 'advSubType'];

interface MemberOption {
  id: number;
  name: string;
  contact?: string;
}


export default function TransactionFilterFields({
  list,
  partners,
  setFilter,
}: {
  list: ListController<Filter>;
  partners: { id: number; name: string }[];
  setFilter: (patch: ListPatch<Filter>) => void;
}) {
  const p = list.params;
  const member: MemberOption | null = p.advMember ? { id: Number(p.advMember), name: p.advMemberName || `Member #${p.advMember}` } : null;
  // The selected member's loans (server-filtered) or chit funds, for the entity select.
  const loans = useSWR<{ loans: { id: number; amount: number }[] }>(
    p.advType === 'loan' && p.advMember ? `/loans/consolidated?action=list&borrowerId=${p.advMember}&pageSize=100` : null
  );
  const funds = useSWR<{ chitFunds: { id: number; name?: string; title?: string }[] }>(
    p.advType === 'chit' && p.advMember ? `/chit-funds/by-member?globalMemberId=${p.advMember}` : null
  );
  const entities =
    p.advType === 'loan'
      ? (loans.data?.loans ?? []).map((l) => ({ value: String(l.id), label: `Loan #${l.id} - ₹${l.amount?.toLocaleString?.('en-IN') ?? l.amount}` }))
      : (funds.data?.chitFunds ?? []).map((f) => ({ value: String(f.id), label: f.name || f.title || `ID ${f.id}` }));
  const entityLabel = p.advType === 'loan' ? 'Loan' : p.advType === 'chit' ? 'Chit fund' : 'Loan or chit fund';
  const subtypes =
    p.advType === 'loan'
      ? [{ value: 'disbursement', label: 'Disbursement' }, { value: 'repayment', label: 'Repayment' }]
      : p.advType === 'chit'
        ? [{ value: 'contribution', label: 'Contribution' }, { value: 'auction', label: 'Auction' }]
        : [];

  return (
    <div className="space-y-4">
      <FormField label="Partner">
        <NativeSelect value={p.partner ?? ''} onValueChange={(v) => setFilter({ partner: v || null })} options={[{ value: '', label: 'All partners' }, ...partners.map((x) => ({ value: x.name, label: x.name }))]} />
      </FormField>
      <FormField label="Period">
        <DateRangePicker from={p.from} to={p.to} onChange={(from, to) => setFilter({ from, to })} />
      </FormField>
      <div className="space-y-3 border-t pt-3">
        <p className="text-sm font-semibold text-foreground">Advanced</p>
        <FormField label="Kind">
          <NativeSelect
            value={p.advType ?? ''}
            onValueChange={(v) => setFilter({ advType: v || null, advEntity: null, advSubType: null })}
            options={[{ value: '', label: 'Loans and chit funds' }, { value: 'loan', label: 'Loan' }, { value: 'chit', label: 'Chit fund' }]}
          />
        </FormField>
        <FormField label="Member">
          <EntityCombobox<MemberOption>
            value={member}
            onChange={(m) => setFilter({ advMember: m ? String(m.id) : null, advMemberName: m ? m.name : null, advEntity: null, advSubType: null })}
            loadOptions={(q, signal) =>
              apiFetch<{ members?: MemberOption[] }>(`/members/consolidated?action=list&page=1&pageSize=20${q ? `&q=${encodeURIComponent(q)}` : ''}`, { signal }).then((r) => r.members ?? [])
            }
            getOptionValue={(m) => m.id}
            getOptionLabel={(m) => m.name}
            renderOption={(m) => (
              <>
                <span className="truncate">{m.name}</span>
                {m.contact ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{m.contact}</span> : null}
              </>
            )}
            placeholder="Any member"
            searchPlaceholder="Search name or phone"
          />
        </FormField>
        <FormField label={entityLabel}>
          <NativeSelect
            value={p.advEntity ?? ''}
            disabled={!p.advType || !p.advMember || loans.isLoading || funds.isLoading}
            onValueChange={(v) => setFilter({ advEntity: v || null, advSubType: null })}
            placeholder={`Any ${entityLabel.toLowerCase()}`}
            options={entities}
          />
        </FormField>
        <FormField label="Subtype">
          <NativeSelect value={p.advSubType ?? ''} disabled={!p.advEntity} onValueChange={(v) => setFilter({ advSubType: v || null })} placeholder="Any subtype" options={subtypes} />
        </FormField>
        {ADVANCED.some((n) => p[n]) ? (
          <Button variant="outline" size="sm" onClick={() => setFilter({ advType: null, advMember: null, advMemberName: null, advEntity: null, advSubType: null })}>
            Clear advanced filter
          </Button>
        ) : null}
      </div>
    </div>
  );
}
