'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface InviteActionsProps {
  inviteId: string;
  code: string;
  status: string;
}

export function InviteActions({ inviteId, code, status }: InviteActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    const baseUrl = window.location.origin;
    const inviteUrl = `${baseUrl}/invite?code=${code}`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async () => {
    if (!confirm('Are you sure you want to revoke this invite?')) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/invites/${inviteId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to revoke invite');
      }

      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      {status === 'pending' && (
        <>
          <button
            onClick={handleCopyLink}
            className="text-indigo-600 hover:text-indigo-900 text-sm"
            title="Copy invite link"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={handleCopyCode}
            className="text-gray-600 hover:text-gray-900 text-sm"
            title="Copy code only"
          >
            Copy Code
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={handleRevoke}
            disabled={loading}
            className="text-red-600 hover:text-red-900 text-sm disabled:opacity-50"
          >
            {loading ? 'Revoking...' : 'Revoke'}
          </button>
        </>
      )}
      {status === 'used' && (
        <span className="text-gray-400 text-sm">-</span>
      )}
      {(status === 'expired' || status === 'revoked') && (
        <span className="text-gray-400 text-sm">-</span>
      )}
    </div>
  );
}
