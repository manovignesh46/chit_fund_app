// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { dashboardAPI } from '../../lib/api';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';

const formatCurrency = (amount: number | undefined) => {
  if (amount === undefined) return '';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

interface Event {
  id: string;
  title: string;
  date: string;
  type: 'Loan' | 'Chit Fund';
  isDueTomorrow?: boolean;
  rawDate?: Date;
  entityId?: number;
  entityType?: string;
  period?: number;
  status?: 'Paid' | 'Overdue';
  paymentType?: string;
  dueAmount?: number;
}

const navBtnClass = 'btn-neutral p-2 rounded-lg text-sm sm:text-base';

function getEventChipClass(event: Event): string {
  if (event.status === 'Overdue') return 'calendar-event calendar-event-overdue';
  if (event.status === 'Paid') return 'calendar-event calendar-event-paid';
  if (event.isDueTomorrow) return 'calendar-event calendar-event-due';
  if (event.type === 'Loan') return 'calendar-event calendar-event-loan';
  return 'calendar-event calendar-event-chit';
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'Loan' | 'Chit Fund'>('all');

  useEffect(() => {
    const fetchEventsForMonth = async () => {
      try {
        setLoading(true);
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth() + 1;

        const data = await fetch(
          `/api/dashboard/consolidated?action=events&view=calendar&year=${year}&month=${month}`
        ).then((res) => res.json());

        const eventsWithDates = data.map((event: Event) => {
          let parsedDate: Date;
          const parts = event.date.split(' ');
          if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const monthName = parts[1];
            const yearNum = parseInt(parts[2]);
            const monthMap: Record<string, number> = {
              January: 0, February: 1, March: 2, April: 3,
              May: 4, June: 5, July: 6, August: 7,
              September: 8, October: 9, November: 10, December: 11,
            };
            const monthIndex = monthMap[monthName];
            parsedDate =
              !isNaN(day) && monthIndex !== undefined && !isNaN(yearNum)
                ? new Date(yearNum, monthIndex, day)
                : new Date();
          } else {
            parsedDate = new Date();
          }
          return { ...event, rawDate: parsedDate };
        });

        setEvents(eventsWithDates);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching events:', err);
        setError(err.message || 'Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    fetchEventsForMonth();
  }, [currentMonth]);

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDay = (day: Date) =>
    events.filter((event) => {
      if (!event.rawDate) return false;
      if (filter !== 'all' && event.type !== filter) return false;
      return isSameDay(event.rawDate, day);
    });

  const backLink = (
    <Link
      href="/dashboard"
      className={`${navBtnClass} sm:px-4 sm:py-2 flex items-center justify-center`}
      aria-label="Back to Dashboard"
    >
      <svg className="h-5 w-5 block sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
      </svg>
      <span className="hidden sm:inline-flex items-center">
        <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </span>
    </Link>
  );

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex justify-between items-center mb-6">{backLink}</div>
        <div className="themed-card p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-surface-elevated rounded w-1/4 mb-6" />
            <div className="grid grid-cols-7 gap-2">
              {[...Array(35)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 dark:bg-surface-elevated rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="flex justify-between items-center mb-6">{backLink}</div>
        <div className="alert-error px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex flex-row flex-wrap items-center justify-between gap-3 mb-6 sm:mb-8">
        <h1 className="page-title">Calendar</h1>
        {backLink}
      </div>

      <div className="themed-card p-2 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4 mb-6">
          <div className="flex flex-row gap-2">
            <button onClick={prevMonth} className={navBtnClass} aria-label="Previous Month">
              <span className="hidden sm:inline">Prev</span>
              <span className="sm:hidden">‹</span>
            </button>
            <button
              onClick={goToToday}
              className="btn-primary p-2 rounded-lg text-sm sm:text-base sm:px-4 sm:py-2"
              aria-label="Go to Today"
            >
              Today
            </button>
            <button onClick={nextMonth} className={navBtnClass} aria-label="Next Month">
              <span className="hidden sm:inline">Next</span>
              <span className="sm:hidden">›</span>
            </button>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-theme-heading">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex flex-row gap-2">
            <button
              onClick={() => setFilter('all')}
              className={filter === 'all' ? 'filter-chip-active-blue' : 'filter-chip'}
            >
              All
            </button>
            <button
              onClick={() => setFilter('Loan')}
              className={filter === 'Loan' ? 'filter-chip-active-green' : 'filter-chip'}
            >
              Loans
            </button>
            <button
              onClick={() => setFilter('Chit Fund')}
              className={filter === 'Chit Fund' ? 'filter-chip-active-blue' : 'filter-chip'}
            >
              Chit Funds
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="calendar-day-header">
              {day}
            </div>
          ))}
        </div>

        {events.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-theme-muted">
            <p className="text-lg font-semibold mb-2">No events found</p>
            <p>There are no events scheduled for this month.</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {[...Array(monthStart.getDay())].map((_, i) => (
              <div key={`empty-start-${i}`} className="calendar-day-empty" />
            ))}

            {monthDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toString()}
                  className={isToday ? 'calendar-day calendar-day-today' : 'calendar-day'}
                >
                  <div className="font-semibold mb-1 text-gray-900 dark:text-theme-primary">
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1 overflow-y-auto max-h-20">
                    {dayEvents.map((event) => {
                      let eventLink = '#';
                      if (event.entityType === 'loan' && event.entityId) {
                        eventLink = `/loans/${event.entityId}`;
                      } else if (event.entityType === 'chitFund' && event.entityId) {
                        eventLink = `/chit-funds/${event.entityId}`;
                      }

                      return (
                        <Link
                          href={eventLink}
                          key={event.id}
                          className={getEventChipClass(event)}
                        >
                          <div className="font-semibold truncate">
                            {event.title.includes('Loan Payment')
                              ? event.title.split('Loan Payment')[0].trim().replace(/\s+$/, '')
                              : event.title}
                            {event.dueAmount !== undefined && (
                              <span className="font-medium">: {formatCurrency(event.dueAmount)}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <div className="flex items-center">
                              <span
                                className={`inline-block w-2 h-2 rounded-full mr-1 ${
                                  event.type === 'Loan' ? 'bg-green-500' : 'bg-blue-500'
                                }`}
                              />
                              <span className="text-xs opacity-80">{event.type}</span>
                              {event.isDueTomorrow && (
                                <span className="ml-1 text-xs font-semibold">Due Tomorrow</span>
                              )}
                              {event.status === 'Paid' && (
                                <span className="ml-1 text-xs font-semibold">Paid</span>
                              )}
                              {event.status === 'Overdue' && (
                                <span className="ml-1 text-xs font-semibold">OD</span>
                              )}
                            </div>
                            {event.period && (
                              <span className="text-xs opacity-80">due: {event.period}</span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {[...Array(6 - monthEnd.getDay())].map((_, i) => (
              <div key={`empty-end-${i}`} className="calendar-day-empty" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
