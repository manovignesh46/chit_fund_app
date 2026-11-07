import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { getCurrentUserId } from "../../../lib/auth";
import { buildDueAccounts } from "../../../lib/duesAccounts";
import { DUES_LIST_PARAMS, filterDueAccounts } from "../../../lib/duesList";
import { buildMeta, MAX_PAGE_SIZE } from "../../../lib/list/types";

/**
 * GET /api/dues?asOf=YYYY-MM-DD&horizonDays=30
 *
 * Every unpaid loan installment and chit contribution that is overdue as of
 * `asOf` or falls due within the next `horizonDays`, one row per
 * loan / chit membership, with aging and summary totals.
 *
 * Optional list params (q, kind, status, aging, sort, page, pageSize; see lib/duesList.ts)
 * filter and sort the computed accounts; page/pageSize also page them and add `meta` and
 * `filtered` ({ count, totalOutstanding } of the whole filtered list). The summary always
 * covers every account. With none of them the response is exactly the one before.
 */
export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const asOfParam = params.get("asOf");
    const asOf = asOfParam ? new Date(asOfParam) : new Date();
    const horizonDays = Number(params.get("horizonDays") ?? 30);
    if (isNaN(asOf.getTime()) || !Number.isInteger(horizonDays) || horizonDays < 0 || horizonDays > 366) {
      return NextResponse.json({ error: "Invalid asOf or horizonDays" }, { status: 400 });
    }

    const { accounts, summary } = await buildDueAccounts(prisma, currentUserId, { asOf, horizonDays });
    if (!DUES_LIST_PARAMS.some((name) => params.has(name))) {
      return NextResponse.json({ asOf: asOf.toISOString(), horizonDays, summary, accounts });
    }

    const filtered = filterDueAccounts(accounts, {
      q: params.get("q")?.slice(0, 200),
      kind: params.get("kind"),
      status: params.get("status"),
      aging: params.get("aging"),
      sort: params.get("sort"),
    });
    const filteredTotals = {
      count: filtered.length,
      totalOutstanding: Math.round(filtered.reduce((s, a) => s + a.totalOutstanding, 0) * 100) / 100,
    };
    if (!params.has("page") && !params.has("pageSize")) {
      return NextResponse.json({ asOf: asOf.toISOString(), horizonDays, summary, accounts: filtered, filtered: filteredTotals });
    }
    const page = Math.max(1, parseInt(params.get("page") || "1") || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(params.get("pageSize") || "25") || 25));
    const sort = params.get("sort");
    return NextResponse.json({
      asOf: asOf.toISOString(),
      horizonDays,
      summary,
      accounts: filtered.slice((page - 1) * pageSize, page * pageSize),
      filtered: filteredTotals,
      meta: buildMeta({ page, pageSize, totalCount: filtered.length, sort, order: null, q: params.get("q") || null }),
    });
  } catch (error: any) {
    console.error("Error fetching dues:", error);
    return NextResponse.json({ error: "Failed to fetch dues" }, { status: 500 });
  }
}
