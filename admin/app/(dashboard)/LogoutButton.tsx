'use client';

import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white"
    >
      Sign Out
    </button>
  );
}
