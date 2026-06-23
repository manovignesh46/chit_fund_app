// @ts-nocheck
'use client';

import React, { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { GraphSkeleton } from './skeletons/SkeletonLoader';
import { FinancialDataPoint } from '../../lib/api';
import FinancialDetailModal from './FinancialDetailModal';

// Using FinancialDataPoint from the API

interface FinancialGraphProps {
  data: FinancialDataPoint[];
  loading: boolean;
  error: string | null;
}

const FinancialGraph: React.FC<FinancialGraphProps> = ({ data, loading, error }) => {
  const [graphType, setGraphType] = useState<'line' | 'bar'>('line');
  const [showProfit, setShowProfit] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<FinancialDataPoint | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // State to track which data series are visible (for legend click)
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({
    cashInflow: false,
    cashOutflow: false,
    profit: false,
    outsideAmount: false,
  });

  // Handle legend click to toggle visibility of data series
  const handleLegendClick = (dataKey: string) => {
    setHiddenSeries((prev) => ({
      ...prev,
      [dataKey]: !prev[dataKey],
    }));
  };

  // Format currency for tooltip
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Compact Y-axis labels (40000 → 40K, 100000 → 1L)
  const formatYAxis = (value: number) => {
    if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toString();
  };

  // Shorten X-axis period labels on mobile
  const formatXAxis = (label: string) => {
    if (!label) return '';
    // "January 2026" → "Jan 26", "Aug 2025" → "Aug 25"
    const parts = label.split(' ');
    if (parts.length === 2 && parts[1].length === 4) {
      return `${parts[0].slice(0, 3)} '${parts[1].slice(2)}`;
    }
    return label.length > 8 ? label.slice(0, 8) : label;
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="themed-card p-4 border border-gray-200 dark:border-surface-border shadow-md rounded-md">
          <p className="font-semibold text-gray-700 dark:text-theme-secondary">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`tooltip-${index}`} className="flex justify-between gap-4 items-center">
              <div className="flex items-center">
                <div
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: entry.color }}
                ></div>
                <span className="text-sm">{entry.name}:</span>
              </div>
              <span className="text-sm font-medium">{formatCurrency(entry.value)}</span>
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-surface-border">
            <p className="text-xs text-gray-500">Click on any data point for detailed breakdown</p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Legend component with click functionality
  const CustomLegend = ({ payload }: any) => {
    // Always show all legend items, including hidden ones
    const allItems = [
      { dataKey: 'cashInflow', name: 'Cash Inflow', color: '#3b82f6' },
      { dataKey: 'cashOutflow', name: 'Cash Outflow', color: '#ef4444' },
      ...(showProfit ? [{ dataKey: 'profit', name: 'Profit', color: '#10b981' }] : []),
      { dataKey: 'outsideAmount', name: 'Outside Amount', color: '#f97316' },
    ];

    return (
      <div className="flex flex-col items-center gap-2 mt-2">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-center gap-2">
          {allItems.map((item, index) => {
            const isHidden = hiddenSeries[item.dataKey];
            return (
              <div
                key={`legend-${index}`}
                onClick={() => handleLegendClick(item.dataKey)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-all select-none border ${
                  isHidden
                    ? 'bg-gray-50 dark:bg-surface-elevated border-gray-200 dark:border-surface-border opacity-60'
                    : 'themed-card border-transparent hover:bg-gray-50 dark:hover:bg-surface-hover shadow-sm'
                }`}
                title={isHidden ? `Click to show ${item.name}` : `Click to hide ${item.name}`}
              >
                <div
                  className="w-3 h-3 rounded flex-shrink-0"
                  style={{ backgroundColor: item.color, opacity: isHidden ? 0.4 : 1 }}
                />
                <span
                  className={`text-xs font-medium ${
                    isHidden ? 'line-through text-gray-400' : 'text-gray-700 dark:text-theme-secondary'
                  }`}
                >
                  {item.name}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 dark:text-theme-muted italic mt-0.5">
          💡 Click on any item above to show/hide it from the graph
        </p>
      </div>
    );
  };

  // Handle click on any data point to show detailed modal
  const handleDataPointClick = (data: any) => {
    if (data && data.activePayload && data.activePayload.length) {
      const periodData = data.activePayload[0].payload;
      setSelectedPeriod(periodData);
      setShowDetailModal(true);
    }
  };

  if (loading) {
    return <GraphSkeleton height="20rem" showControls={true} />;
  }

  if (error) {
    return (
      <div className="themed-card p-6">
        <div className="alert-error px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="themed-card p-3 sm:p-6">
      {/* Header — stacks vertically on mobile */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-bold text-blue-700 dark:text-blue-400">Financial Trends</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <label htmlFor="showProfit" className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-theme-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              id="showProfit"
              checked={showProfit}
              onChange={() => setShowProfit(!showProfit)}
              className="form-checkbox h-4 w-4 text-blue-600"
            />
            Show Profit
          </label>
          <div className="flex gap-1.5">
            <button
              onClick={() => setGraphType('line')}
              className={`px-3 py-1 text-sm rounded-md ${
                graphType === 'line' ? 'bg-blue-600 text-white' : 'btn-neutral'
              }`}
            >
              Line
            </button>
            <button
              onClick={() => setGraphType('bar')}
              className={`px-3 py-1 text-sm rounded-md ${
                graphType === 'bar' ? 'bg-blue-600 text-white' : 'btn-neutral'
              }`}
            >
              Bar
            </button>
          </div>
        </div>
      </div>

      <div className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          {graphType === 'line' ? (
            <LineChart
              data={data}
              margin={{ top: 5, right: 8, left: 0, bottom: 5 }}
              onClick={handleDataPointClick}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="period"
                tickFormatter={formatXAxis}
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fontSize: 11 }}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
              {!hiddenSeries.cashInflow && (
                <Line type="monotone" dataKey="cashInflow" name="Cash Inflow" stroke="#3b82f6" activeDot={{ r: 6 }} strokeWidth={2} />
              )}
              {!hiddenSeries.cashOutflow && (
                <Line type="monotone" dataKey="cashOutflow" name="Cash Outflow" stroke="#ef4444" activeDot={{ r: 6 }} strokeWidth={2} />
              )}
              {showProfit && !hiddenSeries.profit && (
                <Line type="monotone" dataKey="profit" name="Profit" stroke="#10b981" activeDot={{ r: 6 }} strokeWidth={2} />
              )}
              {!hiddenSeries.outsideAmount && (
                <Line type="monotone" dataKey="outsideAmount" name="Outside Amount" stroke="#f97316" activeDot={{ r: 6 }} strokeWidth={2} />
              )}
            </LineChart>
          ) : (
            <BarChart
              data={data}
              margin={{ top: 5, right: 8, left: 0, bottom: 5 }}
              onClick={handleDataPointClick}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="period"
                tickFormatter={formatXAxis}
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fontSize: 11 }}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
              {!hiddenSeries.cashInflow && (
                <Bar dataKey="cashInflow" name="Cash Inflow" fill="#3b82f6" />
              )}
              {!hiddenSeries.cashOutflow && (
                <Bar dataKey="cashOutflow" name="Cash Outflow" fill="#ef4444" />
              )}
              {showProfit && !hiddenSeries.profit && (
                <Bar dataKey="profit" name="Profit" fill="#10b981" />
              )}
              {!hiddenSeries.outsideAmount && (
                <Bar dataKey="outsideAmount" name="Outside Amount" fill="#f97316" />
              )}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Use the new Financial Detail Modal Component */}
      <FinancialDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        periodData={selectedPeriod}
      />
    </div>
  );
};

export default FinancialGraph;
