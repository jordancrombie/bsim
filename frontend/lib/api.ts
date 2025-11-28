import axios, { AxiosInstance } from 'axios';
import type {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  User,
  CreateAccountRequest,
  AccountResponse,
  AccountsResponse,
  TransactionsResponse,
  DepositRequest,
  WithdrawRequest,
  TransferRequest,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add token to requests if available
    this.client.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    });

    // Handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Clear token and redirect to login
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth API
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/register', data);
    return response.data;
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/login', data);
    return response.data;
  }

  async getCurrentUser(): Promise<{ user: User }> {
    const response = await this.client.get<{ user: User }>('/auth/me');
    return response.data;
  }

  // Accounts API
  async getAccounts(): Promise<AccountsResponse> {
    const response = await this.client.get<AccountsResponse>('/accounts');
    return response.data;
  }

  async createAccount(data: CreateAccountRequest): Promise<AccountResponse> {
    const response = await this.client.post<AccountResponse>('/accounts', data);
    return response.data;
  }

  async getAccount(accountNumber: string): Promise<AccountResponse> {
    const response = await this.client.get<AccountResponse>(`/accounts/${accountNumber}`);
    return response.data;
  }

  async getTransactions(accountNumber: string): Promise<TransactionsResponse> {
    const response = await this.client.get<TransactionsResponse>(
      `/accounts/${accountNumber}/transactions`
    );
    return response.data;
  }

  // Transactions API
  async deposit(data: DepositRequest): Promise<AccountResponse> {
    const response = await this.client.post<AccountResponse>('/transactions/deposit', data);
    return response.data;
  }

  async withdraw(data: WithdrawRequest): Promise<AccountResponse> {
    const response = await this.client.post<AccountResponse>('/transactions/withdraw', data);
    return response.data;
  }

  async transfer(data: TransferRequest): Promise<{ message: string }> {
    const response = await this.client.post<{ message: string }>('/transactions/transfer', data);
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await this.client.get<{ status: string; timestamp: string }>('/health');
    return response.data;
  }
}

export const api = new ApiClient();
