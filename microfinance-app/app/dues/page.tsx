"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Kind = "loan" | "chit";
type Status = "overdue" | "due-today" | "upcoming";

interface DuePeriod {
  period: number;
  dueDate: string;
  expected: number;
  paid: number;
  outstanding: number;
  daysOverdue: number;
  status: Status;
}

interface DueAccount {
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

interface DuesResponse {
  asOf: string;
  summary: {
    overdueAmount: number;
    overdueAccounts: number;
    overdueMembers: number;
    dueSoonAmount: number;
    dueLaterAmount: number;
    totalOutstanding: number;
    aging: Record<string, number>;
  };
  accounts: DueAccount[];
}

const AGING_ORDER = ["1-30", "31-60", "61-90", "90+"];
const AGING_STYLE: Record<string, string> = {
  "1-30": "bg-amber-400",
  "31-60": "bg-orange-500",
  "61-90": "bg-red-500",
  "90+": "bg-red-800",
};

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const fmt = (n: number) => inr.format(n);
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function overdueBadge(account: DueAccount) {
  if (account.maxDaysOverdue > 0) {
    const d = account.maxDaysOverdue;
    const cls = d > 90 ? "bg-red-800 text-white" : d > 60 ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" : d > 30 ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{d} day{d === 1 ? "" : "s"} overdue</span>;
  }
  const next = account.periods[0];
  if (next?.status === "due-today") {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">Due today</span>;
  }
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-surface-elevated dark:text-theme-secondary">Due {next ? fmtDate(next.dueDate) : ""}</span>;
}

function periodLabel(kind: Kind, frequency: string, period: number) {
  if (kind === "chit") return `Month ${period}`;
  return frequency === "Weekly" ? `Week ${period}` : `Installment ${period}`;
}

function whatsappLink(account: DueAccount) {
  const digits = (account.contact || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const phone = digits.length === 10 ? `91${digits}` : digits;
  const lines = account.periods.map(
    (p) => `• ${periodLabel(account.kind, account.frequency, p.period)} (due ${fmtDate(p.dueDate)}): ${fmt(p.outstanding)}`
  );
  const text = [
    `Hello ${account.memberName},`,
    `This is a reminder for your ${account.kind === "loan" ? "loan" : "chit fund"} payment — ${account.entityName}.`,
    ...lines,
    `Total due: ${fmt(account.totalOutstanding)}`,
    "Thank you.",
  ].join("\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

function toCsv(accounts: DueAccount[]) {
  const header = ["Member", "Contact", "Type", "Account", "Period", "Due Date", "Expected", "Paid", "Outstanding", "Days Overdue", "Status"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = accounts.flatMap((a) =>
    a.periods.map((p) => [
      a.memberName, a.contact, a.kind === "loan" ? "Loan" : "Chit Fund", a.entityName,
      periodLabel(a.kind, a.frequency, p.period), p.dueDate.slice(0, 10), p.expected, p.paid, p.outstanding, p.daysOverdue, p.status,
    ])
  );
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

export default function DuesTrackerPage() {
  const [data, setData] = useState(null as DuesResponse | null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [horizonDays, setHorizonDays] = useState(30);
  const [kind, setKind] = useState("all" as "all" | Kind);
  const [statusFilter, setStatusFilter] = useState("all" as "all" | "overdue" | "upcoming");
  const [agingFilter, setAgingFilter] = useState("" as string);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("overdue" as "overdue" | "amount" | "name");
  const [expanded, setExpanded] = useState({} as Record<string, boolean>);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/dues?horizonDays=${horizonDays}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load dues");
      setData(body);
    } catch (e: any) {
      setError(e.message || "Failed to load dues");
    } finally {
      setLoading(false);
    }
  }, [horizonDays]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const inBucket = (d: number) => {
      if (!agingFilter) return true;
      const [lo, hi] = agingFilter === "90+" ? [91, Infinity] : agingFilter.split("-").map(Number);
      return d >= lo && d <= hi;
    };
    const list = data.accounts.filter((a) => {
      if (kind !== "all" && a.kind !== kind) return false;
      if (statusFilter === "overdue" && a.overdueAmount <= 0) return false;
      if (statusFilter === "upcoming" && a.upcomingAmount <= 0) return false;
      if (agingFilter && (a.overdueAmount <= 0 || !inBucket(a.maxDaysOverdue))) return false;
      if (q && !`${a.memberName} ${a.entityName} ${a.contact || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === "amount") return b.totalOutstanding - a.totalOutstanding;
      if (sort === "name") return a.memberName.localeCompare(b.memberName);
      return b.maxDaysOverdue - a.maxDaysOverdue || b.totalOutstanding - a.totalOutstanding;
    });
  }, [data, kind, statusFilter, agingFilter, search, sort]);

  const filteredTotal = filtered.reduce((s, a) => s + a.totalOutstanding, 0);

  function exportCsv() {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dues-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const agingTotal = data ? AGING_ORDER.reduce((s, k) => s + (data.summary.aging[k] || 0), 0) : 0;

  return (
    <div className="page-container">
      <div className="flex flex-row flex-wrap items-center justify-between gap-2 mb-4 sm:mb-6">
        <div>
          <h1 className="page-title">Dues Tracker</h1>
          <p className="text-sm text-gray-500 dark:text-theme-muted">Overdue and upcoming loan installments and chit contributions</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-neutral px-3 py-2 rounded-md text-sm" disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button onClick={exportCsv} className="btn-primary text-sm" disabled={!filtered.length}>
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-error mb-4 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={load} className="underline text-sm">Retry</button>
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Tile
          label="Overdue"
          value={data ? fmt(data.summary.overdueAmount) : "—"}
          hint={data ? `${data.summary.overdueAccounts} accounts · ${data.summary.overdueMembers} members` : ""}
          tone="red"
          loading={loading && !data}
          onClick={() => { setStatusFilter("overdue"); setAgingFilter(""); }}
        />
        <Tile
          label="Due in next 7 days"
          value={data ? fmt(data.summary.dueSoonAmount) : "—"}
          hint="Includes today"
          tone="amber"
          loading={loading && !data}
          onClick={() => { setStatusFilter("upcoming"); setAgingFilter(""); }}
        />
        <Tile
          label={`Due later (≤ ${horizonDays} days)`}
          value={data ? fmt(data.summary.dueLaterAmount) : "—"}
          hint="Upcoming"
          tone="blue"
          loading={loading && !data}
          onClick={() => { setStatusFilter("upcoming"); setAgingFilter(""); }}
        />
        <Tile
          label="Total to collect"
          value={data ? fmt(data.summary.totalOutstanding) : "—"}
          hint="Overdue + upcoming"
          tone="gray"
          loading={loading && !data}
          onClick={() => { setStatusFilter("all"); setAgingFilter(""); }}
        />
      </div>

      {/* Aging */}
      {data && agingTotal > 0 && (
        <div className="themed-card p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-theme-secondary">Overdue aging</h2>
            {agingFilter && (
              <button className="text-xs text-blue-600 hover:underline" onClick={() => setAgingFilter("")}>Clear aging filter</button>
            )}
          </div>
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-surface-elevated" aria-hidden="true">
            {AGING_ORDER.map((k) =>
              data.summary.aging[k] > 0 ? (
                <div key={k} className={AGING_STYLE[k]} style={{ width: `${(data.summary.aging[k] / agingTotal) * 100}%` }} />
              ) : null
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            {AGING_ORDER.map((k) => (
              <button
                key={k}
                onClick={() => { setAgingFilter(agingFilter === k ? "" : k); setStatusFilter("overdue"); }}
                className={`text-left rounded-md p-2 border transition-colors ${agingFilter === k ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-transparent hover:bg-gray-50 dark:hover:bg-surface-hover"}`}
              >
                <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-theme-muted">
                  <span className={`inline-block w-2.5 h-2.5 rounded-sm ${AGING_STYLE[k]}`} />
                  {k} days
                </span>
                <span className="block text-sm font-semibold text-gray-900 dark:text-theme-primary">{fmt(data.summary.aging[k] || 0)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="themed-card p-3 sm:p-4 mb-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search member, account, phone"
          className="themed-input text-sm col-span-2"
          aria-label="Search dues"
        />
        <select value={kind} onChange={(e) => setKind(e.target.value as any)} className="themed-input text-sm" aria-label="Type">
          <option value="all">Loans & chits</option>
          <option value="loan">Loans only</option>
          <option value="chit">Chit funds only</option>
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); setAgingFilter(""); }} className="themed-input text-sm" aria-label="Status">
          <option value="all">Overdue & upcoming</option>
          <option value="overdue">Overdue only</option>
          <option value="upcoming">Upcoming only</option>
        </select>
        <div className="flex gap-2">
          <select value={horizonDays} onChange={(e) => setHorizonDays(Number(e.target.value))} className="themed-input text-sm flex-1" aria-label="Look ahead">
            <option value={7}>Next 7 days</option>
            <option value={30}>Next 30 days</option>
            <option value={60}>Next 60 days</option>
            <option value={90}>Next 90 days</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="themed-input text-sm flex-1" aria-label="Sort">
            <option value="overdue">Most overdue</option>
            <option value="amount">Highest amount</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      {/* List */}
      {loading && !data ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="themed-card h-20 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="themed-card p-10 text-center">
          <p className="text-gray-700 dark:text-theme-secondary font-medium">Nothing to collect here</p>
          <p className="text-sm text-gray-500 dark:text-theme-muted mt-1">No dues match the current filters.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500 dark:text-theme-muted mb-2">
            {filtered.length} account{filtered.length === 1 ? "" : "s"} · {fmt(filteredTotal)}
          </p>
          <ul className="space-y-2">
            {filtered.map((a) => {
              const isOpen = !!expanded[a.key];
              const wa = whatsappLink(a);
              return (
                <li key={a.key} className={`themed-card overflow-hidden border-l-4 ${a.overdueAmount > 0 ? "border-l-red-500" : "border-l-blue-400"}`}>
                  <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <button
                      className="flex-1 min-w-0 text-left"
                      onClick={() => setExpanded((e) => ({ ...e, [a.key]: !isOpen }))}
                      aria-expanded={isOpen}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-theme-primary">{a.memberName}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${a.kind === "loan" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" : "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"}`}>
                          {a.kind === "loan" ? "Loan" : "Chit"}
                        </span>
                        {overdueBadge(a)}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-theme-muted truncate">
                        {a.entityName} · {a.periods.length} {a.periods.length === 1 ? "payment" : "payments"} pending
                        {a.oldestDueDate ? ` · since ${fmtDate(a.oldestDueDate)}` : ""}
                      </p>
                    </button>
                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="text-right">
                        <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-theme-primary">{fmt(a.totalOutstanding)}</p>
                        {a.overdueAmount > 0 && a.overdueAmount !== a.totalOutstanding && (
                          <p className="text-xs text-red-600 tabular-nums">{fmt(a.overdueAmount)} overdue</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {a.contact && (
                          <a href={`tel:${a.contact}`} className="p-2 rounded-md border border-gray-200 dark:border-surface-border text-gray-600 hover:text-blue-600" title={`Call ${a.contact}`} aria-label={`Call ${a.memberName}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                          </a>
                        )}
                        {wa && (
                          <a href={wa} target="_blank" rel="noopener noreferrer" className="p-2 rounded-md border border-gray-200 dark:border-surface-border text-gray-600 hover:text-green-600" title="Send WhatsApp reminder" aria-label={`Send reminder to ${a.memberName}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                          </a>
                        )}
                        <Link href={a.actionHref} className="btn-primary text-xs whitespace-nowrap">
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
                            <tr key={p.period} className="border-t border-gray-200/60 dark:border-surface-border">
                              <td className="py-1.5">{periodLabel(a.kind, a.frequency, p.period)}</td>
                              <td className="py-1.5">{fmtDate(p.dueDate)}</td>
                              <td className="py-1.5 text-right tabular-nums">{fmt(p.expected)}</td>
                              <td className="py-1.5 text-right tabular-nums">{p.paid > 0 ? fmt(p.paid) : "—"}</td>
                              <td className="py-1.5 text-right tabular-nums font-semibold">{fmt(p.outstanding)}</td>
                              <td className={`py-1.5 text-right text-xs ${p.status === "overdue" ? "text-red-600" : p.status === "due-today" ? "text-blue-600" : "text-gray-500"}`}>
                                {p.status === "overdue" ? `${p.daysOverdue}d late` : p.status === "due-today" ? "Today" : "Upcoming"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="flex flex-wrap gap-3 mt-3 text-xs">
                        <Link href={a.detailHref} className="text-blue-600 hover:underline">Open {a.kind === "loan" ? "loan" : "chit fund"} details →</Link>
                        {a.contact && <span className="text-gray-500 dark:text-theme-muted">Contact: {a.contact}</span>}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, hint, tone, loading, onClick }: { label: string; value: string; hint: string; tone: "red" | "amber" | "blue" | "gray"; loading: boolean; onClick: () => void }) {
  const border = { red: "border-red-500", amber: "border-amber-500", blue: "border-blue-500", gray: "border-gray-400" }[tone];
  const text = { red: "text-red-600 dark:text-red-400", amber: "text-amber-600 dark:text-amber-400", blue: "text-blue-600 dark:text-blue-400", gray: "text-gray-900 dark:text-theme-primary" }[tone];
  return (
    <button onClick={onClick} className={`themed-card p-3 sm:p-4 border-l-4 ${border} text-left hover:shadow-md transition-shadow`}>
      <p className="text-xs font-medium text-gray-500 dark:text-theme-muted">{label}</p>
      {loading ? (
        <div className="h-7 mt-1 w-24 bg-gray-100 dark:bg-surface-elevated rounded animate-pulse" />
      ) : (
        <p className={`text-xl sm:text-2xl font-bold tabular-nums ${text}`}>{value}</p>
      )}
      <p className="text-[11px] text-gray-400 dark:text-theme-muted mt-0.5">{hint}</p>
    </button>
  );
}
