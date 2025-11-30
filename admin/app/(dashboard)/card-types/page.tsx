'use client';

import { useState, useEffect } from 'react';

interface CreditCardType {
  id: string;
  code: string;
  name: string;
  cardNumberPrefix: string;
  cardNumberLength: number;
  cvvLength: number;
  isDebit: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function CardTypesPage() {
  const [cardTypes, setCardTypes] = useState<CreditCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<CreditCardType | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    cardNumberPrefix: '',
    cardNumberLength: 16,
    cvvLength: 3,
    isDebit: false,
    isActive: true,
    sortOrder: 0,
  });

  useEffect(() => {
    fetchCardTypes();
  }, []);

  const fetchCardTypes = async () => {
    try {
      const response = await fetch('/api/credit-card-types');
      if (response.ok) {
        const data = await response.json();
        setCardTypes(data.creditCardTypes);
      }
    } catch (error) {
      console.error('Failed to fetch card types:', error);
      setMessage({ type: 'error', text: 'Failed to load credit card types' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (cardType?: CreditCardType) => {
    if (cardType) {
      setEditingType(cardType);
      setFormData({
        code: cardType.code,
        name: cardType.name,
        cardNumberPrefix: cardType.cardNumberPrefix,
        cardNumberLength: cardType.cardNumberLength,
        cvvLength: cardType.cvvLength,
        isDebit: cardType.isDebit,
        isActive: cardType.isActive,
        sortOrder: cardType.sortOrder,
      });
    } else {
      setEditingType(null);
      setFormData({
        code: '',
        name: '',
        cardNumberPrefix: '',
        cardNumberLength: 16,
        cvvLength: 3,
        isDebit: false,
        isActive: true,
        sortOrder: cardTypes.length + 1,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingType(null);
    setMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const url = editingType
        ? `/api/credit-card-types/${editingType.id}`
        : '/api/credit-card-types';
      const method = editingType ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `Card type ${editingType ? 'updated' : 'created'} successfully!` });
        await fetchCardTypes();
        setTimeout(() => {
          handleCloseModal();
        }, 1000);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to save card type' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save card type' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cardType: CreditCardType) => {
    if (!confirm(`Are you sure you want to delete "${cardType.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/credit-card-types/${cardType.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Card type deleted successfully' });
        await fetchCardTypes();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to delete card type' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete card type' });
    }
  };

  const handleToggleActive = async (cardType: CreditCardType) => {
    try {
      const response = await fetch(`/api/credit-card-types/${cardType.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !cardType.isActive }),
      });

      if (response.ok) {
        await fetchCardTypes();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to update card type' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update card type' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Credit Card Types</h1>
          <p className="text-gray-600 mt-2">Manage the types of credit cards available in BSIM</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          + Add Card Type
        </button>
      </div>

      {message && !showModal && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Card Number Prefix
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Length
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                CVV
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {cardTypes.map((cardType) => (
              <tr key={cardType.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {cardType.sortOrder}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs font-mono bg-gray-100 rounded">
                    {cardType.code}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {cardType.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                  {cardType.cardNumberPrefix}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {cardType.cardNumberLength} digits
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {cardType.cvvLength} digits
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    cardType.isDebit
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {cardType.isDebit ? 'Debit' : 'Credit'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleToggleActive(cardType)}
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer ${
                      cardType.isActive
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {cardType.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleOpenModal(cardType)}
                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(cardType)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {cardTypes.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No card types</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by adding a credit card type.</p>
            <div className="mt-6">
              <button
                onClick={() => handleOpenModal()}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                + Add Card Type
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingType ? 'Edit Card Type' : 'Add New Card Type'}
            </h2>

            {message && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {message.text}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    disabled={!!editingType}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 disabled:bg-gray-100"
                    placeholder="VISA"
                  />
                  {editingType && (
                    <p className="mt-1 text-xs text-gray-500">Code cannot be changed</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                    placeholder="VISA"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Card Number Prefix(es) *
                </label>
                <input
                  type="text"
                  value={formData.cardNumberPrefix}
                  onChange={(e) => setFormData({ ...formData, cardNumberPrefix: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 font-mono"
                  placeholder="4 or 51,52,53,54,55"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Comma-separated prefixes (e.g., &quot;4&quot; for Visa, &quot;51,52,53,54,55&quot; for Mastercard)
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Card Number Length
                  </label>
                  <input
                    type="number"
                    min="13"
                    max="19"
                    value={formData.cardNumberLength}
                    onChange={(e) => setFormData({ ...formData, cardNumberLength: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CVV Length
                  </label>
                  <input
                    type="number"
                    min="3"
                    max="4"
                    value={formData.cvvLength}
                    onChange={(e) => setFormData({ ...formData, cvvLength: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isDebit}
                    onChange={(e) => setFormData({ ...formData, isDebit: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Debit Card</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Active</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCloseModal}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.code || !formData.name || !formData.cardNumberPrefix}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingType ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
