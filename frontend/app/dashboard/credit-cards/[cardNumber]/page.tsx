'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { CreditCard, CreditCardTransaction } from '@/types';
import { CreditCardType, CreditCardTransactionType } from '@/types';

export default function CreditCardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cardNumber = params.cardNumber as string;

  const [creditCard, setCreditCard] = useState<CreditCard | null>(null);
  const [transactions, setTransactions] = useState<CreditCardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cardNumber) {
      loadCreditCardData();
    }
  }, [cardNumber]);

  const loadCreditCardData = async () => {
    try {
      const [card, txnResponse] = await Promise.all([
        api.getCreditCard(cardNumber),
        api.getCreditCardTransactions(cardNumber),
      ]);
      setCreditCard(card);
      setTransactions(txnResponse.transactions);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load credit card');
    } finally {
      setLoading(false);
    }
  };

  const formatCardNumber = (cardNumber: string) => {
    return cardNumber.replace(/(\d{4})/g, '$1 ').trim();
  };

  const getCardTypeDisplay = (cardType: CreditCardType) => {
    switch (cardType) {
      case CreditCardType.VISA:
        return { name: 'VISA', color: 'text-white' };
      case CreditCardType.VISA_DEBIT:
        return { name: 'VISA DEBIT', color: 'text-white' };
      case CreditCardType.MC:
        return { name: 'Mastercard', color: 'text-white' };
      case CreditCardType.MC_DEBIT:
        return { name: 'MC Debit', color: 'text-white' };
      case CreditCardType.AMEX:
        return { name: 'AMEX', color: 'text-white' };
      default:
        return { name: cardType, color: 'text-white' };
    }
  };

  const getCardGradient = (cardType: CreditCardType) => {
    switch (cardType) {
      case CreditCardType.VISA:
      case CreditCardType.VISA_DEBIT:
        return 'from-blue-600 to-blue-800';
      case CreditCardType.MC:
      case CreditCardType.MC_DEBIT:
        return 'from-red-600 to-orange-600';
      case CreditCardType.AMEX:
        return 'from-slate-600 to-slate-800';
      default:
        return 'from-indigo-600 to-purple-700';
    }
  };

  const getTransactionIcon = (type: CreditCardTransactionType) => {
    switch (type) {
      case CreditCardTransactionType.CHARGE:
        return (
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        );
      case CreditCardTransactionType.PAYMENT:
        return (
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </div>
        );
      case CreditCardTransactionType.REFUND:
        return (
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </div>
        );
    }
  };

  const getTransactionColor = (type: CreditCardTransactionType) => {
    switch (type) {
      case CreditCardTransactionType.CHARGE:
        return 'text-red-600';
      case CreditCardTransactionType.PAYMENT:
        return 'text-green-600';
      case CreditCardTransactionType.REFUND:
        return 'text-blue-600';
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

  const getMccDescription = (mccCode: string | undefined) => {
    if (!mccCode) return null;
    // Common MCC codes
    const mccDescriptions: Record<string, string> = {
      '5411': 'Grocery Stores',
      '5541': 'Gas Stations',
      '5812': 'Restaurants',
      '5814': 'Fast Food',
      '5912': 'Drug Stores',
      '5311': 'Department Stores',
      '5651': 'Clothing Stores',
      '5732': 'Electronics Stores',
      '5942': 'Book Stores',
      '7011': 'Hotels & Lodging',
      '4111': 'Transportation',
      '4121': 'Taxis & Rideshare',
      '5999': 'Miscellaneous Retail',
      '7299': 'Miscellaneous Services',
      '8099': 'Medical Services',
    };
    return mccDescriptions[mccCode] || `MCC ${mccCode}`;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading credit card...</p>
      </div>
    );
  }

  if (error || !creditCard) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
        <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-gray-600 mb-4">{error || 'Credit card not found'}</p>
        <Link
          href="/dashboard/credit-cards"
          className="text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Back to Credit Cards
        </Link>
      </div>
    );
  }

  const cardTypeInfo = getCardTypeDisplay(creditCard.cardType);
  const gradient = getCardGradient(creditCard.cardType);
  const currentBalance = creditCard.creditLimit - creditCard.availableCredit;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/dashboard/credit-cards"
          className="text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Credit Cards
        </Link>
      </div>

      {/* Credit Card Display */}
      <div className="mb-8">
        <div className={`bg-gradient-to-br ${gradient} rounded-xl shadow-lg p-6 text-white relative overflow-hidden max-w-md`}>
          {/* Card background pattern */}
          <div className="absolute top-0 right-0 opacity-10">
            <svg className="w-32 h-32" viewBox="0 0 100 100" fill="currentColor">
              <circle cx="50" cy="50" r="40" />
            </svg>
          </div>

          {/* Card type badge in top right */}
          <div className="absolute top-4 right-4">
            <span className={`font-bold text-lg tracking-wide ${cardTypeInfo.color}`}>
              {cardTypeInfo.name}
            </span>
          </div>

          {/* Card chip */}
          <div className="w-12 h-10 bg-gradient-to-br from-yellow-200 to-yellow-400 rounded mb-6 opacity-80"></div>

          {/* Card number */}
          <p className="font-mono text-xl tracking-wider mb-6">
            {formatCardNumber(creditCard.cardNumber)}
          </p>

          {/* Card holder and expiry */}
          <div className="flex justify-between items-end">
            <div>
              <p className="text-xs opacity-70 mb-1">CARD HOLDER</p>
              <p className="font-medium text-sm">{creditCard.cardHolder}</p>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-70 mb-1">EXPIRES</p>
              <p className="font-medium text-sm">
                {String(creditCard.expiryMonth).padStart(2, '0')}/{String(creditCard.expiryYear).slice(-2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Current Balance</p>
          <p className="text-2xl font-bold text-gray-900">${currentBalance.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Available Credit</p>
          <p className="text-2xl font-bold text-green-600">${creditCard.availableCredit.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Credit Limit</p>
          <p className="text-2xl font-bold text-gray-900">${creditCard.creditLimit.toFixed(2)}</p>
        </div>
      </div>

      {/* Credit Utilization Bar */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-8">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium text-gray-700">Credit Utilization</p>
          <p className="text-sm text-gray-500">
            {((currentBalance / creditCard.creditLimit) * 100).toFixed(1)}%
          </p>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full ${
              (currentBalance / creditCard.creditLimit) > 0.9
                ? 'bg-red-500'
                : (currentBalance / creditCard.creditLimit) > 0.7
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.min((currentBalance / creditCard.creditLimit) * 100, 100)}%` }}
          ></div>
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
                          {txn.merchantName || txn.description || txn.type}
                        </p>
                        {txn.merchantName && txn.description && (
                          <p className="text-sm text-gray-500">{txn.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-gray-400">
                            {formatDate(txn.transactionDate)}
                          </p>
                          {txn.mccCode && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                              {getMccDescription(txn.mccCode)}
                            </span>
                          )}
                          {txn.merchantId && (
                            <span className="text-xs text-gray-400">
                              ID: {txn.merchantId}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${getTransactionColor(txn.type)}`}>
                          {txn.type === CreditCardTransactionType.CHARGE ? '-' : '+'}${txn.amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Avail: ${txn.availableAfter.toFixed(2)}
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
    </div>
  );
}
