'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { isPlatformAuthenticatorAvailable } from '@/lib/passkey';
import PasskeyPrompt from '@/components/PasskeyPrompt';
import type { Account, CreditCard } from '@/types';

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);

  useEffect(() => {
    loadAccounts();
    loadCreditCards();
    checkPasskeySetup();
  }, []);

  const checkPasskeySetup = async () => {
    // Check if platform authenticator is available
    const available = await isPlatformAuthenticatorAvailable();
    if (!available) return;

    setPasskeyAvailable(true);

    // Check if user has dismissed the prompt permanently
    const dismissed = localStorage.getItem('passkey-prompt-dismissed');
    if (dismissed === 'true') return;

    // Check if user has any passkeys
    try {
      const response = await api.getUserPasskeys();
      if (response.passkeys.length === 0) {
        setShowPasskeyPrompt(true);
      }
    } catch (err) {
      // If error, don't show prompt
      console.error('Failed to check passkeys:', err);
    }
  };

  const loadAccounts = async () => {
    try {
      const response = await api.getAccounts();
      setAccounts(response.accounts);
    } catch (err: any) {
      setError('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const loadCreditCards = async () => {
    try {
      const cards = await api.getCreditCards();
      setCreditCards(cards);
    } catch (err: any) {
      console.error('Failed to load credit cards:', err);
    }
  };

  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const totalAvailableCredit = creditCards.reduce((sum, card) => sum + card.availableCredit, 0);
  const totalCreditLimit = creditCards.reduce((sum, card) => sum + card.creditLimit, 0);

  const handlePasskeyDismiss = () => {
    setShowPasskeyPrompt(false);
  };

  const handlePasskeySetupComplete = () => {
    setShowPasskeyPrompt(false);
    // Could show a success message here if desired
  };

  return (
    <div>
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1 md:mt-2 text-sm md:text-base">Welcome to your banking dashboard</p>
      </div>

      {/* Passkey Setup Prompt */}
      {showPasskeyPrompt && passkeyAvailable && (
        <PasskeyPrompt
          onDismiss={handlePasskeyDismiss}
          onSetupComplete={handlePasskeySetupComplete}
        />
      )}

      {/* Quick Actions - Mobile Only */}
      <div className="md:hidden grid grid-cols-3 gap-3 mb-6">
        <Link
          href="/dashboard/transfer"
          className="flex flex-col items-center p-4 bg-white rounded-lg shadow border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <div className="bg-blue-100 rounded-full p-3 mb-2">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <span className="text-xs font-medium text-gray-700">Send</span>
        </Link>
        <Link
          href="/dashboard/transfer"
          className="flex flex-col items-center p-4 bg-white rounded-lg shadow border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <div className="bg-green-100 rounded-full p-3 mb-2">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <span className="text-xs font-medium text-gray-700">Transfer</span>
        </Link>
        <Link
          href="/dashboard/wallet-pay"
          className="flex flex-col items-center p-4 bg-white rounded-lg shadow border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <div className="bg-purple-100 rounded-full p-3 mb-2">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <span className="text-xs font-medium text-gray-700">Pay</span>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
        <div className="bg-white rounded-lg shadow p-4 md:p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm font-medium text-gray-600">Total Balance</p>
              <p className="text-xl md:text-3xl font-bold text-gray-900 mt-1 md:mt-2 truncate">
                ${totalBalance.toFixed(2)}
              </p>
            </div>
            <div className="bg-indigo-100 rounded-full p-2 md:p-3 ml-2 flex-shrink-0">
              <svg className="w-5 h-5 md:w-8 md:h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 md:p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-gray-600">Active Accounts</p>
              <p className="text-xl md:text-3xl font-bold text-gray-900 mt-1 md:mt-2">{accounts.length}</p>
            </div>
            <div className="bg-green-100 rounded-full p-2 md:p-3 ml-2 flex-shrink-0">
              <svg className="w-5 h-5 md:w-8 md:h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 md:p-6 border border-gray-200 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm font-medium text-gray-600">Available Credit</p>
              <p className="text-xl md:text-3xl font-bold text-gray-900 mt-1 md:mt-2 truncate">
                ${totalAvailableCredit.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">of ${totalCreditLimit.toFixed(2)}</p>
            </div>
            <div className="bg-purple-100 rounded-full p-2 md:p-3 ml-2 flex-shrink-0">
              <svg className="w-5 h-5 md:w-8 md:h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Quick Actions - Desktop Only */}
        <div className="hidden md:block bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Quick Actions</p>
              <div className="flex flex-col gap-2 mt-2">
                <Link
                  href="/dashboard/accounts"
                  className="text-sm bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 transition-colors text-center"
                >
                  New Account
                </Link>
                <Link
                  href="/dashboard/credit-cards"
                  className="text-sm bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 transition-colors text-center"
                >
                  New Card
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accounts List */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900">Accounts Overview</h2>
          <Link
            href="/dashboard/accounts"
            className="text-xs md:text-sm text-indigo-600 hover:text-indigo-700"
          >
            View all
          </Link>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-600">Loading accounts...</div>
        ) : error ? (
          <div className="p-6 text-center text-red-600">{error}</div>
        ) : accounts.length === 0 ? (
          <div className="p-8 md:p-12 text-center">
            <svg className="w-12 h-12 md:w-16 md:h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="text-gray-600 mb-4 text-sm md:text-base">You don't have any accounts yet</p>
            <Link
              href="/dashboard/accounts"
              className="inline-block bg-indigo-600 text-white px-4 md:px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm md:text-base"
            >
              Create Your First Account
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {accounts.map((account) => (
              <Link
                key={account.id}
                href={`/dashboard/accounts/${account.accountNumber}`}
                className="flex items-center justify-between p-4 md:p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm md:text-base">
                    Chequing ({account.accountNumber.slice(-4)})
                  </p>
                  <p className="text-xs md:text-sm text-gray-500 mt-0.5 md:mt-1 hidden md:block">
                    Created {new Date(account.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-lg md:text-2xl font-bold text-gray-900">
                    ${account.balance.toFixed(2)}
                  </p>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Credit Cards List */}
      <div className="bg-white rounded-lg shadow border border-gray-200 mt-6 md:mt-8">
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900">Credit Cards</h2>
          <Link
            href="/dashboard/credit-cards"
            className="text-xs md:text-sm text-indigo-600 hover:text-indigo-700"
          >
            View all
          </Link>
        </div>

        {creditCards.length === 0 ? (
          <div className="p-8 md:p-12 text-center">
            <svg className="w-12 h-12 md:w-16 md:h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <p className="text-gray-600 mb-4 text-sm md:text-base">You don't have any credit cards yet</p>
            <Link
              href="/dashboard/credit-cards"
              className="inline-block bg-purple-600 text-white px-4 md:px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm md:text-base"
            >
              Create Your First Credit Card
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {creditCards.slice(0, 3).map((card) => {
              return (
                <Link
                  key={card.id}
                  href={`/dashboard/credit-cards/${card.cardNumber}`}
                  className="flex items-center justify-between p-4 md:p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-lg p-2 md:p-3 flex-shrink-0">
                      <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm md:text-base">
                        VISA ({card.cardNumber.slice(-4)})
                      </p>
                      <p className="text-xs md:text-sm text-gray-500 mt-0.5 truncate hidden md:block">{card.cardHolder}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-lg md:text-2xl font-bold text-gray-900">
                        ${card.availableCredit.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500 hidden md:block">of ${card.creditLimit.toFixed(2)}</p>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
