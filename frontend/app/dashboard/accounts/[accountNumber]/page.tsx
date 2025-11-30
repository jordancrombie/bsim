'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Account, Transaction } from '@/types';
import { AccountType, TransactionType } from '@/types';

export default function AccountDetailPage() {
  const params = useParams();
  const accountNumber = params.accountNumber as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Transaction form state
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [processing, setProcessing] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (accountNumber) {
      loadAccountData();
    }
  }, [accountNumber]);

  const loadAccountData = async () => {
    try {
      const [accountResponse, txnResponse] = await Promise.all([
        api.getAccount(accountNumber),
        api.getTransactions(accountNumber),
      ]);
      setAccount(accountResponse.account);
      setTransactions(txnResponse.transactions);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load account');
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    setFormError('');
    setProcessing(true);

    try {
      const depositAmount = parseFloat(amount);
      if (isNaN(depositAmount) || depositAmount <= 0) {
        setFormError('Please enter a valid amount');
        setProcessing(false);
        return;
      }

      await api.deposit({
        accountNumber,
        amount: depositAmount,
        description: description || undefined,
      });

      setShowDepositModal(false);
      setAmount('');
      setDescription('');
      await loadAccountData();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to deposit');
    } finally {
      setProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    setFormError('');
    setProcessing(true);

    try {
      const withdrawAmount = parseFloat(amount);
      if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
        setFormError('Please enter a valid amount');
        setProcessing(false);
        return;
      }

      await api.withdraw({
        accountNumber,
        amount: withdrawAmount,
        description: description || undefined,
      });

      setShowWithdrawModal(false);
      setAmount('');
      setDescription('');
      await loadAccountData();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to withdraw');
    } finally {
      setProcessing(false);
    }
  };

  const getAccountTypeDisplay = (type: AccountType) => {
    switch (type) {
      case AccountType.CHECKING:
        return { name: 'Checking', color: 'bg-blue-100 text-blue-800' };
      case AccountType.SAVINGS:
        return { name: 'Savings', color: 'bg-green-100 text-green-800' };
      case AccountType.MONEY_MARKET:
        return { name: 'Money Market', color: 'bg-purple-100 text-purple-800' };
      case AccountType.CERTIFICATE_OF_DEPOSIT:
        return { name: 'CD', color: 'bg-amber-100 text-amber-800' };
      default:
        return { name: type, color: 'bg-gray-100 text-gray-800' };
    }
  };

  const getTransactionIcon = (type: TransactionType) => {
    switch (type) {
      case TransactionType.DEPOSIT:
        return (
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </div>
        );
      case TransactionType.WITHDRAWAL:
        return (
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        );
      case TransactionType.TRANSFER:
        return (
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
        );
    }
  };

  const getTransactionColor = (type: TransactionType) => {
    switch (type) {
      case TransactionType.DEPOSIT:
        return 'text-green-600';
      case TransactionType.WITHDRAWAL:
        return 'text-red-600';
      case TransactionType.TRANSFER:
        return 'text-blue-600';
    }
  };

  const getTransactionSign = (type: TransactionType) => {
    switch (type) {
      case TransactionType.DEPOSIT:
        return '+';
      case TransactionType.WITHDRAWAL:
        return '-';
      case TransactionType.TRANSFER:
        return '';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading account...</p>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
        <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-gray-600 mb-4">{error || 'Account not found'}</p>
        <Link
          href="/dashboard/accounts"
          className="text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Back to Accounts
        </Link>
      </div>
    );
  }

  const accountTypeInfo = getAccountTypeDisplay(account.accountType);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/dashboard/accounts"
          className="text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Accounts
        </Link>
      </div>

      {/* Account Header */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{account.accountNumber}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${accountTypeInfo.color}`}>
                {accountTypeInfo.name}
              </span>
            </div>
            <p className="text-gray-500">
              Opened {new Date(account.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 mb-1">Current Balance</p>
            <p className="text-3xl font-bold text-gray-900">${account.balance.toFixed(2)}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={() => setShowDepositModal(true)}
            className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Deposit
          </button>
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
            Withdraw
          </button>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Transaction History</h2>
        </div>

        {transactions.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-600">No transactions yet</p>
            <p className="text-sm text-gray-500 mt-1">Make a deposit to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {transactions.map((txn) => (
              <div key={txn.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start gap-4">
                  {getTransactionIcon(txn.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {txn.type.charAt(0) + txn.type.slice(1).toLowerCase()}
                        </p>
                        {txn.description && (
                          <p className="text-sm text-gray-500">{txn.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(txn.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${getTransactionColor(txn.type)}`}>
                          {getTransactionSign(txn.type)}${txn.amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Balance: ${txn.balanceAfter.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Deposit Funds</h2>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                {formError}
              </div>
            )}

            <div className="mb-4">
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
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                placeholder="Paycheck, gift, etc."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDepositModal(false);
                  setAmount('');
                  setDescription('');
                  setFormError('');
                }}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeposit}
                disabled={processing || !amount}
                className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Deposit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Withdraw Funds</h2>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                {formError}
              </div>
            )}

            <div className="mb-2">
              <p className="text-sm text-gray-500">
                Available balance: <span className="font-medium text-gray-900">${account.balance.toFixed(2)}</span>
              </p>
            </div>

            <div className="mb-4">
              <label htmlFor="withdrawAmount" className="block text-sm font-medium text-gray-700 mb-2">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-500">$</span>
                <input
                  id="withdrawAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={account.balance}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="withdrawDescription" className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <input
                id="withdrawDescription"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
                placeholder="ATM, bills, etc."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWithdrawModal(false);
                  setAmount('');
                  setDescription('');
                  setFormError('');
                }}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                disabled={processing || !amount}
                className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
