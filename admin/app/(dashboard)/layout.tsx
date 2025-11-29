import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { LogoutButton } from './LogoutButton';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if setup is needed
  const adminCount = await prisma.adminUser.count();
  if (adminCount === 0) {
    redirect('/setup');
  }

  // Check authentication
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect('/login');
  }

  return (
    <>
      <nav className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-bold">
                BSIM Admin
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium"
              >
                Dashboard
              </Link>
              <Link
                href="/users"
                className="hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium"
              >
                Users
              </Link>
              <Link
                href="/admins"
                className="hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium"
              >
                Admins
              </Link>
              <Link
                href="/settings"
                className="hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium"
              >
                Settings
              </Link>
              <div className="border-l border-gray-700 h-6 mx-2"></div>
              <span className="text-sm text-gray-300">
                {admin.firstName} {admin.lastName}
              </span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </>
  );
}
