'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  initWsimMessageListener,
  cleanupWsimMessageListener,
  openWsimEnrollment,
  isEnrollmentPromptDismissed,
  clearEnrollmentPromptDismissal,
  EnrollmentResult,
} from '@/lib/wsimEnrollment';
import WsimEnrollmentPrompt from '@/components/WsimEnrollmentPrompt';
import type { WsimEnrollmentStatus } from '@/types';

export default function WalletPayPage() {
  const [loading, setLoading] = useState(true);
  const [enrollmentStatus, setEnrollmentStatus] = useState<WsimEnrollmentStatus | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    // Initialize message listener for WSIM popup communication
    initWsimMessageListener();

    // Load enrollment status
    loadEnrollmentStatus();

    return () => {
      cleanupWsimMessageListener();
    };
  }, []);

  const loadEnrollmentStatus = async () => {
    try {
      const status = await api.getWsimEnrollmentStatus();
      setEnrollmentStatus(status);

      // Show prompt if not enrolled and not dismissed
      if (!status.enrolled && status.canEnroll && !isEnrollmentPromptDismissed()) {
        setShowPrompt(true);
      }
    } catch (err) {
      console.error('Failed to load enrollment status:', err);
      setError('Failed to load wallet status');
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    setEnrolling(true);
    setError('');

    try {
      const result = await openWsimEnrollment();
      handleEnrollmentComplete(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open enrollment');
      setEnrolling(false);
    }
  };

  const handleEnrollmentComplete = (result: EnrollmentResult) => {
    setEnrolling(false);
    setShowPrompt(false);

    if (result.success) {
      setSuccessMessage(
        result.cardsEnrolled
          ? `Successfully enrolled ${result.cardsEnrolled} card(s) in Wallet Pay!`
          : 'Successfully enrolled in Wallet Pay!'
      );
      // Reload enrollment status
      loadEnrollmentStatus();
    } else if (result.code !== 'CANCELLED' && result.code !== 'POPUP_CLOSED') {
      setError(result.error || 'Enrollment failed');
    }
  };

  const handlePromptDismiss = () => {
    setShowPrompt(false);
  };

  const handleResetPrompt = () => {
    clearEnrollmentPromptDismissal();
    setShowPrompt(true);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Wallet Pay</h1>
        <p className="text-gray-600 mt-1">
          Add your BSIM cards to WSIM Wallet for fast, secure mobile payments.
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {successMessage}
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-green-600 hover:text-green-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
          <button onClick={() => setError('')} className="text-red-600 hover:text-red-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Enrollment Prompt */}
      {showPrompt && !enrollmentStatus?.enrolled && (
        <WsimEnrollmentPrompt
          onDismiss={handlePromptDismiss}
          onEnrollmentComplete={handleEnrollmentComplete}
        />
      )}

      {/* Enrollment Status Card */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Enrollment Status</h2>
        </div>

        <div className="p-6">
          {enrollmentStatus?.enrolled ? (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-green-100 rounded-full p-2">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Enrolled in {enrollmentStatus.walletName || 'WSIM Wallet'}</p>
                  <p className="text-sm text-gray-600">Your cards are ready for mobile payments</p>
                </div>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">Wallet ID</dt>
                  <dd className="text-sm font-medium text-gray-900">{enrollmentStatus.walletId}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Cards Enrolled</dt>
                  <dd className="text-sm font-medium text-gray-900">{enrollmentStatus.cardCount || 0}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Enrolled On</dt>
                  <dd className="text-sm font-medium text-gray-900">{formatDate(enrollmentStatus.enrolledAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Expires</dt>
                  <dd className="text-sm font-medium text-gray-900">{formatDate(enrollmentStatus.expiresAt)}</dd>
                </div>
              </dl>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {enrolling ? 'Opening...' : 'Manage Enrolled Cards'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-gray-100 rounded-full p-2">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Not Enrolled</p>
                  <p className="text-sm text-gray-600">
                    {enrollmentStatus?.canEnroll
                      ? 'Enroll your cards to start using Wallet Pay'
                      : 'You need at least one credit card to enroll'}
                  </p>
                </div>
              </div>

              {enrollmentStatus?.canEnroll ? (
                <div className="flex gap-3">
                  <button
                    onClick={handleEnroll}
                    disabled={enrolling}
                    className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {enrolling ? 'Opening...' : 'Enroll in Wallet Pay'}
                  </button>
                  {isEnrollmentPromptDismissed() && !showPrompt && (
                    <button
                      onClick={handleResetPrompt}
                      className="text-gray-600 px-4 py-2 hover:text-gray-900 transition-colors text-sm"
                    >
                      Show enrollment prompt
                    </button>
                  )}
                </div>
              ) : (
                <a
                  href="/dashboard/credit-cards"
                  className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  Add a Credit Card
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* How It Works Section */}
      <div className="mt-8 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">How Wallet Pay Works</h2>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-purple-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">1. Enroll Your Cards</h3>
              <p className="text-sm text-gray-600">
                Select which BSIM cards you want to use with Wallet Pay
              </p>
            </div>

            <div className="text-center">
              <div className="bg-purple-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">2. Secure with Biometrics</h3>
              <p className="text-sm text-gray-600">
                Use Face ID, Touch ID, or your device PIN for authentication
              </p>
            </div>

            <div className="text-center">
              <div className="bg-purple-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">3. Pay Anywhere</h3>
              <p className="text-sm text-gray-600">
                Use WSIM Wallet at any merchant that accepts contactless payments
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
