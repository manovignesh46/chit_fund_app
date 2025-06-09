// API utility functions for transactions

export const transactionAPI = {
  create: async (data: any) => {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-active-partner': data.entered_by || 'Me'
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create transaction');
    }
    return res.json();
  },

  getAll: async (page = 1, pageSize = 10, type?: string, partner?: string) => {
    let url = `/api/transactions?page=${page}&pageSize=${pageSize}`;
    if (type) url += `&type=${type}`;
    if (partner) url += `&partner=${partner}`;
    const res = await fetch(url);
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to fetch transactions');
    }
    return res.json();
  }
};
