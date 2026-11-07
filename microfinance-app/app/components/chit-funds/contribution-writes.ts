'use client';

/**
 * Contribution writes of a chit fund's pages (members, contributions, a member's history):
 * the optimistic "Saving" rows and the per-fund single-flight lock.
 *
 * - One contribution write (add, bulk add, balance payment, delete) per fund at a time, on
 *   every page of that fund: a second one is refused with ContributionBusyError.
 * - Never retried automatically. add-contribution refuses a second row for the same member
 *   and month (a check, not a database constraint), pay-contribution-balance pays again on a
 *   second call, add-member with a name creates a new person each time.
 * - Server-computed figures (balance, missed months, pending amount, month totals) are never
 *   computed here: callers show them as updating while `pending` is not empty, and the
 *   pending rows are dropped only after the fund's queries have been refetched.
 */
import * as React from 'react';
import { invalidate } from '@/lib/query/invalidate';
import { chitFundWrites, invalidateChitFundContributions, type ChitContribution } from '@/lib/query/chit-funds';

/** Fund ids with a contribution write in flight (module level: shared by all mounted pages). */
const busyFunds = new Set<number>();

export class ContributionBusyError extends Error {
  constructor() {
    super('A contribution for this chit fund is already being saved. Please wait for it to finish.');
    this.name = 'ContributionBusyError';
  }
}

export interface PendingContribution {
  memberId: number;
  month: number;
  amount: number;
  paidDate: string;
}

/** The body fields every add-contribution request carries (pages add their own extra keys). */
export type ContributionBody = Record<string, unknown> & { memberId: number; month: number; amount: number; paidDate: string };

/** Today as YYYY-MM-DD (UTC), the default paid date the pages always used. */
export const todayIso = () => new Date().toISOString().split('T')[0];

const refetchFund = async (fundId: number, globalMemberIds: (number | null | undefined)[]) => {
  const ids = Array.from(new Set(globalMemberIds.filter((g): g is number => !!g)));
  try {
    await Promise.all([
      invalidateChitFundContributions(fundId, ids.length === 1 ? ids[0] : null),
      ...(ids.length > 1 ? ids.map((g) => invalidate(['members', undefined, g])) : []),
    ]);
  } catch {
    /* the write itself succeeded; a failed refetch shows the error state of that query */
  }
};

export interface BulkResult {
  saved: number;
  failed: number;
  errors: unknown[];
}

export function useContributionWrites(fundId: number) {
  const [pending, setPending] = React.useState<PendingContribution[]>([]);
  const [updatingIds, setUpdatingIds] = React.useState<ReadonlySet<number>>(() => new Set());
  const [busy, setBusy] = React.useState(false);

  const run = React.useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      if (busyFunds.has(fundId)) throw new ContributionBusyError();
      busyFunds.add(fundId);
      setBusy(true);
      try {
        return await fn();
      } finally {
        busyFunds.delete(fundId);
        setBusy(false);
      }
    },
    [fundId]
  );

  /** One contribution, shown as "Saving" at once. Resolves once the server figures are back. */
  const record = React.useCallback(
    (body: ContributionBody, globalMemberId?: number | null) =>
      run(async () => {
        const row: PendingContribution = { memberId: Number(body.memberId), month: Number(body.month), amount: Number(body.amount), paidDate: String(body.paidDate) };
        setPending((list) => [...list, row]);
        try {
          const saved = await chitFundWrites.addContribution(fundId, body);
          await refetchFund(fundId, [globalMemberId]);
          return saved;
        } finally {
          setPending((list) => list.filter((p) => p !== row));
        }
      }),
    [fundId, run]
  );

  /**
   * Several contributions, one request at a time in the given order (as the bulk action always
   * sent them). `skip` entries are counted as failures without a request.
   */
  const recordMany = React.useCallback(
    (items: { body: ContributionBody; globalMemberId?: number | null; skip?: boolean }[]) =>
      run(async (): Promise<BulkResult> => {
        const result: BulkResult = { saved: 0, failed: 0, errors: [] };
        const added: PendingContribution[] = [];
        const members: (number | null | undefined)[] = [];
        try {
          for (const item of items) {
            if (item.skip) {
              result.failed += 1;
              continue;
            }
            const row: PendingContribution = { memberId: Number(item.body.memberId), month: Number(item.body.month), amount: Number(item.body.amount), paidDate: String(item.body.paidDate) };
            added.push(row);
            setPending((list) => [...list, row]);
            try {
              await chitFundWrites.addContribution(fundId, item.body);
              result.saved += 1;
              members.push(item.globalMemberId);
            } catch (error) {
              result.failed += 1;
              result.errors.push(error);
              setPending((list) => list.filter((p) => p !== row));
            }
          }
          if (result.saved > 0) await refetchFund(fundId, members);
          return result;
        } finally {
          setPending((list) => list.filter((p) => !added.includes(p)));
        }
      }),
    [fundId, run]
  );

  /**
   * A payment toward a contribution's balance. Resolves when the server has saved it (the
   * dialog can close); the row then shows "Updating…" until the fund has been refetched.
   */
  const payBalance = React.useCallback(
    (body: { contributionId: number; amount: number; paidDate: string }, globalMemberId?: number | null) =>
      run(async () => {
        const saved = await chitFundWrites.payContributionBalance(fundId, body);
        setUpdatingIds((prev) => new Set([...prev, body.contributionId]));
        void refetchFund(fundId, [globalMemberId]).finally(() =>
          setUpdatingIds((prev) => new Set([...prev].filter((id) => id !== body.contributionId)))
        );
        return saved;
      }),
    [fundId, run]
  );

  /** Delete a contribution; resolves after the fund's figures have been refetched. */
  const remove = React.useCallback(
    (contributionId: number, globalMemberId?: number | null) =>
      run(async () => {
        await chitFundWrites.deleteContribution(fundId, contributionId);
        await refetchFund(fundId, [globalMemberId]);
      }),
    [fundId, run]
  );

  return { pending, updatingIds, busy, record, recordMany, payBalance, remove, saving: pending.length > 0 };
}

/** The pending row for a member and month, if one is being saved. */
export const pendingFor = (pending: PendingContribution[], memberId: number, month?: number) =>
  pending.find((p) => p.memberId === memberId && (month === undefined || p.month === month));

export type { ChitContribution };
