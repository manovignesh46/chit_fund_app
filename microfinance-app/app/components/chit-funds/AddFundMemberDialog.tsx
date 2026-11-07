'use client';

/**
 * "Add member to chit fund" (the fund's members page), in a dialog:
 *  - pick existing people (server search, 25 a page; people already in the fund are listed
 *    but disabled) and assign the selection: one `add-member` request per person, in the
 *    order they were picked, body `{ globalMemberId }` (the fund's monthly contribution applies);
 *  - or create a new person and add them: body `{ name, contact, contribution }`.
 * Bodies, checks and messages are the ones the page always had. The picker used to load up
 * to 1,000 people at once (`pageSize=1000`) and excluded only the members on the current page.
 */
import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { toast } from '@/lib/toast';
import { apiFetch } from '@/lib/query/fetcher';
import { chitFundWrites } from '@/lib/query/chit-funds';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { errorMessage } from '@/components/kit/error-state';
import { FormField } from '@/components/kit/form-field';
import { ResponsiveDialog } from '@/components/kit/responsive-dialog';
import { SearchInput } from '@/components/kit/search-input';
import { cn } from '@/lib/utils';

interface Person {
  id: number;
  name: string;
  contact: string;
}

const PICKER_PAGE_SIZE = 25;

export interface AddFundMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fund: { id: number; name: string; monthlyContribution: number };
  /** Global member ids already in the fund (all of them, from the fund detail). */
  enrolled: ReadonlySet<number>;
  /** After any successful assign/create (the page refetches the fund's queries). */
  onChanged: (globalMemberIds: number[]) => void;
}

export function AddFundMemberDialog({ open, onOpenChange, fund, enrolled, onChanged }: AddFundMemberDialogProps) {
  const formId = React.useId();
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [people, setPeople] = React.useState<Person[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  // Picked people in the order they were picked (that is the order the requests go out).
  const [picked, setPicked] = React.useState<Person[]>([]);
  const [assigned, setAssigned] = React.useState<ReadonlySet<number>>(() => new Set());
  const [values, setValues] = React.useState({ name: '', contact: '' });
  const [errors, setErrors] = React.useState<{ name?: string; contact?: string; submit?: string; assign?: string }>({});
  const [submitting, setSubmitting] = React.useState<null | 'assign' | 'create'>(null);

  React.useEffect(() => {
    if (!open) return;
    setErrors({});
    setPicked([]);
  }, [open]);

  // Load one page of people for the search (latest request wins).
  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const search = new URLSearchParams({ action: 'list', page: String(page), pageSize: String(PICKER_PAGE_SIZE) });
    if (q) search.set('q', q);
    setLoading(true);
    setLoadError(null);
    apiFetch<{ members?: Person[]; totalCount?: number }>(`/members/consolidated?${search.toString()}`, { signal: controller.signal })
      .then((data) => {
        setPeople(data.members ?? []);
        setTotal(data.totalCount ?? 0);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(`Failed to load global members: ${errorMessage(error) ?? 'Unknown error'}. Please try again later.`);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, q, page]);

  const isTaken = (p: Person) => enrolled.has(p.id) || assigned.has(p.id);
  const selectable = people.filter((p) => !isTaken(p));
  const pickedIds = new Set(picked.map((p) => p.id));
  const allShownPicked = selectable.length > 0 && selectable.every((p) => pickedIds.has(p.id));
  const totalPages = Math.max(1, Math.ceil(total / PICKER_PAGE_SIZE));

  const toggle = (person: Person, checked: boolean) =>
    setPicked((prev) => (checked ? (prev.some((p) => p.id === person.id) ? prev : [...prev, person]) : prev.filter((p) => p.id !== person.id)));
  const toggleAll = (checked: boolean) =>
    setPicked((prev) => (checked ? [...prev, ...selectable.filter((p) => !prev.some((x) => x.id === p.id))] : prev.filter((p) => !selectable.some((s) => s.id === p.id))));

  const assign = async () => {
    if (submitting) return;
    if (picked.length === 0) return setErrors({ assign: 'Please select at least one member to assign' });
    setSubmitting('assign');
    setErrors({});
    const done: number[] = [];
    let failed = 0;
    for (const person of picked) {
      try {
        await chitFundWrites.assignExisting(fund.id, person.id);
        done.push(person.id);
      } catch {
        failed += 1;
      }
    }
    setSubmitting(null);
    if (done.length > 0) {
      setAssigned((prev) => new Set([...prev, ...done]));
      setPicked([]);
      toast.success(`${done.length} ${done.length === 1 ? 'member' : 'members'} added to ${fund.name}`);
      onChanged(done);
      if (failed === 0) onOpenChange(false);
    }
    if (failed > 0) setErrors({ assign: `Failed to assign ${failed} member${failed > 1 ? 's' : ''}. They may already be part of this chit fund.` });
  };

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const found: typeof errors = {};
    if (!values.name.trim()) found.name = 'Name is required';
    if (!values.contact.trim()) found.contact = 'Contact information is required';
    else if (!/^[0-9+\s-]{10,15}$/.test(values.contact.trim())) found.contact = 'Please enter a valid phone number';
    setErrors(found);
    if (found.name || found.contact) {
      document.getElementById(found.name ? 'name' : 'contact')?.focus();
      return;
    }
    setSubmitting('create');
    try {
      await chitFundWrites.createAndAdd(fund.id, { name: values.name, contact: values.contact, contribution: fund.monthlyContribution || 0 });
      toast.success('Member added', { description: `${values.name} · ${fund.name}` });
      setValues({ name: '', contact: '' });
      onChanged([]);
      onOpenChange(false);
    } catch (error) {
      setErrors({ submit: errorMessage(error) ?? 'Failed to add member. Please try again.' });
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => !submitting && onOpenChange(next)}
      title="Add member to chit fund"
      description={`Pick people who are already members, or create a new one. They join ${fund.name}.`}
      size="lg"
    >
      <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1 sm:max-h-[65vh]">
        <section aria-labelledby={`${formId}-pick`} className="space-y-3">
          <h3 id={`${formId}-pick`} className="text-sm font-semibold text-foreground">
            Select from existing members
          </h3>
          <SearchInput value={q} onChange={(next) => (setQ(next), setPage(1))} placeholder="Search by name or phone" label="Search members to add" />
          <div className="rounded-lg border">
            <div className="flex flex-wrap items-center gap-3 border-b bg-elevated px-3 py-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox checked={allShownPicked} disabled={selectable.length === 0} onCheckedChange={(c) => toggleAll(c === true)} aria-label="Select all shown" />
                Select all shown
              </label>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground" aria-live="polite">
                {picked.length} selected
              </span>
              <Button type="button" size="sm" onClick={() => void assign()} disabled={submitting !== null || picked.length === 0}>
                {submitting === 'assign' ? <Loader2 aria-hidden="true" className="motion-safe:animate-spin" /> : null}
                {submitting === 'assign' ? 'Assigning…' : `Assign selected (${picked.length})`}
              </Button>
            </div>
            <ul className={cn('max-h-64 divide-y overflow-y-auto transition-opacity', loading && 'opacity-60')} aria-busy={loading || undefined}>
              {loadError ? (
                <li className="px-3 py-4 text-sm text-destructive-text">{loadError}</li>
              ) : people.length === 0 && !loading ? (
                <li className="px-3 py-4 text-sm text-muted-foreground">{q ? `No members match "${q}".` : 'No members yet.'}</li>
              ) : (
                people.map((person) => {
                  const taken = isTaken(person);
                  return (
                    <li key={person.id}>
                      <label className={cn('flex min-h-11 items-center gap-3 px-3 py-2 text-sm', taken ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer hover:bg-elevated')}>
                        <Checkbox checked={pickedIds.has(person.id)} disabled={taken} onCheckedChange={(c) => toggle(person, c === true)} aria-label={`Select ${person.name}`} />
                        <span className="min-w-0 flex-1 truncate">
                          {person.name}
                          {taken ? <span className="text-xs"> · already in this fund</span> : null}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{person.contact}</span>
                      </label>
                    </li>
                  );
                })
              )}
            </ul>
            {totalPages > 1 ? (
              <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
                <Button type="button" variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Prev
                </Button>
                <span className="tabular-nums">
                  Page {page} of {totalPages}
                </span>
                <Button type="button" variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            ) : null}
          </div>
          {errors.assign ? (
            <p role="alert" className="rounded-md border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-text">
              {errors.assign}
            </p>
          ) : null}
        </section>

        <div className="flex items-center gap-3 text-xs font-medium uppercase text-muted-foreground">
          <Separator className="flex-1" />
          or
          <Separator className="flex-1" />
        </div>

        <section aria-labelledby={`${formId}-new`} className="space-y-3">
          <h3 id={`${formId}-new`} className="text-sm font-semibold text-foreground">
            Create a new member and add them to this chit fund
          </h3>
          <form id={formId} onSubmit={create} noValidate className="space-y-4">
            <FormField label="Name" required nativeRequired={false} id="name" error={errors.name}>
              <Input name="name" autoComplete="off" value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} />
            </FormField>
            <FormField label="Contact number" required nativeRequired={false} id="contact" error={errors.contact}>
              <Input name="contact" inputMode="tel" autoComplete="off" value={values.contact} onChange={(e) => setValues((v) => ({ ...v, contact: e.target.value }))} />
            </FormField>
            {errors.submit ? (
              <p role="alert" className="rounded-md border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-text">
                {errors.submit}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting !== null}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting !== null} aria-busy={submitting === 'create' || undefined}>
                {submitting === 'create' ? <Loader2 aria-hidden="true" className="motion-safe:animate-spin" /> : null}
                {submitting === 'create' ? 'Adding…' : 'Create and add'}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </ResponsiveDialog>
  );
}

export default AddFundMemberDialog;
