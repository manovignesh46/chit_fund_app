"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DueAccountCard, { fmt, periodLabel, type DueAccount, type Kind } from "../components/dues/DueAccountCard";

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
            {filtered.map((a) => <DueAccountCard key={a.key} account={a} />)}
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
