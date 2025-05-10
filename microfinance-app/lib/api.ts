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

// Chit Fund API functions
export const chitFundAPI = {
  getAll: () => fetchAPI<any[]>('/chit-funds'),

  getById: (id: number) => fetchAPI<any>(`/chit-funds/${id}`),

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

  getMembers: (id: number) => fetchAPI<any[]>(`/chit-funds/${id}/members`),

  addMember: (id: number, data: any) => fetchAPI<any>(`/chit-funds/${id}/members`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  conductAuction: (id: number, data: any) => fetchAPI<any>(`/chit-funds/${id}/auction`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// Loan API functions
export const loanAPI = {
  getAll: () => fetchAPI<any[]>('/loans'),

  getById: (id: number) => fetchAPI<any>(`/loans/${id}`),

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

  getRepayments: (id: number) => fetchAPI<any[]>(`/loans/${id}/repayments`),

  addRepayment: (id: number, data: any) => fetchAPI<any>(`/loans/${id}/repayments`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// User API functions
export const userAPI = {
  login: (email: string, password: string) => fetchAPI<any>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),

  register: (data: any) => fetchAPI<any>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getProfile: () => fetchAPI<any>('/users/profile'),

  updateProfile: (data: any) => fetchAPI<any>('/users/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

// Dashboard API functions
export const dashboardAPI = {
  getSummary: () => fetchAPI<any>('/dashboard'),

  getActivities: () => fetchAPI<any[]>('/dashboard/activities'),

  getUpcomingEvents: () => fetchAPI<any[]>('/dashboard/events'),
};

// Global Members API functions
export const memberAPI = {
  getAll: () => fetchAPI<any[]>('/members'),

  getById: (id: number) => fetchAPI<any>(`/members/${id}`),

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
