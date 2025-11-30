'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Account } from '@/types';

export default function TransferPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [fromAccountNumber, setFromAccountNumber] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const response = await api.getAccounts();
      setAccounts(response.accounts);
      if (response.accounts.length > 0) {
        setFromAccountNumber(response.accounts[0].accountNumber);
      }
    } catch (err) {
      setError('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const transferAmount = parseFloat(amount);
      if (isNaN(transferAmount) || transferAmount <= 0) {
        setError('Please enter a valid amount greater than 0');
        setSubmitting(false);
        return;
      }

      const selectedAccount = accounts.find(a => a.accountNumber === fromAccountNumber);
      if (selectedAccount && transferAmount > selectedAccount.balance) {
        setError('Insufficient funds');
        setSubmitting(false);
        return;
      }

      const result = await api.transfer({
        fromAccountNumber,
        toEmail,
        amount: transferAmount,
        description: description || undefined,
      });

      setSuccess(`Transfer successful! Sent $${transferAmount.toFixed(2)} to ${result.recipientEmail}`);
      setToEmail('');
      setAmount('');
      setDescription('');

      // Reload accounts to update balances
      await loadAccounts();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  };

  const getSelectedAccountBalance = () => {
    const account = accounts.find(a => a.accountNumber === fromAccountNumber);
    return account ? account.balance : 0;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
        <p className="text-gray-600 mb-4">You need an account to make transfers</p>
        <a
          href="/dashboard/accounts"
          className="text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Create an Account
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Transfer Money</h1>
        <p className="text-gray-600 mt-2">Send money to another user by their email address</p>
      </div>

      <div className="max-w-lg">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-6">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* From Account */}
            <div>
              <label htmlFor="fromAccount" className="block text-sm font-medium text-gray-700 mb-2">
                From Account
              </label>
              <select
                id="fromAccount"
                value={fromAccountNumber}
                onChange={(e) => setFromAccountNumber(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.accountNumber}>
                    {account.accountNumber} - ${account.balance.toFixed(2)} ({account.accountType})
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-gray-500">
                Available balance: ${getSelectedAccountBalance().toFixed(2)}
              </p>
            </div>

            {/* Recipient Email */}
            <div>
              <label htmlFor="toEmail" className="block text-sm font-medium text-gray-700 mb-2">
                Recipient Email
              </label>
              <input
                id="toEmail"
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                placeholder="recipient@example.com"
              />
              <p className="mt-2 text-sm text-gray-500">
                Enter the email address of the person you want to send money to
              </p>
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-500">$</span>
                <input
                  id="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                placeholder="What's this transfer for?"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Send Transfer'
              )}
            </button>
          </form>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-blue-800">
                <strong>How it works:</strong> Enter the recipient's email address and the amount you want to send.
                The money will be transferred to their primary account instantly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
