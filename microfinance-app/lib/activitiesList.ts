/**
 * Activities list paged in the database (GET /api/dashboard/consolidated?action=activities
 * with any of the list params below). One UNION ALL over the four sources the legacy
 * handler loaded in full (loan repayments, chit contributions, auctions, loan
 * disbursements), filtered, sorted and paged by Postgres; only the requested page is read.
 *
 *   q          case-insensitive substring of the borrower's or the chit fund's name
 *   type       'loan' | 'chit' (the legacy `filter=Loan|Chit Fund` is also honoured)
 *   from, to   YYYY-MM-DD, inclusive, on the activity's date. The bounds are the server's local
 *              day, the same clock that formats each row's `date` text, so a row is in range
 *              exactly when its shown date is (on a UTC server these are UTC days)
 *   sort       'date' (default) | 'amount';  order 'desc' (default) | 'asc'
 *   pageSize   at most MAX_PAGE_SIZE (100, as the legacy handler)
 *
 * Rows have exactly the legacy shape and text (id, type, action, details, date, amount,
 * entityId, entityType). Ties are broken by source (repayment, contribution, auction,
 * disbursement, the legacy concatenation order) and then id, so paging is stable.
 * Without any of these params the route keeps running the legacy handler unchanged.
 *
 * All values reach SQL as bound parameters; the sort column and direction only come from
 * the whitelists below.
 */
import { format } from 'date-fns';
import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { buildMeta, MAX_PAGE_SIZE, type ListMeta, type SortOrder } from './list/types';

export const ACTIVITY_SORTS = ['date', 'amount'] as const;
export type ActivitySort = (typeof ACTIVITY_SORTS)[number];
export const ACTIVITY_TYPES = ['loan', 'chit'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Query params that switch the activities action to this handler. */
export const ACTIVITY_LIST_PARAMS = ['q', 'type', 'from', 'to', 'sort', 'order'] as const;

export interface ActivityRow {
  id: string;
  type: 'Loan' | 'Chit Fund';
  action: string;
  details: string;
  date: string;
  amount: number;
  entityId: number;
  entityType: 'loan' | 'chitFund';
}

export interface ActivitiesListQuery {
  page: number;
  pageSize: number;
  q: string | null;
  type: ActivityType | null;
  from: string | null;
  to: string | null;
  sort: ActivitySort;
  order: SortOrder;
}

export interface ActivitiesListResult {
  activities: ActivityRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  meta: ListMeta;
}

type SearchParamsLike = Pick<URLSearchParams, 'get' | 'has'>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function positiveInt(value: string | null, fallback: number): number {
  const n = parseInt(value ?? '', 10);
  return n > 0 ? n : fallback;
}

export function wantsActivitiesList(searchParams: SearchParamsLike): boolean {
  return ACTIVITY_LIST_PARAMS.some((name) => searchParams.has(name));
}

export function parseActivitiesQuery(searchParams: SearchParamsLike): ActivitiesListQuery {
  const rawType = searchParams.get('type');
  const legacyFilter = searchParams.get('filter');
  const type: ActivityType | null =
    rawType === 'loan' || rawType === 'chit'
      ? rawType
      : legacyFilter === 'Loan'
        ? 'loan'
        : legacyFilter === 'Chit Fund'
          ? 'chit'
          : null;
  const rawSort = searchParams.get('sort');
  const sort: ActivitySort = rawSort === 'amount' ? 'amount' : 'date';
  const order: SortOrder = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
  const q = (searchParams.get('q') ?? '').trim().slice(0, 200) || null;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  return {
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: Math.min(positiveInt(searchParams.get('pageSize'), 10), MAX_PAGE_SIZE),
    q,
    type,
    from: from && DAY.test(from) ? from : null,
    to: to && DAY.test(to) ? to : null,
    sort,
    order,
  };
}

/** Escape LIKE wildcards so `q` is matched literally. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

interface RawActivity {
  kind: 'repayment' | 'contribution' | 'auction' | 'loan';
  id: number;
  amount: number;
  at: Date;
  entityId: number;
  name: string | null;
  num: number | null;
}

/** The legacy handler's text for each source, unchanged. */
function toRow(r: RawActivity): ActivityRow {
  const date = format(new Date(r.at), 'dd MMM yyyy');
  switch (r.kind) {
    case 'repayment':
      return {
        id: `repayment-${r.id}`,
        type: 'Loan',
        action: 'Repayment Received',
        details: `Received payment from ${r.name || 'Unknown'} for period ${r.num}`,
        date,
        amount: r.amount,
        entityId: r.entityId,
        entityType: 'loan',
      };
    case 'contribution':
      return {
        id: `contribution-${r.id}`,
        type: 'Chit Fund',
        action: 'Contribution Received',
        details: `Received contribution for ${r.name || 'Unknown Fund'} (Month ${r.num})`,
        date,
        amount: r.amount,
        entityId: r.entityId,
        entityType: 'chitFund',
      };
    case 'auction':
      return {
        id: `auction-${r.id}`,
        type: 'Chit Fund',
        action: 'Auction Completed',
        details: `${r.name || 'Unknown Fund'} auction for Month ${r.num}`,
        date,
        amount: r.amount,
        entityId: r.entityId,
        entityType: 'chitFund',
      };
    default:
      return {
        id: `loan-${r.id}`,
        type: 'Loan',
        action: 'Loan Disbursed',
        details: `Disbursed loan to ${r.name || 'Unknown'}`,
        date,
        amount: r.amount,
        entityId: r.entityId,
        entityType: 'loan',
      };
  }
}

export async function getActivitiesList(userId: number, query: ActivitiesListQuery): Promise<ActivitiesListResult> {
  const { page, pageSize, q, type, from, to, sort, order } = query;

  // Each source is only included when the type filter allows it (Postgres then never reads it).
  const branches: Prisma.Sql[] = [];
  if (type !== 'chit') {
    branches.push(Prisma.sql`
      SELECT 'repayment'::text AS kind, 0 AS rank, r.id, r.amount, r."paidDate" AS at, l.id AS "entityId", g.name AS name, r.period AS num
      FROM "Repayment" r
      JOIN "Loan" l ON l.id = r."loanId"
      LEFT JOIN "GlobalMember" g ON g.id = l."borrowerId"
      WHERE l."createdById" = ${userId}`);
  }
  if (type !== 'loan') {
    branches.push(Prisma.sql`
      SELECT 'contribution'::text AS kind, 1 AS rank, c.id, c.amount, c."paidDate" AS at, f.id AS "entityId", f.name AS name, c.month AS num
      FROM "Contribution" c
      JOIN "ChitFund" f ON f.id = c."chitFundId"
      WHERE f."createdById" = ${userId}`);
    branches.push(Prisma.sql`
      SELECT 'auction'::text AS kind, 2 AS rank, x.id, x.amount, x.date AS at, f.id AS "entityId", f.name AS name, x.month AS num
      FROM "Auction" x
      JOIN "ChitFund" f ON f.id = x."chitFundId"
      WHERE f."createdById" = ${userId}`);
  }
  if (type !== 'chit') {
    branches.push(Prisma.sql`
      SELECT 'loan'::text AS kind, 3 AS rank, l.id, l.amount, l."disbursementDate" AS at, l.id AS "entityId", g.name AS name, NULL::int AS num
      FROM "Loan" l
      LEFT JOIN "GlobalMember" g ON g.id = l."borrowerId"
      WHERE l."createdById" = ${userId}`);
  }

  const conditions: Prisma.Sql[] = [];
  if (q) conditions.push(Prisma.sql`a.name ILIKE ${likePattern(q)}`);
  // No `Z`: parsed as the server's local midnight, matching format() in toRow.
  if (from) conditions.push(Prisma.sql`a.at >= ${new Date(`${from}T00:00:00`)}`);
  if (to) conditions.push(Prisma.sql`a.at <= ${new Date(`${to}T23:59:59.999`)}`);
  const where = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;
  const source = Prisma.sql`(${Prisma.join(branches, ' UNION ALL ')}) a`;

  const column = Prisma.raw(sort === 'amount' ? 'a.amount' : 'a.at');
  const direction = Prisma.raw(order === 'asc' ? 'ASC' : 'DESC');
  const skip = (page - 1) * pageSize;

  const [rows, counted] = await Promise.all([
    prisma.$queryRaw<RawActivity[]>`
      SELECT a.kind, a.id, a.amount, a.at, a."entityId", a.name, a.num
      FROM ${source}
      ${where}
      ORDER BY ${column} ${direction}, a.rank ASC, a.id ${direction}
      LIMIT ${pageSize} OFFSET ${skip}`,
    prisma.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM ${source} ${where}`,
  ]);

  const totalCount = counted[0]?.n ?? 0;
  const meta = buildMeta({ page, pageSize, totalCount, sort, order, q });
  return {
    activities: rows.map(toRow),
    totalCount,
    page,
    pageSize,
    totalPages: meta.totalPages,
    meta,
  };
}
