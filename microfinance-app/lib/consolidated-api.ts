// Consolidated API utility functions for client components

// Base URL for API requests
const API_BASE_URL = '/api';

// Generic fetch function with error handling
async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
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

    // Add timeout to fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId); // Clear the timeout if fetch completes

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
      return data;
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timed out. The server took too long to respond.');
      }
      throw fetchError;
    }
  } catch (error: any) {
    console.error(`Error fetching ${url}:`, error);
    throw error;
  }
}

// User API functions (consolidated)
export const userAPI = {
  login: (email: string, password: string) => fetchAPI<any>('/user?action=login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),

  logout: () => fetchAPI<any>('/user?action=logout', {
    method: 'POST',
  }),

  getCurrentUser: () => fetchAPI<any>('/user?action=me', {
    method: 'GET',
  }),

  register: (data: any) => fetchAPI<any>('/user?action=register', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// Chit Fund API functions (consolidated)
export const chitFundAPI = {
  getAll: (page = 1, pageSize = 10, status?: string) => {
    let url = `/chit-funds?page=${page}&pageSize=${pageSize}`;
    if (status) url += `&status=${status}`;
    return fetchAPI<any>(url);
  },

  getById: (id: number) => fetchAPI<any>(`/chit-funds?id=${id}`),

  create: (data: any) => fetchAPI<any>('/chit-funds', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id: number, data: any) => fetchAPI<any>('/chit-funds', {
    method: 'PUT',
    body: JSON.stringify({ id, ...data }),
  }),

  delete: (id: number) => fetchAPI<any>('/chit-funds', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  }),

  getMembers: (id: number, page = 1, pageSize = 10) => 
    fetchAPI<any>(`/chit-funds/${id}/members?page=${page}&pageSize=${pageSize}`),

  addMember: (id: number, data: any) => fetchAPI<any>(`/chit-funds/${id}/members`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  conductAuction: (id: number, data: any) => fetchAPI<any>(`/chit-funds/${id}/auction`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// Loan API functions (consolidated)
export const loanAPI = {
  getAll: (page = 1, pageSize = 10, status?: string) => {
    let url = `/loans?page=${page}&pageSize=${pageSize}`;
    if (status) url += `&status=${status}`;
    return fetchAPI<any>(url);
  },

  getById: (id: number) => fetchAPI<any>(`/loans?id=${id}`),

  create: (data: any) => fetchAPI<any>('/loans', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id: number, data: any) => fetchAPI<any>('/loans', {
    method: 'PUT',
    body: JSON.stringify({ id, ...data }),
  }),

  delete: (id: number) => fetchAPI<any>('/loans', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  }),

  getRepayments: (id: number, page = 1, pageSize = 10) =>
    fetchAPI<any>(`/loans?id=${id}&action=repayments&page=${page}&pageSize=${pageSize}`),

  addRepayment: (id: number, data: any) => fetchAPI<any>(`/loans?id=${id}&action=repayment`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getPaymentSchedules: (id: number, page = 1, pageSize = 10, status?: string, includeAll = false) => {
    let url = `/loans?id=${id}&action=payment-schedules&page=${page}&pageSize=${pageSize}&includeAll=${includeAll}`;
    if (status) url += `&status=${status}`;
    return fetchAPI<any>(url);
  },

  recordPayment: (id: number, data: any) => fetchAPI<any>(`/loans?id=${id}&action=payment-schedules`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateOverdueAmount: (id: number) => fetchAPI<any>(`/loans?id=${id}&action=update-overdue`, {
    method: 'POST',
    body: JSON.stringify({ action: 'updateOverdue' }),
  }),
};

// Member API functions (consolidated)
export const memberAPI = {
  getAll: (page = 1, pageSize = 10, search?: string) => {
    let url = `/members?page=${page}&pageSize=${pageSize}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return fetchAPI<any>(url);
  },

  getById: (id: number) => fetchAPI<any>(`/members?id=${id}`),

  create: (data: any) => fetchAPI<any>('/members', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id: number, data: any) => fetchAPI<any>('/members', {
    method: 'PUT',
    body: JSON.stringify({ id, ...data }),
  }),

  delete: (id: number) => fetchAPI<any>('/members', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  }),
};

// Dashboard API functions (consolidated)
export const dashboardAPI = {
  getSummary: () => fetchAPI<any>('/dashboard'),

  getActivities: () => fetchAPI<any[]>('/dashboard?action=activities'),

  getUpcomingEvents: () => fetchAPI<any[]>('/dashboard?action=events'),

  getFinancialData: (duration: string = 'monthly', limit: number = 12) =>
    fetchAPI<any[]>(`/dashboard?action=financial-data&duration=${duration}&limit=${limit}`),
};
