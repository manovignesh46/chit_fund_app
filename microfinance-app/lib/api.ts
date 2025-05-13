// API utility functions for client components

// Base URL for API requests
// Use relative URL to avoid CORS issues
const API_BASE_URL = '/api';

// Generic fetch function with error handling
async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    console.log(`Fetching from: ${url} with method: ${options.method || 'GET'}`);

    // Create fetch options with defaults that work well in Next.js
    const fetchOptions: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
      // Ensure credentials are included
      credentials: 'same-origin',
      // Disable cache for API requests
      cache: 'no-store',
    };

    console.log('Fetch options:', JSON.stringify(fetchOptions, null, 2));

    // Add timeout to fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId); // Clear the timeout if fetch completes

      console.log(`Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        let errorMessage = 'An error occurred while fetching data';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If response.json() fails, use status text
          errorMessage = `${response.status}: ${response.statusText || errorMessage}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Response data received successfully');
      return data;
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timed out. The server took too long to respond.');
      }
      throw fetchError;
    }
  } catch (error: any) {
    console.error(`Error fetching ${url}:`, error);

    // Add more detailed error information
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.error('Network error: This could be due to CORS, network connectivity, or server unavailability');
      throw new Error('Network error: Unable to connect to the server. Please check your internet connection and try again.');
    }

    throw error;
  } finally {
    console.log(`Fetch operation completed for ${url}`);
  }
}

// Chit Fund API functions (consolidated)
export const chitFundAPI = {
  getAll: (page = 1, pageSize = 10, status?: string) => {
    let url = `/chit-funds/consolidated?action=list&page=${page}&pageSize=${pageSize}`;
    if (status) url += `&status=${status}`;
    return fetchAPI<any>(url);
  },

  getById: (id: number) => fetchAPI<any>(`/chit-funds/consolidated?action=detail&id=${id}`),

  create: (data: any) => fetchAPI<any>('/chit-funds/consolidated?action=create', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id: number, data: any) => fetchAPI<any>(`/chit-funds/consolidated?action=update&id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  delete: (id: number) => fetchAPI<any>(`/chit-funds/consolidated?action=delete&id=${id}`, {
    method: 'DELETE',
    body: JSON.stringify({}),
  }),

  getMembers: (id: number, page = 1, pageSize = 10) =>
    fetchAPI<any>(`/chit-funds/consolidated?action=members&id=${id}&page=${page}&pageSize=${pageSize}`),

  getMemberDetail: (id: number, memberId: number) =>
    fetchAPI<any>(`/chit-funds/consolidated?action=member-detail&id=${id}&memberId=${memberId}`),

  addMember: (id: number, data: any) => fetchAPI<any>(`/chit-funds/consolidated?action=add-member&id=${id}`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateMember: (id: number, memberId: number, data: any) =>
    fetchAPI<any>(`/chit-funds/consolidated?action=update-member&id=${id}&memberId=${memberId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteMember: (id: number, memberId: number) =>
    fetchAPI<any>(`/chit-funds/consolidated?action=delete-member&id=${id}&memberId=${memberId}`, {
      method: 'DELETE',
      body: JSON.stringify({}),
    }),

  getContributions: (id: number, memberId?: number, page = 1, pageSize = 10) => {
    let url = `/chit-funds/consolidated?action=contributions&id=${id}&page=${page}&pageSize=${pageSize}`;
    if (memberId) url += `&memberId=${memberId}`;
    return fetchAPI<any>(url);
  },

  addContribution: (id: number, data: any) =>
    fetchAPI<any>(`/chit-funds/consolidated?action=add-contribution&id=${id}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateContribution: (id: number, contributionId: number, data: any) =>
    fetchAPI<any>(`/chit-funds/consolidated?action=update-contribution&id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ contributionId, ...data }),
    }),

  deleteContribution: (id: number, contributionId: number) =>
    fetchAPI<any>(`/chit-funds/consolidated?action=delete-contribution&id=${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ contributionId }),
    }),

  getAuctions: (id: number, page = 1, pageSize = 10) =>
    fetchAPI<any>(`/chit-funds/consolidated?action=auctions&id=${id}&page=${page}&pageSize=${pageSize}`),

  addAuction: (id: number, data: any) =>
    fetchAPI<any>(`/chit-funds/consolidated?action=add-auction&id=${id}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAuction: (id: number, auctionId: number, data: any) =>
    fetchAPI<any>(`/chit-funds/consolidated?action=update-auction&id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ auctionId, ...data }),
    }),

  deleteAuction: (id: number, auctionId: number) =>
    fetchAPI<any>(`/chit-funds/consolidated?action=delete-auction&id=${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ auctionId }),
    }),

  exportChitFund: (id: number) => {
    // This is a special case that needs to trigger a file download
    window.location.href = `/api/chit-funds/consolidated?action=export&id=${id}`;
    return Promise.resolve(); // Return a resolved promise for consistency
  },
};

// Loan API functions (consolidated)
export const loanAPI = {
  getAll: (page = 1, pageSize = 10, status?: string) => {
    let url = `/loans/consolidated?action=list&page=${page}&pageSize=${pageSize}`;
    if (status) url += `&status=${status}`;
    return fetchAPI<any>(url);
  },

  getById: (id: number) => fetchAPI<any>(`/loans/consolidated?action=detail&id=${id}`),

  create: (data: any) => fetchAPI<any>('/loans/consolidated?action=create', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id: number, data: any) => fetchAPI<any>(`/loans/consolidated?action=update&id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  delete: (id: number) => fetchAPI<any>(`/loans/consolidated?action=delete&id=${id}`, {
    method: 'DELETE',
    body: JSON.stringify({}),
  }),

  getRepayments: (id: number, page = 1, pageSize = 10) =>
    fetchAPI<any>(`/loans/consolidated?action=repayments&id=${id}&page=${page}&pageSize=${pageSize}`),

  addRepayment: (id: number, data: any) => fetchAPI<any>(`/loans/consolidated?action=add-repayment&id=${id}`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  deleteRepayment: (id: number, repaymentId: number) => fetchAPI<any>(`/loans/consolidated?action=delete-repayment&id=${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ repaymentId }),
  }),

  deleteRepayments: (id: number, repaymentIds: number[]) => fetchAPI<any>(`/loans/consolidated?action=delete-repayment&id=${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ repaymentIds }),
  }),

  getPaymentSchedules: (id: number) => fetchAPI<any>(`/loans/consolidated?action=payment-schedules&id=${id}`),

  updateOverdueAmount: (id: number) => fetchAPI<any>(`/loans/consolidated?action=update-overdue&id=${id}`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),

  updateAllOverdueAmounts: () => fetchAPI<any>('/loans/consolidated?action=update-overdue', {
    method: 'POST',
    body: JSON.stringify({}),
  }),

  exportLoan: (id: number) => {
    // This is a special case that needs to trigger a file download
    window.location.href = `/api/loans/consolidated?action=export&id=${id}`;
    return Promise.resolve(); // Return a resolved promise for consistency
  },

  exportAllLoans: () => {
    // This is a special case that needs to trigger a file download
    window.location.href = `/api/loans/consolidated?action=export-all`;
    return Promise.resolve(); // Return a resolved promise for consistency
  },
};

// User API functions (consolidated)
export const authAPI = {
  login: (email: string, password: string) => fetchAPI<any>('/user?action=login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),

  logout: () => fetchAPI<any>('/user?action=logout', {
    method: 'POST',
  }),

  getCurrentUser: () => fetchAPI<any>('/user?action=me'),

  register: (data: any) => fetchAPI<any>('/user?action=register', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// Dashboard API functions (consolidated)
export const dashboardAPI = {
  getSummary: () => fetchAPI<any>('/dashboard/consolidated?action=summary'),

  getActivities: () => fetchAPI<any[]>('/dashboard/consolidated?action=activities'),

  getUpcomingEvents: () => fetchAPI<any[]>('/dashboard/consolidated?action=events'),

  getFinancialData: (duration: string = 'monthly', limit: number = 12) =>
    fetchAPI<any[]>(`/dashboard/consolidated?action=financial-data&duration=${duration}&limit=${limit}`),

  exportFinancialData: (duration: string = 'monthly', limit: number = 12) => {
    // This is a special case that needs to trigger a file download
    window.location.href = `/api/dashboard/consolidated?action=export&duration=${duration}&limit=${limit}`;
    return Promise.resolve(); // Return a resolved promise for consistency
  },

  exportSinglePeriodData: (period: string, startDate: string, endDate: string) => {
    // This is a special case that needs to trigger a file download
    window.location.href = `/api/dashboard/consolidated?action=export&duration=single&period=${encodeURIComponent(period)}&startDate=${startDate}&endDate=${endDate}`;
    return Promise.resolve(); // Return a resolved promise for consistency
  },
};

// Global Members API functions (consolidated)
export const memberAPI = {
  getAll: (page = 1, pageSize = 10) => fetchAPI<any>(`/members/consolidated?action=list&page=${page}&pageSize=${pageSize}`),

  getById: (id: number) => fetchAPI<any>(`/members/consolidated?action=detail&id=${id}`),

  create: (data: any) => fetchAPI<any>('/members/consolidated?action=create', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id: number, data: any) => fetchAPI<any>(`/members/consolidated?action=update&id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  delete: (id: number) => fetchAPI<any>(`/members/consolidated?action=delete&id=${id}`, {
    method: 'DELETE',
    body: JSON.stringify({}),
  }),
};
