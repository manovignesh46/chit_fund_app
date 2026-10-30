import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { getCurrentUserId } from "../../../lib/auth";
import { buildDueAccounts } from "../../../lib/duesAccounts";

/**
 * GET /api/dues?asOf=YYYY-MM-DD&horizonDays=30
 *
 * Every unpaid loan installment and chit contribution that is overdue as of
 * `asOf` or falls due within the next `horizonDays`, one row per
 * loan / chit membership, with aging and summary totals.
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
    return NextResponse.json({ asOf: asOf.toISOString(), horizonDays, summary, accounts });
  } catch (error: any) {
    console.error("Error fetching dues:", error);
    return NextResponse.json({ error: "Failed to fetch dues" }, { status: 500 });
  }
}
