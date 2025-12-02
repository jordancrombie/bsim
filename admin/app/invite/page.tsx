'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { startRegistration } from '@simplewebauthn/browser';
import Link from 'next/link';

interface InviteInfo {
  id: string;
  email: string | null;
  role: string;
  expiresAt: string;
  createdBy: string;
}

function InvitePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get('code') || '';

  const [step, setStep] = useState<'code' | 'form'>('code');
  const [inviteCode, setInviteCode] = useState(codeFromUrl);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);

  // Auto-validate if code is in URL
  useEffect(() => {
    if (codeFromUrl) {
      validateCode(codeFromUrl);
    }
  }, [codeFromUrl]);

  const validateCode = async (code: string) => {
    setError('');
    setValidating(true);

    try {
      const res = await fetch('/api/invites/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (!res.ok || !data.valid) {
        throw new Error(data.error || 'Invalid invite code');
      }

      setInviteInfo(data.invite);
      // Pre-fill email if restricted
      if (data.invite.email) {
        setFormData((prev) => ({ ...prev, email: data.invite.email }));
      }
      setStep('form');
    } catch (err: any) {
      setError(err.message || 'Failed to validate invite code');
    } finally {
      setValidating(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await validateCode(inviteCode);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Get registration options with invite code
      const optionsRes = await fetch('/api/auth/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          inviteCode,
        }),
      });

      if (!optionsRes.ok) {
        const data = await optionsRes.json();
        throw new Error(data.error || 'Failed to start registration');
      }

      const { options, adminId } = await optionsRes.json();

      // Start passkey registration
      const credential = await startRegistration(options);

      // Verify with server
      const verifyRes = await fetch('/api/auth/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, adminId }),
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error(data.error || 'Registration failed');
      }

      // Redirect to dashboard
      router.push('/');
      router.refresh();
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Format the invite code as user types (XXXX-XXXX-XXXX)
  const handleCodeChange = (value: string) => {
    // Remove non-alphanumeric characters
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    // Add dashes
    let formatted = cleaned;
    if (cleaned.length > 4) {
      formatted = cleaned.slice(0, 4) + '-' + cleaned.slice(4);
    }
    if (cleaned.length > 8) {
      formatted = formatted.slice(0, 9) + '-' + cleaned.slice(8, 12);
    }
    setInviteCode(formatted);
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Validating invite code...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        {step === 'code' ? (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Admin Invite</h1>
              <p className="text-gray-600 mt-2">Enter your invite code to register</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleCodeSubmit}>
              <div className="mb-6">
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                  Invite Code
                </label>
                <input
                  type="text"
                  id="code"
                  required
                  value={inviteCode}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX"
                  maxLength={14}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-center text-lg tracking-widest font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={inviteCode.length < 12}
                className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/login" className="text-indigo-600 hover:text-indigo-500 text-sm">
                Already have an account? Sign in
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Create Admin Account</h1>
              <p className="text-gray-600 mt-2">
                Invited by {inviteInfo?.createdBy}
              </p>
              {inviteInfo?.role === 'SUPER_ADMIN' && (
                <span className="inline-block mt-2 px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
                  Super Admin
                </span>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleRegister}>
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="admin@example.com"
                  disabled={!!inviteInfo?.email}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                {inviteInfo?.email && (
                  <p className="mt-1 text-xs text-gray-500">
                    This invite is restricted to this email address
                  </p>
                )}
              </div>

              <div className="mb-4">
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  id="firstName"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="John"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="mb-6">
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  id="lastName"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Doe"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating account...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                    </svg>
                    Create Account with Passkey
                  </>
                )}
              </button>
            </form>

            <button
              onClick={() => {
                setStep('code');
                setInviteInfo(null);
                setError('');
              }}
              className="mt-4 w-full text-center text-gray-600 hover:text-gray-800 text-sm"
            >
              Use a different invite code
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    }>
      <InvitePageContent />
    </Suspense>
  );
}
