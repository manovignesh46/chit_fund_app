// @ts-nocheck
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { apiGet, apiPost, apiDelete } from '../../../lib/apiUtils';
import PageSectionHeader from '../../components/layout/PageSectionHeader';
import { getFundMonthCalendarDate } from '../../../lib/monthlyAggregations';

function formatFundCalendarMonth(startDate: string, fundMonth: number): string {
  const d = getFundMonthCalendarDate(startDate, fundMonth);
  return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}

interface ChitFundOption {
  id: number;
  name: string;
  duration: number;
  status: string;
  currentMonth: number;
}

interface Booking {
  id: number;
  month: number;
  memberId: number;
  memberName: string;
  isPlanned?: boolean;
}

interface CompletedAuction {
  id: number;
  month: number;
  memberId: number;
  memberName: string;
  amount: number;
  date: string;
  isPlanned: false;
}

interface Member {
  id: number;
  name: string;
  contribution: number;
}

export default function AuctionBookingsPage() {
  const [chitFunds, setChitFunds] = useState<ChitFundOption[]>([]);
  const [selectedFundId, setSelectedFundId] = useState<string>('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [completedAuctions, setCompletedAuctions] = useState<CompletedAuction[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [fundMeta, setFundMeta] = useState<{
    duration: number;
    currentMonth: number;
    name: string;
    startDate: string;
  } | null>(null);
  const [loadingFunds, setLoadingFunds] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingMonth, setAddingMonth] = useState<number | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchFunds = async () => {
      try {
        setLoadingFunds(true);
        const data = await apiGet(
          '/api/chit-funds/consolidated?action=list&status=Active&pageSize=100',
          'Failed to load chit funds'
        );
        const funds = data.chitFunds || [];
        setChitFunds(funds);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoadingFunds(false);
      }
    };
    fetchFunds();
  }, []);

  useEffect(() => {
    if (!selectedFundId) {
      setBookings([]);
      setCompletedAuctions([]);
      setMembers([]);
      setFundMeta(null);
      return;
    }

    const fetchBookings = async () => {
      try {
        setLoadingBookings(true);
        setError(null);
        const data = await apiGet(
          `/api/chit-funds/${selectedFundId}/auction-bookings`,
          'Failed to load bookings'
        );
        setBookings(data.bookings || []);
        setCompletedAuctions(data.completedAuctions || []);
        setMembers(data.members || []);
        setFundMeta(data.chitFund);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoadingBookings(false);
      }
    };
    fetchBookings();
  }, [selectedFundId]);

  const assignedMemberIds = useMemo(() => {
    const ids = new Set<number>();
    for (const b of bookings) ids.add(b.memberId);
    for (const a of completedAuctions) ids.add(a.memberId);
    return ids;
  }, [bookings, completedAuctions]);

  const bookingsByMonth = useMemo(() => {
    if (!fundMeta) return [];
    const map = new Map<
      number,
      { planned: Booking[]; completed: CompletedAuction[] }
    >();
    for (let m = 1; m <= fundMeta.duration; m++) {
      map.set(m, { planned: [], completed: [] });
    }
    for (const b of bookings) {
      const entry = map.get(b.month) || { planned: [], completed: [] };
      entry.planned.push(b);
      map.set(b.month, entry);
    }
    for (const a of completedAuctions) {
      const entry = map.get(a.month) || { planned: [], completed: [] };
      entry.completed.push(a);
      map.set(a.month, entry);
    }
    return Array.from(map.entries()).map(([month, { planned, completed }]) => ({
      month,
      planned,
      completed,
    }));
  }, [bookings, completedAuctions, fundMeta]);

  const availableMembers = members.filter((m) => !assignedMemberIds.has(m.id));
  const totalAssigned = assignedMemberIds.size;
  const plannedCount = bookings.length;
  const completedCount = completedAuctions.length;

  const handleAddBooking = async (month: number) => {
    if (!selectedMemberId || !selectedFundId) return;
    setSaving(true);
    setError(null);
    try {
      const newBooking = await apiPost(
        `/api/chit-funds/${selectedFundId}/auction-bookings`,
        { month, memberId: Number(selectedMemberId) },
        'Failed to add booking'
      );
      setBookings((prev) => [...prev, newBooking]);
      setSelectedMemberId('');
      setAddingMonth(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveBooking = async (bookingId: number) => {
    if (!selectedFundId) return;
    setSaving(true);
    setError(null);
    try {
      await apiDelete(
        `/api/chit-funds/${selectedFundId}/auction-bookings`,
        { bookingId },
        'Failed to remove booking'
      );
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <PageSectionHeader
        title="Auction Booking"
        subtitle="Plan future auction winners. Green tags are completed auctions; blue tags are planned bookings you can edit."
        actions={
          <Link
            href="/chit-funds/projection"
            className="btn-neutral px-4 py-2 text-sm"
          >
            Back to Projection
          </Link>
        }
      />

      <div className="dark-card p-4 sm:p-6 mb-6">
        <label htmlFor="chitFund" className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-2">
          Select Chit Fund
        </label>
        <select
          id="chitFund"
          value={selectedFundId}
          onChange={(e) => setSelectedFundId(e.target.value)}
          disabled={loadingFunds}
          className="themed-input w-full max-w-md"
        >
          <option value="">Choose a chit fund…</option>
          {chitFunds.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} (Month {f.currentMonth}/{f.duration})
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="alert-error mb-6 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
      )}

      {loadingBookings && selectedFundId && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      )}

      {!loadingBookings && fundMeta && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-theme-secondary">
            <span>
              <strong>{totalAssigned}</strong> of <strong>{members.length}</strong> members assigned
            </span>
            {completedCount > 0 && (
              <span>
                <strong>{completedCount}</strong> completed auction{completedCount !== 1 ? 's' : ''}
              </span>
            )}
            {plannedCount > 0 && (
              <span>
                <strong>{plannedCount}</strong> planned booking{plannedCount !== 1 ? 's' : ''}
              </span>
            )}
            <span>
              <strong>{availableMembers.length}</strong> unassigned
            </span>
          </div>

          <div className="themed-card overflow-hidden">
            <div className="table-shell">
              <table className="w-full min-w-[680px] divide-y divide-surface-border text-sm">
                <thead className="bg-gray-50 dark:bg-surface-elevated">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase w-28">
                      Due Month
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase">
                      Calendar Month
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase">
                      Booked / Won
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {bookingsByMonth.map(({ month, planned, completed }) => {
                    const isPast = month < fundMeta.currentMonth;
                    const isCurrent = month === fundMeta.currentMonth;
                    const calendarLabel = formatFundCalendarMonth(fundMeta.startDate, month);
                    const now = new Date();
                    const calDate = getFundMonthCalendarDate(fundMeta.startDate, month);
                    const isCalendarCurrent =
                      calDate.getFullYear() === now.getFullYear() &&
                      calDate.getMonth() === now.getMonth();
                    const hasAny = planned.length > 0 || completed.length > 0;

                    return (
                      <tr
                        key={month}
                        className={`hover:bg-gray-50 dark:hover:bg-surface-hover ${
                          isCurrent ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="font-medium text-gray-900 dark:text-theme-primary">
                            {month}
                          </span>
                          {isCurrent && (
                            <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(current)</span>
                          )}
                          {isPast && (
                            <span className="ml-2 text-xs text-gray-400 dark:text-theme-muted">(past)</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-gray-700 dark:text-theme-secondary">
                          {calendarLabel}
                          {isCalendarCurrent && (
                            <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">(now)</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {!hasAny ? (
                            <span className="text-gray-400 dark:text-theme-muted italic">Unbooked</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {completed.map((a) => (
                                <span
                                  key={`auction-${a.id}`}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs"
                                  title="Completed auction — recorded on Auctions page"
                                >
                                  {a.memberName}
                                  <span className="text-green-600/70 dark:text-green-400/70">(won)</span>
                                </span>
                              ))}
                              {planned.map((b) => (
                                <span
                                  key={b.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs"
                                >
                                  {b.memberName}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBooking(b.id)}
                                    disabled={saving}
                                    className="ml-1 text-blue-600 hover:text-red-600 disabled:opacity-50"
                                    title="Remove planned booking"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {addingMonth === month ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={selectedMemberId}
                                onChange={(e) => setSelectedMemberId(e.target.value)}
                                className="themed-input text-sm py-1"
                              >
                                <option value="">Select member…</option>
                                {availableMembers.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleAddBooking(month)}
                                disabled={!selectedMemberId || saving}
                                className="btn-primary text-xs px-3 py-1 disabled:opacity-50"
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAddingMonth(null);
                                  setSelectedMemberId('');
                                }}
                                className="btn-neutral text-xs px-3 py-1"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setAddingMonth(month)}
                              disabled={availableMembers.length === 0 || saving}
                              className="text-blue-600 hover:text-blue-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {availableMembers.length === 0 ? 'All members booked' : '+ Add member'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!selectedFundId && !loadingFunds && (
        <p className="text-center text-gray-500 py-12">
          Select a chit fund above to plan auction bookings.
        </p>
      )}
    </div>
  );
}
