import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { InviteActions } from './InviteActions';
import { CreateInviteForm } from './CreateInviteForm';

// Disable static generation - this page requires database access
export const dynamic = 'force-dynamic';

async function getInvites() {
  return prisma.adminInvite.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      usedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });
}

function getInviteStatus(invite: {
  usedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}) {
  if (invite.usedAt) return { status: 'used', color: 'bg-green-100 text-green-800' };
  if (invite.revokedAt) return { status: 'revoked', color: 'bg-gray-100 text-gray-800' };
  if (new Date() > invite.expiresAt) return { status: 'expired', color: 'bg-yellow-100 text-yellow-800' };
  return { status: 'pending', color: 'bg-blue-100 text-blue-800' };
}

export default async function InvitesPage() {
  const admin = await getCurrentAdmin();

  // Only Super Admins can access this page
  if (!admin || admin.role !== 'SUPER_ADMIN') {
    redirect('/admins');
  }

  const invites = await getInvites();
  const pendingCount = invites.filter(
    (i) => !i.usedAt && !i.revokedAt && new Date() <= i.expiresAt
  ).length;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href="/admins" className="text-indigo-600 hover:text-indigo-900 text-sm mb-2 inline-block">
            &larr; Back to Admins
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Admin Invites</h1>
          <p className="text-gray-500 mt-1">
            {pendingCount} pending invite{pendingCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Create Invite Form */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Invite</h2>
        <CreateInviteForm />
      </div>

      {/* Invites List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created By
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expires
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invites.map((invite) => {
              const { status, color } = getInviteStatus(invite);
              return (
                <tr key={invite.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {invite.code}
                    </code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {invite.email || <span className="text-gray-400">Any email</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      invite.role === 'SUPER_ADMIN'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {invite.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${color}`}>
                      {status}
                    </span>
                    {invite.usedBy && (
                      <span className="ml-2 text-xs text-gray-500">
                        by {invite.usedBy.firstName} {invite.usedBy.lastName}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {invite.createdBy.firstName} {invite.createdBy.lastName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(invite.expiresAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <InviteActions
                      inviteId={invite.id}
                      code={invite.code}
                      status={status}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {invites.length === 0 && (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No invites</h3>
            <p className="mt-1 text-sm text-gray-500">
              Create an invite above to add a new admin.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
