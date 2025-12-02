'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CreatedInvite {
  code: string;
  email: string | null;
  role: string;
  expiresAt: string;
}

export function CreateInviteForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    role: 'ADMIN',
    expiresInDays: '7',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdInvite, setCreatedInvite] = useState<CreatedInvite | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setCreatedInvite(null);

    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email || undefined,
          role: formData.role,
          expiresInDays: parseInt(formData.expiresInDays),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create invite');
      }

      setCreatedInvite(data.invite);
      setFormData({ email: '', role: 'ADMIN', expiresInDays: '7' });
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to create invite');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!createdInvite) return;
    const baseUrl = window.location.origin;
    const inviteUrl = `${baseUrl}/invite?code=${createdInvite.code}`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      {createdInvite && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-green-800 font-semibold mb-2">Invite Created!</h3>
          <div className="flex items-center space-x-4">
            <code className="text-lg font-mono bg-white px-3 py-2 rounded border">
              {createdInvite.code}
            </code>
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy Invite Link'}
            </button>
          </div>
          <p className="text-sm text-green-700 mt-2">
            Share this link or code with the new admin. Expires on{' '}
            {new Date(createdInvite.expiresAt).toLocaleDateString()}.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email (optional)
          </label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="admin@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="text-xs text-gray-500 mt-1">Leave blank to allow any email</p>
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <select
            id="role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="ADMIN">Admin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
        </div>

        <div>
          <label htmlFor="expiresInDays" className="block text-sm font-medium text-gray-700 mb-1">
            Expires In
          </label>
          <select
            id="expiresInDays"
            value={formData.expiresInDays}
            onChange={(e) => setFormData({ ...formData, expiresInDays: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="1">1 day</option>
            <option value="3">3 days</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Invite'}
          </button>
        </div>
      </form>
    </div>
  );
}
