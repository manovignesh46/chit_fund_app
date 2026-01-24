/**
 * API Client for making requests to the microfinance backend
 * This abstraction makes it easy to migrate from old consolidated routes to new RESTful routes
 */

const API_BASE = '/api';

interface PaginationParams {
  page?: number;
  pageSize?: number;
}

interface LoanListParams extends PaginationParams {
  status?: string;
}

interface ChitFundListParams extends PaginationParams {
  status?: string;
}

class ApiClient {
  private async request<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // ==================== LOANS ====================
  
  async listLoans(params?: LoanListParams) {
    const query = new URLSearchParams(params as any);
    return this.request(`${API_BASE}/loans?${query}`);
  }

  async getLoan(id: number) {
    return this.request(`${API_BASE}/loans/${id}`);
  }

  async createLoan(data: any) {
    return this.request(`${API_BASE}/loans`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLoan(id: number, data: any) {
    return this.request(`${API_BASE}/loans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLoan(id: number) {
    return this.request(`${API_BASE}/loans/${id}`, {
      method: 'DELETE',
    });
  }

  // Repayments
  async listRepayments(loanId: number, params?: PaginationParams) {
    const query = new URLSearchParams(params as any);
    return this.request(`${API_BASE}/loans/${loanId}/repayments?${query}`);
  }

  async addRepayment(loanId: number, data: any) {
    return this.request(`${API_BASE}/loans/${loanId}/repayments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteRepayment(loanId: number, repaymentId: number) {
    return this.request(`${API_BASE}/loans/${loanId}/repayments/${repaymentId}`, {
      method: 'DELETE',
    });
  }

  // Payment Schedules
  async getPaymentSchedules(loanId: number, includeAll?: boolean) {
    const query = includeAll ? '?includeAll=true' : '';
    return this.request(`${API_BASE}/loans/${loanId}/payment-schedules${query}`);
  }

  async exportLoan(loanId: number) {
    const response = await fetch(`${API_BASE}/loans/${loanId}/export`);
    return response.blob();
  }

  // ==================== CHIT FUNDS ====================
  
  async listChitFunds(params?: ChitFundListParams) {
    const query = new URLSearchParams(params as any);
    return this.request(`${API_BASE}/chit-funds?${query}`);
  }

  async getChitFund(id: number) {
    return this.request(`${API_BASE}/chit-funds/${id}`);
  }

  async createChitFund(data: any) {
    return this.request(`${API_BASE}/chit-funds`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateChitFund(id: number, data: any) {
    return this.request(`${API_BASE}/chit-funds/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteChitFund(id: number) {
    return this.request(`${API_BASE}/chit-funds/${id}`, {
      method: 'DELETE',
    });
  }

  // Members
  async listMembers(chitFundId: number, params?: PaginationParams) {
    const query = new URLSearchParams(params as any);
    return this.request(`${API_BASE}/chit-funds/${chitFundId}/members?${query}`);
  }

  async getMember(chitFundId: number, memberId: number) {
    return this.request(`${API_BASE}/chit-funds/${chitFundId}/members/${memberId}`);
  }

  async addMember(chitFundId: number, data: any) {
    return this.request(`${API_BASE}/chit-funds/${chitFundId}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMember(chitFundId: number, memberId: number, data: any) {
    return this.request(`${API_BASE}/chit-funds/${chitFundId}/members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async removeMember(chitFundId: number, memberId: number) {
    return this.request(`${API_BASE}/chit-funds/${chitFundId}/members/${memberId}`, {
      method: 'DELETE',
    });
  }

  // Contributions
  async listContributions(chitFundId: number, params?: PaginationParams) {
    const query = new URLSearchParams(params as any);
    return this.request(`${API_BASE}/chit-funds/${chitFundId}/contributions?${query}`);
  }

  async addContribution(chitFundId: number, data: any) {
    return this.request(`${API_BASE}/chit-funds/${chitFundId}/contributions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateContribution(chitFundId: number, contributionId: number, data: any) {
    return this.request(`${API_BASE}/chit-funds/${chitFundId}/contributions/${contributionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteContribution(chitFundId: number, contributionId: number) {
    return this.request(`${API_BASE}/chit-funds/${chitFundId}/contributions/${contributionId}`, {
      method: 'DELETE',
    });
  }

  // Auctions
  async listAuctions(chitFundId: number, params?: PaginationParams) {
    const query = new URLSearchParams(params as any);
    return this.request(`${API_BASE}/chit-funds/${chitFundId}/auctions?${query}`);
  }

  async addAuction(chitFundId: number, data: any) {
    return this.request(`${API_BASE}/chit-funds/${chitFundId}/auctions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAuction(chitFundId: number, auctionId: number, data: any) {
    return this.request(`${API_BASE}/chit-funds/${chitFundId}/auctions/${auctionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAuction(chitFundId: number, auctionId: number) {
    return this.request(`${API_BASE}/chit-funds/${chitFundId}/auctions/${auctionId}`, {
      method: 'DELETE',
    });
  }

  async exportChitFund(chitFundId: number) {
    const response = await fetch(`${API_BASE}/chit-funds/${chitFundId}/export`);
    return response.blob();
  }

  // ==================== FEE STRUCTURES ====================
  
  async listFeeStructures() {
    return this.request(`${API_BASE}/fee-structures`);
  }

  async getFeeStructure(id: number) {
    return this.request(`${API_BASE}/fee-structures/${id}`);
  }

  async createFeeStructure(data: any) {
    return this.request(`${API_BASE}/fee-structures`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFeeStructure(id: number, data: any) {
    return this.request(`${API_BASE}/fee-structures/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteFeeStructure(id: number) {
    return this.request(`${API_BASE}/fee-structures/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== TRANSACTIONS ====================
  
  async listTransactions(params?: any) {
    const query = new URLSearchParams(params);
    return this.request(`${API_BASE}/transactions?${query}`);
  }

  async createTransaction(data: any) {
    return this.request(`${API_BASE}/transactions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTransactionSummary(params?: any) {
    const query = new URLSearchParams(params);
    return this.request(`${API_BASE}/transactions/summary?${query}`);
  }

  async exportTransactions(params?: any) {
    const query = new URLSearchParams(params);
    const response = await fetch(`${API_BASE}/transactions/export?${query}`);
    return response.blob();
  }

  async emailTransactions(data: any) {
    return this.request(`${API_BASE}/transactions/export`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==================== PARTNERS ====================
  
  async listPartners() {
    return this.request(`${API_BASE}/partners`);
  }

  async getPartner(id: number) {
    return this.request(`${API_BASE}/partners/${id}`);
  }

  async createPartner(data: any) {
    return this.request(`${API_BASE}/partners`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePartner(id: number, data: any) {
    return this.request(`${API_BASE}/partners/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePartner(id: number) {
    return this.request(`${API_BASE}/partners/${id}`, {
      method: 'DELETE',
    });
  }

  async getPartnerBalance(id: number) {
    return this.request(`${API_BASE}/partners/${id}/balance`);
  }
}

export const api = new ApiClient();
export default api;
