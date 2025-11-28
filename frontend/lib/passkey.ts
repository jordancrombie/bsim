import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { api } from './api';

/**
 * Register a new passkey for the current user
 */
export async function registerPasskey(): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if WebAuthn is supported
    if (!window.PublicKeyCredential) {
      return { success: false, error: 'WebAuthn is not supported in this browser' };
    }

    // Get registration options from server
    const options = await api.generatePasskeyRegistrationOptions();

    // Start registration process
    const credential = await startRegistration(options);

    // Verify registration with server
    const result = await api.verifyPasskeyRegistration(credential);

    if (result.verified) {
      return { success: true };
    } else {
      return { success: false, error: 'Failed to verify passkey registration' };
    }
  } catch (error: any) {
    console.error('Passkey registration error:', error);
    return {
      success: false,
      error: error.message || 'Failed to register passkey',
    };
  }
}

/**
 * Authenticate with a passkey
 */
export async function authenticateWithPasskey(
  email?: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    // Check if WebAuthn is supported
    if (!window.PublicKeyCredential) {
      return { success: false, error: 'WebAuthn is not supported in this browser' };
    }

    // Get authentication options from server
    const options = await api.generatePasskeyAuthenticationOptions(email);

    // Start authentication process
    const credential = await startAuthentication(options);

    // Verify authentication with server
    const result = await api.verifyPasskeyAuthentication(email, credential);

    if (result.token) {
      return { success: true, token: result.token };
    } else {
      return { success: false, error: 'Failed to verify passkey authentication' };
    }
  } catch (error: any) {
    console.error('Passkey authentication error:', error);
    return {
      success: false,
      error: error.message || 'Failed to authenticate with passkey',
    };
  }
}

/**
 * Check if WebAuthn is available
 */
export function isWebAuthnAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === 'function'
  );
}

/**
 * Check if platform authenticator (like Touch ID, Face ID) is available
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnAvailable()) {
    return false;
  }

  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}
