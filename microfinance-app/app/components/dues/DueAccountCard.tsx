"use client";

import { useState } from "react";
import Link from "next/link";

export type Kind = "loan" | "chit";
export type Status = "overdue" | "due-today" | "upcoming";

export interface DuePeriod {
  period: number;
  dueDate: string;
  expected: number;
  paid: number;
  outstanding: number;
  daysOverdue: number;
  status: Status;
}

export interface DueAccount {
  key: string;
  kind: Kind;
  entityId: number;
  entityName: string;
  memberName: string;
  globalMemberId: number;
  contact?: string;
  installmentAmount: number;
  frequency: string;
  actionHref: string;
  detailHref: string;
  periods: DuePeriod[];
  totalOutstanding: number;
  overdueAmount: number;
  upcomingAmount: number;
  overduePeriods: number;
  oldestDueDate: string | null;
  maxDaysOverdue: number;
}

export const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
export const fmt = (n: number) => inr.format(n);
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

function overdueBadge(account: DueAccount) {
  if (account.maxDaysOverdue > 0) {
    const d = account.maxDaysOverdue;
    const cls =
      d > 90
        ? "bg-red-800 text-white"
        : d > 60
        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
        : d > 30
        ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
        {d} day{d === 1 ? "" : "s"} overdue
      </span>
    );
  }
  const next = account.periods[0];
  if (next?.status === "due-today") {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
        Due today
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-surface-elevated dark:text-theme-secondary">
      Due {next ? fmtDate(next.dueDate) : ""}
    </span>
  );
}

export function periodLabel(kind: Kind, frequency: string, period: number) {
  if (kind === "chit") return `Month ${period}`;
  return frequency === "Weekly" ? `Week ${period}` : `Installment ${period}`;
}

export function whatsappLink(account: DueAccount) {
  const digits = (account.contact || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const phone = digits.length === 10 ? `91${digits}` : digits;
  const lines = account.periods.map(
    (p) =>
      `• ${periodLabel(
        account.kind,
        account.frequency,
        p.period
      )} (due ${fmtDate(p.dueDate)}): ${fmt(p.outstanding)}`
  );
  const text = [
    `Hello ${account.memberName},`,
    `This is a reminder for your ${
      account.kind === "loan" ? "loan" : "chit fund"
    } payment — ${account.entityName}.`,
    ...lines,
    `Total due: ${fmt(account.totalOutstanding)}`,
    "Thank you.",
  ].join("\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

interface Props {
  account: DueAccount;
  /** Show the member name as the heading (Dues Tracker); false on a member's own page. */
  showMember?: boolean;
  defaultOpen?: boolean;
}

/** One loan / chit membership with its unpaid periods and follow-up actions. */
export default function DueAccountCard({
  account: a,
  showMember = true,
  defaultOpen = false,
}: Props) {
  const [isOpen, setOpen] = useState(defaultOpen);
  const wa = whatsappLink(a);
  return (
    <li
      className={`themed-card overflow-hidden border-l-4 ${
        a.overdueAmount > 0 ? "border-l-red-500" : "border-l-blue-400"
      }`}
    >
      <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          className="flex-1 min-w-0 text-left"
          onClick={() => setOpen(!isOpen)}
          aria-expanded={isOpen}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-theme-primary">
              {showMember ? a.memberName : a.entityName}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                a.kind === "loan"
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                  : "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"
              }`}
            >
              {a.kind === "loan" ? "Loan" : "Chit"}
            </span>
            {overdueBadge(a)}
          </div>
          <p className="text-sm text-gray-500 dark:text-theme-muted truncate">
            {showMember ? `${a.entityName} · ` : ""}
            {a.periods.length} {a.periods.length === 1 ? "payment" : "payments"}{" "}
            pending
            {a.oldestDueDate ? ` · since ${fmtDate(a.oldestDueDate)}` : ""}
          </p>
        </button>
        <div className="flex items-center justify-between sm:justify-end gap-3">
          <div className="text-right">
            <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-theme-primary">
              {fmt(a.totalOutstanding)}
            </p>
            {a.overdueAmount > 0 && a.overdueAmount !== a.totalOutstanding && (
              <p className="text-xs text-red-600 tabular-nums">
                {fmt(a.overdueAmount)} overdue
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {a.contact && (
              <a
                href={`tel:${a.contact}`}
                className="p-2 rounded-md border border-gray-200 dark:border-surface-border text-gray-600 hover:text-blue-600"
                title={`Call ${a.contact}`}
                aria-label={`Call ${a.memberName}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
              </a>
            )}
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-md border border-gray-200 dark:border-surface-border text-gray-600 hover:text-green-600"
                title="Send WhatsApp reminder"
                aria-label={`Send reminder to ${a.memberName}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </a>
            )}
            <Link
              href={a.actionHref}
              className="btn-primary text-xs whitespace-nowrap"
            >
              Record payment
            </Link>
          </div>
        </div>
      </div>
      {isOpen && (
        <div className="border-t border-gray-100 dark:border-surface-border bg-gray-50 dark:bg-surface-elevated px-3 sm:px-4 py-3 overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="text-xs text-gray-500 dark:text-theme-muted">
              <tr>
                <th className="text-left font-medium pb-1">Period</th>
                <th className="text-left font-medium pb-1">Due date</th>
                <th className="text-right font-medium pb-1">Expected</th>
                <th className="text-right font-medium pb-1">Paid</th>
                <th className="text-right font-medium pb-1">Outstanding</th>
                <th className="text-right font-medium pb-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {a.periods.map((p) => (
                <tr
                  key={p.period}
                  className="border-t border-gray-200/60 dark:border-surface-border"
                >
                  <td className="py-1.5">
                    {periodLabel(a.kind, a.frequency, p.period)}
                  </td>
                  <td className="py-1.5">{fmtDate(p.dueDate)}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {fmt(p.expected)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {p.paid > 0 ? fmt(p.paid) : "—"}
                  </td>
                  <td className="py-1.5 text-right tabular-nums font-semibold">
                    {fmt(p.outstanding)}
                  </td>
                  <td
                    className={`py-1.5 text-right text-xs ${
                      p.status === "overdue"
                        ? "text-red-600"
                        : p.status === "due-today"
                        ? "text-blue-600"
                        : "text-gray-500"
                    }`}
                  >
                    {p.status === "overdue"
                      ? `${p.daysOverdue}d late`
                      : p.status === "due-today"
                      ? "Today"
                      : "Upcoming"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-3 mt-3 text-xs">
            <Link href={a.detailHref} className="text-blue-600 hover:underline">
              Open {a.kind === "loan" ? "loan" : "chit fund"} details →
            </Link>
            {a.contact && (
              <span className="text-gray-500 dark:text-theme-muted">
                Contact: {a.contact}
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
