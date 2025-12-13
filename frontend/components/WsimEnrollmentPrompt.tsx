'use client';

import { useState } from 'react';
import {
  openWsimEnrollment,
  dismissEnrollmentPrompt,
  EnrollmentResult,
} from '@/lib/wsimEnrollment';

interface WsimEnrollmentPromptProps {
  onDismiss: () => void;
  onEnrollmentComplete: (result: EnrollmentResult) => void;
}

export default function WsimEnrollmentPrompt({
  onDismiss,
  onEnrollmentComplete,
}: WsimEnrollmentPromptProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDismissOptions, setShowDismissOptions] = useState(false);

  const handleEnroll = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await openWsimEnrollment();

      if (result.success) {
        onEnrollmentComplete(result);
      } else {
        if (result.code === 'CANCELLED' || result.code === 'POPUP_CLOSED') {
          // User cancelled, just reset state
          setLoading(false);
        } else {
          setError(result.error || 'Enrollment failed');
          setLoading(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open enrollment');
      setLoading(false);
    }
  };

  const handleDismiss = (permanent: boolean) => {
    dismissEnrollmentPrompt(permanent);
    onDismiss();
  };

  if (showDismissOptions) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Would you like to stop seeing this reminder?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Choose how you'd like to handle Wallet Pay reminders:
            </p>
            <div className="space-y-3">
              <button
                onClick={() => handleDismiss(false)}
                className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <p className="font-medium text-gray-900">Remind me later</p>
                <p className="text-sm text-gray-600">Show this prompt again next time</p>
              </button>
              <button
                onClick={() => handleDismiss(true)}
                className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <p className="font-medium text-gray-900">Don't ask again on this browser</p>
                <p className="text-sm text-gray-600">Permanently hide Wallet Pay reminders</p>
              </button>
              <button
                onClick={() => setShowDismissOptions(false)}
                className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="bg-purple-100 rounded-full p-3">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Add your cards to Wallet Pay
              </h3>
              <p className="text-sm text-gray-700 mb-4">
                Enroll your BSIM cards in WSIM Wallet to make fast, secure payments from your phone.
                Use your device's biometric authentication for checkout.
              </p>
            </div>
            <button
              onClick={() => setShowDismissOptions(true)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 ml-4"
              disabled={loading}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleEnroll}
              disabled={loading}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Opening...' : 'Enroll Now'}
            </button>
            <button
              onClick={() => setShowDismissOptions(true)}
              disabled={loading}
              className="bg-white text-gray-700 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
