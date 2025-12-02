import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';

// Disable static generation - this page requires database access
export const dynamic = 'force-dynamic';

async function getAdminUser(id: string) {
  return prisma.adminUser.findUnique({
    where: { id },
    include: {
      passkeys: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await getAdminUser(id);

  if (!admin) {
    notFound();
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admins"
          className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
        >
          &larr; Back to Admin Users
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0 h-16 w-16">
              <div className="h-16 w-16 rounded-full bg-gray-800 flex items-center justify-center">
                <span className="text-white font-bold text-xl">
                  {admin.firstName[0]}{admin.lastName[0]}
                </span>
              </div>
            </div>
            <div className="ml-6">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">
                  {admin.firstName} {admin.lastName}
                </h1>
                <span className={`ml-3 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  admin.role === 'SUPER_ADMIN'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {admin.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
                </span>
              </div>
              <p className="text-sm text-gray-500">{admin.email}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50">
          <dl className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Admin ID</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">{admin.id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Role</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {admin.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(admin.createdAt).toLocaleDateString()} at{' '}
                {new Date(admin.createdAt).toLocaleTimeString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(admin.updatedAt).toLocaleDateString()} at{' '}
                {new Date(admin.updatedAt).toLocaleTimeString()}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Passkeys */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Passkeys ({admin.passkeys.length})
          </h2>
        </div>
        {admin.passkeys.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Credential ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Device Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Backed Up
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Last Used
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {admin.passkeys.map((passkey) => (
                <tr key={passkey.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {passkey.credentialId.slice(0, 16)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {passkey.deviceType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        passkey.backedUp
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {passkey.backedUp ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(passkey.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {passkey.lastUsedAt
                      ? new Date(passkey.lastUsedAt).toLocaleDateString()
                      : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-8 text-center text-gray-500">
            No passkeys registered
          </div>
        )}
      </div>
    </div>
  );
}
