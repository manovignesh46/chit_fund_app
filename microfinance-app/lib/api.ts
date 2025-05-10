// API utility functions for client components

// Base URL for API requests
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Generic fetch function with error handling
async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'An error occurred while fetching data');
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    throw error;
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
