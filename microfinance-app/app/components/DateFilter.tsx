'use client';

import { useState, useRef, useEffect } from 'react';

interface DateFilterProps {
  onDateRangeChange: (startDate?: string, endDate?: string) => void;
  className?: string;
}

export default function DateFilter({ onDateRangeChange, className = '' }: DateFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [showCustomCalendar, setShowCustomCalendar] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const dropdownRef = useRef(null as HTMLDivElement | null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCustomCalendar(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDateRange = (period: string) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
      case 'today':
        return {
          start: today.toISOString().split('T')[0],
          end: today.toISOString().split('T')[0]
        };
      
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          start: yesterday.toISOString().split('T')[0],
          end: yesterday.toISOString().split('T')[0]
        };
      
      case 'lastWeek':
        const lastWeekStart = new Date(today);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        const lastWeekEnd = new Date(today);
        lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
        return {
          start: lastWeekStart.toISOString().split('T')[0],
          end: lastWeekEnd.toISOString().split('T')[0]
        };
      
      case 'last7Days':
        const last7Start = new Date(today);
        last7Start.setDate(last7Start.getDate() - 7);
        return {
          start: last7Start.toISOString().split('T')[0],
          end: today.toISOString().split('T')[0]
        };
      
      case 'thisMonth':
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
          start: thisMonthStart.toISOString().split('T')[0],
          end: today.toISOString().split('T')[0]
        };
      
      case 'lastMonth':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          start: lastMonthStart.toISOString().split('T')[0],
          end: lastMonthEnd.toISOString().split('T')[0]
        };
      
      default:
        return { start: undefined, end: undefined };
    }
  };

  const handlePeriodSelect = (period: string) => {
    if (period === 'custom') {
      setShowCustomCalendar(true);
      setSelectedPeriod(period);
      return;
    }

    setSelectedPeriod(period);
    setShowCustomCalendar(false);
    setIsOpen(false);

    const dateRange = getDateRange(period);
    onDateRangeChange(dateRange.start, dateRange.end);
  };

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      setSelectedPeriod('custom');
      setShowCustomCalendar(false);
      setIsOpen(false);
      onDateRangeChange(customStartDate, customEndDate);
    }
  };

  const getDisplayText = () => {
    switch (selectedPeriod) {
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      case 'lastWeek': return 'Last Week';
      case 'last7Days': return 'Last 7 Days';
      case 'thisMonth': return 'This Month';
      case 'lastMonth': return 'Last Month';
      case 'custom': return customStartDate && customEndDate ? `${customStartDate} to ${customEndDate}` : 'Custom';
      default: return 'All Time';
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white flex items-center justify-between hover:bg-gray-50"
      >
        <span className="flex items-center">
          <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {getDisplayText()}
        </span>
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg">
          {!showCustomCalendar ? (
            <div className="py-1">
              <button
                type="button"
                onClick={() => handlePeriodSelect('all')}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${selectedPeriod === 'all' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => handlePeriodSelect('today')}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${selectedPeriod === 'today' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handlePeriodSelect('yesterday')}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${selectedPeriod === 'yesterday' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => handlePeriodSelect('lastWeek')}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${selectedPeriod === 'lastWeek' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
              >
                Last Week
              </button>
              <button
                type="button"
                onClick={() => handlePeriodSelect('last7Days')}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${selectedPeriod === 'last7Days' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => handlePeriodSelect('thisMonth')}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${selectedPeriod === 'thisMonth' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => handlePeriodSelect('lastMonth')}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${selectedPeriod === 'lastMonth' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
              >
                Last Month
              </button>
              <hr className="my-1" />
              <button
                type="button"
                onClick={() => handlePeriodSelect('custom')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 text-gray-700 flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Custom Date Range
              </button>
            </div>
          ) : (
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Select Date Range</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    min={customStartDate}
                    className="w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCustomDateApply}
                    disabled={!customStartDate || !customEndDate}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomCalendar(false)}
                    className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
