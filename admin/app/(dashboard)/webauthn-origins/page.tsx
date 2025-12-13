'use client';

import { useState, useEffect } from 'react';

interface WebAuthnOrigin {
  id: string;
  origin: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function WebAuthnOriginsPage() {
  const [origins, setOrigins] = useState<WebAuthnOrigin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingOrigin, setEditingOrigin] = useState<WebAuthnOrigin | null>(null);
  const [formData, setFormData] = useState({
    origin: '',
    description: '',
    isActive: true,
    sortOrder: 0,
  });

  useEffect(() => {
    fetchOrigins();
  }, []);

  const fetchOrigins = async () => {
    try {
      const response = await fetch('/api/webauthn-origins');
      if (response.ok) {
        const data = await response.json();
        setOrigins(data.origins);
      }
    } catch (error) {
      console.error('Failed to fetch WebAuthn origins:', error);
      setMessage({ type: 'error', text: 'Failed to load WebAuthn origins' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (origin?: WebAuthnOrigin) => {
    if (origin) {
      setEditingOrigin(origin);
      setFormData({
        origin: origin.origin,
        description: origin.description || '',
        isActive: origin.isActive,
        sortOrder: origin.sortOrder,
      });
    } else {
      setEditingOrigin(null);
      setFormData({
        origin: '',
        description: '',
        isActive: true,
        sortOrder: origins.length + 1,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingOrigin(null);
    setMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const url = editingOrigin
        ? `/api/webauthn-origins/${editingOrigin.id}`
        : '/api/webauthn-origins';
      const method = editingOrigin ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `Origin ${editingOrigin ? 'updated' : 'created'} successfully!` });
        await fetchOrigins();
        setTimeout(() => {
          handleCloseModal();
        }, 1000);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to save origin' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save origin' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (origin: WebAuthnOrigin) => {
    if (!confirm(`Are you sure you want to delete "${origin.origin}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/webauthn-origins/${origin.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Origin deleted successfully' });
        await fetchOrigins();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to delete origin' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete origin' });
    }
  };

  const handleToggleActive = async (origin: WebAuthnOrigin) => {
    try {
      const response = await fetch(`/api/webauthn-origins/${origin.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !origin.isActive }),
      });

      if (response.ok) {
        await fetchOrigins();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to update origin' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update origin' });
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
          <h1 className="text-3xl font-bold text-gray-900">WebAuthn Related Origins</h1>
          <p className="text-gray-600 mt-2">
            Manage origins allowed for cross-domain passkey authentication.
            These are served at <code className="bg-gray-100 px-1 rounded">/.well-known/webauthn</code>
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          + Add Origin
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
                Origin
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
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
            {origins.map((origin) => (
              <tr key={origin.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {origin.sortOrder}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-sm font-mono bg-gray-100 rounded text-gray-800">
                    {origin.origin}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                  {origin.description || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleToggleActive(origin)}
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer ${
                      origin.isActive
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {origin.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleOpenModal(origin)}
                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(origin)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {origins.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No WebAuthn origins</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by adding an origin for cross-domain passkey auth.</p>
            <div className="mt-6">
              <button
                onClick={() => handleOpenModal()}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                + Add Origin
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
              {editingOrigin ? 'Edit Origin' : 'Add New Origin'}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Origin URL *
                </label>
                <input
                  type="text"
                  value={formData.origin}
                  onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  placeholder="https://example.com"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Must be an HTTPS URL with no path (e.g., https://store.regalmoose.ca)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  placeholder="Optional description of this origin"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                <div className="flex items-end pb-2">
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
                disabled={saving || !formData.origin}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingOrigin ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
