/**
 * Payment Network Types for BSIM
 *
 * These types define the contract between payment networks (like NSIM)
 * and the BSIM payment handler plugin system.
 */

export type PaymentAuthorizationStatus = 'approved' | 'declined' | 'error';

/**
 * Agent context forwarded from NSIM for AI agent transactions (SACP)
 * Present when a transaction is initiated by an AI agent on behalf of a user.
 */
export interface AgentContext {
  agentId: string;      // Agent identifier (e.g., "agent_abc123")
  ownerId: string;      // WSIM user ID who owns the agent (UUID)
  humanPresent: boolean; // Whether human was present during transaction
  mandateType?: 'intent' | 'cart' | 'payment'; // Type of authorization mandate
}

export interface PaymentAuthorizationRequest {
  cardToken: string;
  amount: number;
  currency: string;
  merchantId: string;
  merchantName: string;
  orderId: string;
  description?: string;
  // SACP: Agent context forwarded from NSIM
  agentContext?: AgentContext;
}

export interface PaymentAuthorizationResponse {
  status: PaymentAuthorizationStatus;
  authorizationCode?: string;
  declineReason?: string;
  availableCredit?: number;
}

export interface PaymentCaptureRequest {
  authorizationCode: string;
  amount: number;
}

export interface PaymentCaptureResponse {
  success: boolean;
  error?: string;
}

export interface PaymentVoidRequest {
  authorizationCode: string;
}

export interface PaymentVoidResponse {
  success: boolean;
  error?: string;
}

export interface PaymentRefundRequest {
  authorizationCode: string;
  amount: number;
}

export interface PaymentRefundResponse {
  success: boolean;
  error?: string;
}

/**
 * Authorization record stored in BSIM for tracking pending authorizations
 */
export interface PaymentAuthorization {
  authorizationCode: string;
  cardId: string;
  cardNumber: string;
  amount: number;
  currency: string;
  merchantId: string;
  merchantName: string;
  orderId: string;
  status: 'pending' | 'captured' | 'voided' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  capturedAmount: number;
  // SACP: Agent context for AI agent transactions
  agentContext?: AgentContext;
}
