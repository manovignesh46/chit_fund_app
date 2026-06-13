import { useEffect, useState } from 'react';
import { formatCurrency } from '../../lib/formatUtils';

interface AggregationData {
  expectedLoanRepayment: number;
  actualLoanRepayment: number;
  expectedChitContribution: number;
  actualChitContribution: number;
  totalExpectedAmount: number;
  totalActualAmount: number;
}

interface Props {
  startDate?: string;
  endDate?: string;
  refreshTrigger?: boolean;
}

export default function MonthlyAggregationsCard({ startDate, endDate, refreshTrigger }: Props) {
  const [data, setData] = useState<AggregationData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAggregations = async () => {
      if (!startDate || !endDate) {
        setData(null);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(
          `/api/transactions/aggregations?startDate=${startDate}&endDate=${endDate}`
        );
        const aggregations = await response.json();
        setData(aggregations);
      } catch (error) {
        console.error('Error fetching aggregations:', error);
      }
      setLoading(false);
    };

    fetchAggregations();
  }, [startDate, endDate, refreshTrigger]);

  if (!startDate || !endDate) return null;
  if (loading) return <div>Loading aggregations...</div>;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="themed-card p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Loan Repayments</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Expected</span>
            <span className="text-sm font-semibold text-blue-600">
              {formatCurrency(data.expectedLoanRepayment)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Actual</span>
            <span className="text-sm font-semibold text-green-600">
              {formatCurrency(data.actualLoanRepayment)}
            </span>
          </div>
        </div>
      </div>

      <div className="themed-card p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Chit Fund Contributions</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Expected</span>
            <span className="text-sm font-semibold text-blue-600">
              {formatCurrency(data.expectedChitContribution)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Actual</span>
            <span className="text-sm font-semibold text-green-600">
              {formatCurrency(data.actualChitContribution)}
            </span>
          </div>
        </div>
      </div>

      <div className="themed-card p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Total Collections</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Expected</span>
            <span className="text-sm font-semibold text-blue-600">
              {formatCurrency(data.totalExpectedAmount)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Actual</span>
            <span className="text-sm font-semibold text-green-600">
              {formatCurrency(data.totalActualAmount)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
