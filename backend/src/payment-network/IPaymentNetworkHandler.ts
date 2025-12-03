import {
  PaymentAuthorizationRequest,
  PaymentAuthorizationResponse,
  PaymentCaptureRequest,
  PaymentCaptureResponse,
  PaymentVoidRequest,
  PaymentVoidResponse,
  PaymentRefundRequest,
  PaymentRefundResponse,
} from './types';

/**
 * Payment Network Handler Interface
 *
 * This interface defines the contract that BSIM uses to handle
 * payment requests from any payment network. Implement this interface
 * to add support for new payment networks.
 *
 * The handler is responsible for:
 * - Validating card tokens (from OAuth consent)
 * - Checking credit availability
 * - Creating authorization holds
 * - Processing captures, voids, and refunds
 */
export interface IPaymentNetworkHandler {
  /**
   * Network identifier (e.g., 'simnet', 'visa', 'mastercard')
   */
  readonly networkId: string;

  /**
   * Authorize a payment request
   * Creates a hold on the card's available credit
   */
  authorize(request: PaymentAuthorizationRequest): Promise<PaymentAuthorizationResponse>;

  /**
   * Capture an authorized payment
   * Converts the hold to an actual charge
   */
  capture(request: PaymentCaptureRequest): Promise<PaymentCaptureResponse>;

  /**
   * Void an authorization
   * Releases the hold without charging
   */
  void(request: PaymentVoidRequest): Promise<PaymentVoidResponse>;

  /**
   * Refund a captured payment
   * Credits the amount back to the card
   */
  refund(request: PaymentRefundRequest): Promise<PaymentRefundResponse>;

  /**
   * Validate a card token
   * Returns true if the token is valid and belongs to an active card
   */
  validateCardToken(cardToken: string): Promise<boolean>;
}
