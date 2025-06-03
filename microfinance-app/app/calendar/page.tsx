// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { dashboardAPI } from '../../lib/api';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';

// Helper function to format currency
const formatCurrency = (amount: number | undefined) => {
  if (amount === undefined) return '';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

// Define event interface
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

export default function CalendarPage() {
  // State for current month and events
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'Loan' | 'Chit Fund'>('all');

  // Fetch events from API for the current month
  useEffect(() => {
    const fetchEventsForMonth = async () => {
      try {
        setLoading(true);

        // Get year and month from currentMonth
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth() + 1; // 1-12

        // Fetch events for the specific month
        const data = await fetch(`/api/dashboard/consolidated?action=events&view=calendar&year=${year}&month=${month}`)
          .then(res => res.json());

        // Convert string dates to Date objects for easier comparison
        const eventsWithDates = data.map((event: Event) => {
          // Parse date in format "19 May 2025" to a Date object
          let parsedDate: Date;

          // Manual parsing is more reliable for this format
          const parts = event.date.split(' ');
          if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const monthName = parts[1];
            const year = parseInt(parts[2]);

            // Map month names to numbers (0-11)
            const monthMap: {[key: string]: number} = {
              'January': 0, 'February': 1, 'March': 2, 'April': 3,
              'May': 4, 'June': 5, 'July': 6, 'August': 7,
              'September': 8, 'October': 9, 'November': 10, 'December': 11
            };

            const month = monthMap[monthName];

            if (!isNaN(day) && month !== undefined && !isNaN(year)) {
              parsedDate = new Date(year, month, day);
            } else {
              console.error(`Failed to parse date parts: day=${day}, month=${monthName}(${month}), year=${year}`);
              parsedDate = new Date(); // Fallback to current date
            }
          } else {
            console.error(`Failed to parse date: ${event.date}, parts=${parts.length}`);
            parsedDate = new Date(); // Fallback to current date
          }

          return {
            ...event,
            rawDate: parsedDate
          };
        });

        // Set the processed events with parsed dates

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
  }, [currentMonth]); // Re-fetch when the month changes

  // Navigate to previous month
  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  // Navigate to next month
  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // Navigate to current month
  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  // Get days of current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    const dayEvents = events.filter(event => {
      if (!event.rawDate) {
        return false;
      }

      // Filter by event type if needed
      if (filter !== 'all' && event.type !== filter) return false;

      // Check if the dates are the same day
      return isSameDay(event.rawDate, day);
    });

    return dayEvents;
  };

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-blue-700">Calendar</h1>
          <Link href="/dashboard" className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300">
            Back to Dashboard
          </Link>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-7 gap-2 mb-4">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-6 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {[...Array(35)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-blue-700">Calendar</h1>
          <Link href="/dashboard" className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300">
            Back to Dashboard
          </Link>
        </div>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-6 sm:py-8 max-w-screen-xl w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-blue-700">Calendar</h1>
        <Link href="/dashboard" className="w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300 text-center text-sm sm:text-base">
          Back to Dashboard
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md p-2 sm:p-6">
        {/* Calendar Controls */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4 mb-6">
          <div className="flex flex-row gap-2">
            <button
              onClick={prevMonth}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition duration-300"
            >
              &lt; Prev
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition duration-300"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition duration-300"
            >
              Next &gt;
            </button>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
          <div className="flex flex-row gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('Loan')}
              className={`px-3 py-1 rounded ${
                filter === 'Loan'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Loans
            </button>
            <button
              onClick={() => setFilter('Chit Fund')}
              className={`px-3 py-1 rounded ${
                filter === 'Chit Fund'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Chit Funds
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center font-semibold text-gray-600">
              {day}
            </div>
          ))}
        </div>

        {/* Check if there are any events for this month */}
        {events.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No events found</h3>
            <p className="text-gray-500">There are no events scheduled for this month.</p>
            <p className="text-gray-500 mt-2">Try selecting a different month or creating new events.</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {/* Empty cells for days before the start of the month */}
            {[...Array(monthStart.getDay())].map((_, i) => (
              <div key={`empty-start-${i}`} className="h-24 bg-gray-50 rounded"></div>
            ))}

            {/* Calendar days */}
            {monthDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toString()}
                  className={`h-auto min-h-24 p-2 rounded border ${
                    isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="font-semibold mb-1">{format(day, 'd')}</div>
                  <div className="space-y-1 overflow-y-auto max-h-20">
                    {dayEvents.length > 0 ? (
                      dayEvents.map((event) => {
                        // Generate link based on entity type
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
                            className={`block p-1 text-xs rounded hover:opacity-80 transition-opacity ${
                              event.status === 'Overdue'
                                ? 'bg-red-50 border border-red-200'
                                : event.status === 'Paid'
                                ? 'bg-emerald-50 border border-emerald-200'
                                : event.isDueTomorrow
                                ? 'bg-yellow-50 border border-yellow-200'
                                : event.type === 'Loan'
                                ? 'bg-green-50 border border-green-200'
                                : 'bg-blue-50 border border-blue-200'
                            }`}
                          >
                            {/* Line 1: Name + Amount */}
                            <div className="font-semibold truncate">
                              {/* Extract name from title (remove "Loan Payment (Period X)" part) */}
                              {event.title.includes('Loan Payment')
                                ? event.title.split('Loan Payment')[0].trim().replace(/\s+$/, '')
                                : event.title}
                              {event.dueAmount !== undefined && (
                                <span className="font-medium">: {formatCurrency(event.dueAmount)}</span>
                              )}
                            </div>

                            {/* Line 2: Type indicator + Status + due period */}
                            <div className="flex items-center justify-between mt-1">
                              <div className="flex items-center">
                                <span
                                  className={`inline-block w-2 h-2 rounded-full mr-1 ${
                                    event.type === 'Loan' ? 'bg-green-500' : 'bg-blue-500'
                                  }`}
                                ></span>
                                <span className="text-xs text-gray-600">{event.type}</span>

                                {event.isDueTomorrow && (
                                  <span className="ml-1 text-xs text-amber-600 font-semibold">
                                    Due Tomorrow
                                  </span>
                                )}
                                {event.status === 'Paid' && (
                                  <span className="ml-1 text-xs text-emerald-600 font-semibold">
                                    Paid
                                  </span>
                                )}
                                {event.status === 'Overdue' && (
                                  <span className="ml-1 text-xs text-red-600 font-semibold">
                                    OD
                                  </span>
                                )}
                              </div>

                              {event.period && (
                                <span className="text-xs text-gray-600">
                                  due: {event.period}
                                </span>
                              )}
                            </div>
                          </Link>
                        );
                      })
                    ) : (
                      // Show nothing for empty days
                      null
                    )}
                  </div>
                </div>
              );
            })}

            {/* Empty cells for days after the end of the month */}
            {[...Array(6 - monthEnd.getDay())].map((_, i) => (
              <div key={`empty-end-${i}`} className="h-24 bg-gray-50 rounded"></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
