'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { CreditCard } from '@/types';

export default function CreditCardsPage() {
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [creditLimit, setCreditLimit] = useState('5000');
  const [cardHolder, setCardHolder] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadCreditCards();
  }, []);

  const loadCreditCards = async () => {
    try {
      const cards = await api.getCreditCards();
      setCreditCards(cards);
    } catch (err) {
      setError('Failed to load credit cards');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCreditCard = async () => {
    setError('');
    setCreating(true);

    try {
      const limit = parseFloat(creditLimit);
      if (limit <= 0) {
        setError('Credit limit must be greater than 0');
        setCreating(false);
        return;
      }

      await api.createCreditCard({
        creditLimit: limit,
        cardHolder: cardHolder || undefined
      });
      setShowModal(false);
      setCreditLimit('5000');
      setCardHolder('');
      await loadCreditCards();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create credit card');
    } finally {
      setCreating(false);
    }
  };

  const formatCardNumber = (cardNumber: string) => {
    return cardNumber.replace(/(\d{4})/g, '$1 ').trim();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Credit Cards</h1>
          <p className="text-gray-600 mt-2">Manage your credit cards</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          + Create Credit Card
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading credit cards...</p>
        </div>
      ) : creditCards.length === 0 ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <p className="text-gray-600 mb-4">You don't have any credit cards yet</p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Create Your First Credit Card
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {creditCards.map((card) => (
            <Link
              key={card.id}
              href={`/dashboard/credit-cards/${card.cardNumber}`}
              className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow text-white relative overflow-hidden"
            >
              {/* Card background pattern */}
              <div className="absolute top-0 right-0 opacity-10">
                <svg className="w-32 h-32" viewBox="0 0 100 100" fill="currentColor">
                  <circle cx="50" cy="50" r="40" />
                </svg>
              </div>

              {/* Card chip */}
              <div className="w-12 h-10 bg-gradient-to-br from-yellow-200 to-yellow-400 rounded mb-6 opacity-80"></div>

              {/* Card number */}
              <p className="font-mono text-xl tracking-wider mb-6">
                {formatCardNumber(card.cardNumber)}
              </p>

              {/* Card holder and expiry */}
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs opacity-70 mb-1">CARD HOLDER</p>
                  <p className="font-medium text-sm">{card.cardHolder}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-70 mb-1">EXPIRES</p>
                  <p className="font-medium text-sm">
                    {String(card.expiryMonth).padStart(2, '0')}/{String(card.expiryYear).slice(-2)}
                  </p>
                </div>
              </div>

              {/* Available credit */}
              <div className="mt-6 pt-4 border-t border-white border-opacity-20">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs opacity-70 mb-1">AVAILABLE CREDIT</p>
                    <p className="text-2xl font-bold">
                      ${card.availableCredit.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs opacity-70 mb-1">LIMIT</p>
                    <p className="text-sm font-medium">
                      ${card.creditLimit.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Credit Card Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Create New Credit Card</h2>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="creditLimit" className="block text-sm font-medium text-gray-700 mb-2">
                Credit Limit
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-500">$</span>
                <input
                  id="creditLimit"
                  type="number"
                  min="100"
                  step="100"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  placeholder="5000.00"
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                The maximum amount you can charge to this card
              </p>
            </div>

            <div className="mb-6">
              <label htmlFor="cardHolder" className="block text-sm font-medium text-gray-700 mb-2">
                Card Holder Name (Optional)
              </label>
              <input
                id="cardHolder"
                type="text"
                value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                placeholder="Your name"
              />
              <p className="mt-2 text-sm text-gray-500">
                If not provided, your account name will be used
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setError('');
                  setCreditLimit('5000');
                  setCardHolder('');
                }}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCreditCard}
                disabled={creating}
                className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Card'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
