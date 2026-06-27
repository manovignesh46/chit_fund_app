// @ts-nocheck
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { apiGet, apiPost, apiDelete } from '../../../lib/apiUtils';
import { formatCurrency } from '../../../lib/formatUtils';
import PageSectionHeader from '../../components/layout/PageSectionHeader';

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
  const [members, setMembers] = useState<Member[]>([]);
  const [fundMeta, setFundMeta] = useState<{ duration: number; currentMonth: number; name: string } | null>(null);
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

  const bookedMemberIds = useMemo(
    () => new Set(bookings.map((b) => b.memberId)),
    [bookings]
  );

  const bookingsByMonth = useMemo(() => {
    if (!fundMeta) return [];
    const map = new Map<number, Booking[]>();
    for (let m = 1; m <= fundMeta.duration; m++) {
      map.set(m, []);
    }
    for (const b of bookings) {
      const list = map.get(b.month) || [];
      list.push(b);
      map.set(b.month, list);
    }
    return Array.from(map.entries()).map(([month, monthBookings]) => ({
      month,
      bookings: monthBookings,
    }));
  }, [bookings, fundMeta]);

  const availableMembers = members.filter((m) => !bookedMemberIds.has(m.id));

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
        subtitle="Plan future auction winners in advance. Each member can be booked in only one month."
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
              <strong>{bookings.length}</strong> of <strong>{members.length}</strong> members booked
            </span>
            <span>
              <strong>{availableMembers.length}</strong> unassigned
            </span>
          </div>

          <div className="themed-card overflow-hidden">
            <div className="table-shell">
              <table className="w-full min-w-[600px] divide-y divide-surface-border text-sm">
                <thead className="bg-gray-50 dark:bg-surface-elevated">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Booked Member(s)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {bookingsByMonth.map(({ month, bookings: monthBookings }) => {
                    const isPast = month < fundMeta.currentMonth;
                    const isCurrent = month === fundMeta.currentMonth;
                    return (
                      <tr
                        key={month}
                        className={`hover:bg-gray-50 dark:hover:bg-surface-hover ${
                          isCurrent ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-medium">Month {month}</span>
                          {isCurrent && (
                            <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(current)</span>
                          )}
                          {isPast && (
                            <span className="ml-2 text-xs text-gray-400">(past)</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {monthBookings.length === 0 ? (
                            <span className="text-gray-400 italic">Unbooked</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {monthBookings.map((b) => (
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
                                    title="Remove booking"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
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
