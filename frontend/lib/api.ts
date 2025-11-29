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
  CreditCard,
  CreditCardResponse,
  CreditCardsResponse,
  CreditCardTransactionsResponse,
  CreateCreditCardRequest,
  ChargeRequest,
  PaymentRequest,
  RefundRequest,
} from '@/types';

// Use relative URL so it works with any subdomain
// When accessing from https://banksim.ca, calls https://banksim.ca/api
// When accessing from https://testing.banksim.ca, calls https://testing.banksim.ca/api
const getApiUrl = (): string => {
  // In browser, use relative URL to current domain
  if (typeof window !== 'undefined') {
    return '/api';
  }

  // During SSR, use environment variable or fallback
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
};

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: getApiUrl(),
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

  // Passkey API
  async generatePasskeyRegistrationOptions(): Promise<any> {
    const response = await this.client.post('/auth/passkey/register-options');
    return response.data;
  }

  async verifyPasskeyRegistration(credential: any): Promise<any> {
    const response = await this.client.post('/auth/passkey/register-verify', credential);
    return response.data;
  }

  async generatePasskeyAuthenticationOptions(email?: string): Promise<any> {
    const response = await this.client.post('/auth/passkey/login-options', { email });
    return response.data;
  }

  async verifyPasskeyAuthentication(email: string | undefined, credential: any): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/passkey/login-verify', {
      email,
      response: credential,
    });
    return response.data;
  }

  async getUserPasskeys(): Promise<{ passkeys: any[] }> {
    const response = await this.client.get('/auth/passkeys');
    return response.data;
  }

  async deletePasskey(passkeyId: string): Promise<{ message: string }> {
    const response = await this.client.delete(`/auth/passkeys/${passkeyId}`);
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

  // Credit Card endpoints
  async createCreditCard(data: CreateCreditCardRequest): Promise<CreditCard> {
    const response = await this.client.post<CreditCardResponse>('/credit-cards', data);
    return response.data.creditCard;
  }

  async getCreditCards(): Promise<CreditCard[]> {
    const response = await this.client.get<CreditCardsResponse>('/credit-cards');
    return response.data.creditCards;
  }

  async getCreditCard(cardNumber: string): Promise<CreditCard> {
    const response = await this.client.get<CreditCardResponse>(`/credit-cards/${cardNumber}`);
    return response.data.creditCard;
  }

  async getCreditCardTransactions(cardNumber: string): Promise<CreditCardTransactionsResponse> {
    const response = await this.client.get<CreditCardTransactionsResponse>(
      `/credit-cards/${cardNumber}/transactions`
    );
    return response.data;
  }

  // Credit Card Transaction endpoints
  async chargeCreditCard(data: ChargeRequest): Promise<CreditCard> {
    const response = await this.client.post<CreditCardResponse>('/credit-card-transactions/charge', data);
    return response.data.creditCard;
  }

  async payCreditCard(data: PaymentRequest): Promise<CreditCard> {
    const response = await this.client.post<CreditCardResponse>('/credit-card-transactions/payment', data);
    return response.data.creditCard;
  }

  async refundCreditCard(data: RefundRequest): Promise<CreditCard> {
    const response = await this.client.post<CreditCardResponse>('/credit-card-transactions/refund', data);
    return response.data.creditCard;
  }

  // Site Settings API (public, no auth required)
  async getSiteSettings(): Promise<{ logoUrl: string | null; siteName: string }> {
    const response = await this.client.get<{ logoUrl: string | null; siteName: string }>('/settings');
    return response.data;
  }
}

export const api = new ApiClient();
