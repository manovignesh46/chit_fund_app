// @ts-nocheck
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../../lib/apiUtils';
import { formatCurrency, formatDate } from '../../../lib/formatUtils';
import { formatCalendarMonthLabel } from '../../../lib/monthlyAggregations';
import PageSectionHeader from '../../components/layout/PageSectionHeader';
import BackTitle from '../../components/common/BackTitle';

interface AuctionHistoryRow {
  chitFundId: number;
  fundName: string;
  fundStatus: string;
  amount: number;
  date: string;
  memberName: string;
  fundMonth: number;
}

interface MonthGroup {
  year: number;
  month: number;
  label: string;
  total: number;
  rows: AuctionHistoryRow[];
}

export default function AuctionHistoryPage() {
  const [auctions, setAuctions] = useState<AuctionHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiGet(
          '/api/projection/auction-history',
          'Failed to load auction history'
        );
        setAuctions(data.auctions || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const groups = useMemo<MonthGroup[]>(() => {
    const map = new Map<string, MonthGroup>();
    for (const a of auctions) {
      const d = new Date(a.date);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${month}`;
      const existing = map.get(key);
      if (existing) {
        existing.rows.push(a);
        existing.total += a.amount;
      } else {
        map.set(key, {
          year,
          month,
          label: formatCalendarMonthLabel(year, month),
          total: a.amount,
          rows: [a],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [auctions]);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageSectionHeader
        title={
          <BackTitle
            title="Auction History"
            href="/chit-funds/projection"
            ariaLabel="Back to Projection"
          />
        }
        subtitle="All completed auction payouts across your chit funds, most recent first."
      />

      {error && (
        <div className="alert-error mb-6 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      )}

      {!loading && groups.length === 0 && !error && (
        <p className="text-center text-gray-500 py-12">No completed auctions yet.</p>
      )}

      {!loading &&
        groups.map((group) => (
          <div key={`${group.year}-${group.month}`} className="themed-card overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-theme-secondary">
                {group.label}
              </h3>
              <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                {formatCurrency(group.total)}
              </span>
            </div>
            <div className="table-shell">
              <table className="w-full min-w-[640px] divide-y divide-surface-border text-sm">
                <thead className="bg-gray-50 dark:bg-surface-elevated">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase">
                      Chit Fund
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase">
                      Member
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase">
                      Fund Month
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase">
                      Date
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-theme-muted uppercase">
                      Payout
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {group.rows.map((a, i) => (
                    <tr key={`${a.chitFundId}-${a.fundMonth}-${i}`}>
                      <td className="px-3 py-2 text-gray-900 dark:text-theme-primary">
                        {a.fundName}
                        {a.fundStatus !== 'Active' && (
                          <span className="ml-1.5 text-xs text-gray-400 dark:text-theme-muted">
                            ({a.fundStatus})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium text-blue-600 dark:text-blue-400">
                        {a.memberName}
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-theme-muted">
                        Month {a.fundMonth}
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-theme-muted">
                        {formatDate(a.date)}
                      </td>
                      <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">
                        {formatCurrency(a.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </div>
  );
}
