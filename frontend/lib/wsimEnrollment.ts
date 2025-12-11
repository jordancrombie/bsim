/**
 * WSIM Enrollment Utilities
 *
 * Handles the embedded WSIM enrollment flow including:
 * - Opening the WSIM enrollment popup
 * - PostMessage communication with WSIM
 * - Enrollment status management
 */

import { api } from './api';

// Get WSIM Auth URL from environment or use default
const WSIM_AUTH_URL = process.env.NEXT_PUBLIC_WSIM_AUTH_URL || 'https://wsim-auth-dev.banksim.ca';

export interface EnrollmentData {
  claims: {
    sub: string;
    email: string;
    given_name?: string;
    family_name?: string;
  };
  cardToken: string;
  bsimId: string;
  signature: string;
  timestamp: number;
}

export interface EnrollmentResult {
  success: boolean;
  walletId?: string;
  sessionToken?: string;
  sessionTokenExpiresIn?: number;
  cardsEnrolled?: number;
  error?: string;
  code?: string;
}

export interface EnrollmentStatus {
  enrolled: boolean;
  walletId?: string;
  walletName?: string;
  enrolledAt?: string;
  expiresAt?: string;
  cardCount?: number;
  canEnroll?: boolean;
}

// Store for pending enrollment data
let pendingEnrollmentData: EnrollmentData | null = null;
let enrollmentPopup: Window | null = null;
let enrollmentResolve: ((result: EnrollmentResult) => void) | null = null;
let enrollmentReject: ((error: Error) => void) | null = null;

/**
 * Initialize the message listener for WSIM popup communication
 * Should be called once when the app loads
 */
export function initWsimMessageListener(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('message', handleWsimMessage);
}

/**
 * Clean up the message listener
 */
export function cleanupWsimMessageListener(): void {
  if (typeof window === 'undefined') return;

  window.removeEventListener('message', handleWsimMessage);
}

/**
 * Handle messages from WSIM popup
 */
function handleWsimMessage(event: MessageEvent): void {
  // Debug: log all incoming messages
  console.log('[WSIM] Received message:', {
    origin: event.origin,
    data: event.data,
    type: event.data?.type,
  });

  // Validate origin - must be from WSIM auth server
  if (!event.origin.includes('wsim-auth')) {
    // Also allow localhost for development
    if (!event.origin.includes('localhost:3005')) {
      console.log('[WSIM] Ignoring message from non-WSIM origin:', event.origin);
      return;
    }
  }

  const { type, ...data } = event.data || {};

  console.log('[WSIM] Processing message type:', type);

  switch (type) {
    case 'wsim:enroll-ready':
      // Popup is ready, send enrollment data
      console.log('[WSIM] Received enroll-ready, pendingEnrollmentData:', !!pendingEnrollmentData, 'enrollmentPopup:', !!enrollmentPopup);
      if (pendingEnrollmentData && enrollmentPopup) {
        console.log('[WSIM] Sending enroll-init to:', event.origin);
        enrollmentPopup.postMessage(
          {
            type: 'wsim:enroll-init',
            ...pendingEnrollmentData,
          },
          event.origin
        );
        console.log('[WSIM] enroll-init sent successfully');
        pendingEnrollmentData = null;
      } else {
        console.warn('[WSIM] Cannot send enroll-init - missing data or popup reference');
      }
      break;

    case 'wsim:enrolled':
      // Success! User is now enrolled
      console.log('[WSIM] Enrollment successful:', data.walletId);

      // Optionally store the session token for Quick Pay
      if (data.sessionToken) {
        try {
          localStorage.setItem('wsim_session_token', data.sessionToken);
          localStorage.setItem(
            'wsim_session_expires',
            String(Date.now() + (data.sessionTokenExpiresIn || 2592000) * 1000)
          );
        } catch (e) {
          console.warn('[WSIM] Could not store session token:', e);
        }
      }

      enrollmentPopup?.close();
      enrollmentPopup = null;

      if (enrollmentResolve) {
        enrollmentResolve({
          success: true,
          walletId: data.walletId,
          sessionToken: data.sessionToken,
          sessionTokenExpiresIn: data.sessionTokenExpiresIn,
          cardsEnrolled: data.cardsEnrolled,
        });
        enrollmentResolve = null;
        enrollmentReject = null;
      }
      break;

    case 'wsim:already-enrolled':
      // User was already enrolled
      console.log('[WSIM] User already enrolled:', data.walletId);
      enrollmentPopup?.close();
      enrollmentPopup = null;

      if (enrollmentResolve) {
        enrollmentResolve({
          success: true,
          walletId: data.walletId,
        });
        enrollmentResolve = null;
        enrollmentReject = null;
      }
      break;

    case 'wsim:enroll-cancelled':
      // User cancelled enrollment
      console.log('[WSIM] Enrollment cancelled');
      enrollmentPopup?.close();
      enrollmentPopup = null;

      if (enrollmentResolve) {
        enrollmentResolve({
          success: false,
          error: 'Enrollment cancelled',
          code: 'CANCELLED',
        });
        enrollmentResolve = null;
        enrollmentReject = null;
      }
      break;

    case 'wsim:enroll-error':
      // Enrollment failed
      console.error('[WSIM] Enrollment error:', data.error, data.code);
      enrollmentPopup?.close();
      enrollmentPopup = null;

      if (enrollmentResolve) {
        enrollmentResolve({
          success: false,
          error: data.error || 'Enrollment failed',
          code: data.code || 'UNKNOWN_ERROR',
        });
        enrollmentResolve = null;
        enrollmentReject = null;
      }
      break;
  }
}

/**
 * Open the WSIM enrollment popup
 * Returns a promise that resolves with the enrollment result
 */
export async function openWsimEnrollment(): Promise<EnrollmentResult> {
  // Get signed enrollment data from our backend
  const enrollmentData = await api.getWsimEnrollmentData();

  // Store for when popup is ready
  pendingEnrollmentData = enrollmentData;

  // Determine WSIM auth URL
  const wsimAuthUrl = enrollmentData.wsimAuthUrl || WSIM_AUTH_URL;
  const bankOrigin = window.location.origin;

  // Open WSIM enrollment popup
  const popupUrl = `${wsimAuthUrl}/enroll/embed?origin=${encodeURIComponent(bankOrigin)}`;

  enrollmentPopup = window.open(
    popupUrl,
    'wsim-enrollment',
    'width=450,height=650,scrollbars=yes,resizable=yes'
  );

  if (!enrollmentPopup) {
    throw new Error('Popup blocked. Please allow popups for this site.');
  }

  // Return a promise that will be resolved by the message handler
  return new Promise((resolve, reject) => {
    enrollmentResolve = resolve;
    enrollmentReject = reject;

    // Set a timeout in case popup is closed without completing
    const checkClosed = setInterval(() => {
      if (enrollmentPopup?.closed) {
        clearInterval(checkClosed);
        if (enrollmentResolve) {
          enrollmentResolve({
            success: false,
            error: 'Popup was closed',
            code: 'POPUP_CLOSED',
          });
          enrollmentResolve = null;
          enrollmentReject = null;
        }
      }
    }, 500);

    // Clear interval after 5 minutes (max enrollment time)
    setTimeout(() => {
      clearInterval(checkClosed);
    }, 5 * 60 * 1000);
  });
}

/**
 * Check if user has dismissed the enrollment prompt
 */
export function isEnrollmentPromptDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('wsim-enrollment-dismissed') === 'true';
}

/**
 * Dismiss the enrollment prompt
 * @param permanent - If true, never show again. If false, show again later.
 */
export function dismissEnrollmentPrompt(permanent: boolean): void {
  if (typeof window === 'undefined') return;

  if (permanent) {
    localStorage.setItem('wsim-enrollment-dismissed', 'true');
  }
  // For temporary dismissal, we don't store anything - just close the prompt
}

/**
 * Clear the enrollment prompt dismissal (for testing or settings)
 */
export function clearEnrollmentPromptDismissal(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('wsim-enrollment-dismissed');
}
