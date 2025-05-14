// Client-side data fetching hooks with SWR
import useSWR from 'swr';
import { dashboardAPI, loanAPI, chitFundAPI, memberAPI } from './api';

// Generic fetcher function for SWR
const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    const error = new Error('An error occurred while fetching the data.');
    throw error;
  }

  return response.json();
};

// Dashboard data hook
export function useDashboardData() {
  const { data, error, isLoading, mutate } = useSWR('/api/dashboard/consolidated?action=summary', fetcher, {
    revalidateOnFocus: false, // Don't revalidate when window gets focus
    revalidateIfStale: true,  // Revalidate if data is stale
    dedupingInterval: 60000,  // Dedupe requests within 1 minute
  });

  return {
    dashboardData: data,
    isLoading,
    isError: error,
    mutate,
  };
}

// Financial data hook with period selection
export function useFinancialData(duration = 'monthly', limit = 12) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/dashboard/consolidated?action=financial-data&duration=${duration}&limit=${limit}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  return {
    financialData: data,
    isLoading,
    isError: error,
    mutate,
  };
}

// Loans list hook with pagination
export function useLoans(page = 1, pageSize = 10, status?: string) {
  const statusParam = status ? `&status=${status}` : '';
  const { data, error, isLoading, mutate } = useSWR(
    `/api/loans/consolidated?action=list&page=${page}&pageSize=${pageSize}${statusParam}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  return {
    loans: data?.loans || [],
    totalCount: data?.totalCount || 0,
    totalPages: data?.totalPages || 0,
    isLoading,
    isError: error,
    mutate,
  };
}

// Single loan hook
export function useLoan(id: number | string) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/api/loans/consolidated?action=detail&id=${id}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  return {
    loan: data,
    isLoading,
    isError: error,
    mutate,
  };
}

// Chit funds list hook with pagination
export function useChitFunds(page = 1, pageSize = 10, status?: string) {
  const statusParam = status ? `&status=${status}` : '';
  const { data, error, isLoading, mutate } = useSWR(
    `/api/chit-funds/consolidated?action=list&page=${page}&pageSize=${pageSize}${statusParam}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  return {
    chitFunds: data?.chitFunds || [],
    totalCount: data?.totalCount || 0,
    totalPages: data?.totalPages || 0,
    isLoading,
    isError: error,
    mutate,
  };
}

// Members list hook with pagination
export function useMembers(page = 1, pageSize = 10) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/members/consolidated?action=list&page=${page}&pageSize=${pageSize}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  return {
    members: data?.members || [],
    totalCount: data?.totalCount || 0,
    totalPages: data?.totalPages || 0,
    isLoading,
    isError: error,
    mutate,
  };
}
