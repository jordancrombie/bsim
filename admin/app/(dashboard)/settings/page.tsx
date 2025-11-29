'use client';

import { useState, useEffect, useRef } from 'react';
/* eslint-disable @next/next/no-img-element */

interface SiteSettings {
  logoUrl: string | null;
  siteName: string;
  storageType?: 'local' | 's3';
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [siteName, setSiteName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setSiteName(data.siteName || 'BSIM');
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSiteName = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteName }),
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setMessage({ type: 'success', text: 'Site name updated successfully!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to update site name' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update site name' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image must be less than 5MB' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('logo', file);

      const response = await fetch('/api/settings/logo', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(prev => prev ? { ...prev, logoUrl: data.logoUrl } : null);
        setMessage({ type: 'success', text: 'Logo uploaded successfully!' });
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to upload logo' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to upload logo' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!confirm('Are you sure you want to remove the logo?')) return;

    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/settings/logo', {
        method: 'DELETE',
      });

      if (response.ok) {
        setSettings(prev => prev ? { ...prev, logoUrl: null } : null);
        setMessage({ type: 'success', text: 'Logo removed successfully!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to remove logo' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to remove logo' });
    } finally {
      setSaving(false);
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
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Site Settings</h1>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Logo Settings */}
      <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Logo</h2>
          <p className="mt-1 text-sm text-gray-500">
            This logo is displayed on the user login page.
          </p>
        </div>
        <div className="px-6 py-4">
          <div className="flex items-start space-x-6">
            {/* Current Logo Preview */}
            <div className="flex-shrink-0">
              <div className="w-40 h-40 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
                {settings?.logoUrl ? (
                  <img
                    src={settings.logoUrl}
                    alt="Site Logo"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center text-gray-400">
                    <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="mt-1 text-xs">No logo</p>
                  </div>
                )}
              </div>
            </div>

            {/* Upload Controls */}
            <div className="flex-1">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload new logo
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-indigo-50 file:text-indigo-700
                      hover:file:bg-indigo-100
                      disabled:opacity-50"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    PNG, JPG or GIF up to 5MB. Recommended: 200x200px or larger, square aspect ratio.
                  </p>
                </div>

                {settings?.logoUrl && (
                  <button
                    onClick={handleRemoveLogo}
                    disabled={saving}
                    className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    Remove current logo
                  </button>
                )}

                {uploading && (
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="animate-spin h-4 w-4 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Storage Info */}
      <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Storage</h2>
          <p className="mt-1 text-sm text-gray-500">
            Where uploaded files are stored.
          </p>
        </div>
        <div className="px-6 py-4">
          <div className="flex items-center space-x-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              settings?.storageType === 's3'
                ? 'bg-green-100 text-green-800'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {settings?.storageType === 's3' ? (
                <>
                  <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.5 17a4.5 4.5 0 01-1.44-8.765 4 4 0 117.78-1.47A4.5 4.5 0 0115.5 17H5.5z" clipRule="evenodd" />
                  </svg>
                  Amazon S3
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm11 1H6v8l4-2 4 2V6z" clipRule="evenodd" />
                  </svg>
                  Local Storage
                </>
              )}
            </span>
            <span className="text-sm text-gray-500">
              {settings?.storageType === 's3'
                ? 'Files are stored in Amazon S3 for durability and scalability.'
                : 'Files are stored on the local filesystem. Configure S3 for production.'}
            </span>
          </div>
        </div>
      </div>

      {/* Site Name Settings */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Site Name</h2>
          <p className="mt-1 text-sm text-gray-500">
            The name displayed to users throughout the application.
          </p>
        </div>
        <div className="px-6 py-4">
          <div className="max-w-md">
            <label htmlFor="siteName" className="block text-sm font-medium text-gray-700 mb-2">
              Site Name
            </label>
            <div className="flex space-x-3">
              <input
                type="text"
                id="siteName"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                placeholder="BSIM"
              />
              <button
                onClick={handleSaveSiteName}
                disabled={saving || siteName === settings?.siteName}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
