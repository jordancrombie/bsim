import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';

// Disable static generation - this page requires database access
export const dynamic = 'force-dynamic';

async function getUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      accounts: {
        include: {
          _count: {
            select: { transactions: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      creditCards: {
        include: {
          _count: {
            select: { transactions: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      passkeys: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser(id);

  if (!user) {
    notFound();
  }

  const totalBalance = user.accounts.reduce(
    (sum, acc) => sum + Number(acc.balance),
    0
  );

  const totalCreditLimit = user.creditCards.reduce(
    (sum, card) => sum + Number(card.creditLimit),
    0
  );

  const totalAvailableCredit = user.creditCards.reduce(
    (sum, card) => sum + Number(card.availableCredit),
    0
  );

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/users"
          className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
        >
          &larr; Back to Users
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0 h-16 w-16">
              <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-indigo-600 font-bold text-xl">
                  {user.firstName[0]}{user.lastName[0]}
                </span>
              </div>
            </div>
            <div className="ml-6">
              <h1 className="text-2xl font-bold text-gray-900">
                {user.firstName} {user.lastName}
              </h1>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50">
          <dl className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">User ID</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">{user.id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(user.createdAt).toLocaleDateString()} at{' '}
                {new Date(user.createdAt).toLocaleTimeString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(user.updatedAt).toLocaleDateString()} at{' '}
                {new Date(user.updatedAt).toLocaleTimeString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Total Balance</dt>
              <dd className="mt-1 text-sm text-gray-900 font-semibold">
                ${totalBalance.toFixed(2)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Customer Information File (CIF) */}
      <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Customer Information File (CIF)
          </h2>
        </div>
        <div className="px-6 py-4">
          <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <dt className="text-sm font-medium text-gray-500">Phone Number</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {user.phone || <span className="text-gray-400 italic">Not provided</span>}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Date of Birth</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {user.dateOfBirth ? (
                  new Date(user.dateOfBirth).toLocaleDateString('en-CA', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                ) : (
                  <span className="text-gray-400 italic">Not provided</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Country</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {user.country || <span className="text-gray-400 italic">Not provided</span>}
              </dd>
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <dt className="text-sm font-medium text-gray-500">Address</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {user.address || user.city || user.state || user.postalCode ? (
                  <div>
                    {user.address && <div>{user.address}</div>}
                    <div>
                      {[user.city, user.state, user.postalCode]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-400 italic">Not provided</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Bank Accounts */}
      <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Bank Accounts ({user.accounts.length})
          </h2>
        </div>
        {user.accounts.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Account Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Transactions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {user.accounts.map((account) => (
                <tr key={account.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {account.accountNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${Number(account.balance).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                      {account._count.transactions}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(account.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-8 text-center text-gray-500">
            No bank accounts
          </div>
        )}
      </div>

      {/* Credit Cards */}
      <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">
              Credit Cards ({user.creditCards.length})
            </h2>
            <div className="text-sm text-gray-500">
              Total Limit: ${totalCreditLimit.toFixed(2)} | Available: ${totalAvailableCredit.toFixed(2)}
            </div>
          </div>
        </div>
        {user.creditCards.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Card Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Holder
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Credit Limit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Available
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Expiry
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Transactions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {user.creditCards.map((card) => (
                <tr key={card.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    **** **** **** {card.cardNumber.slice(-4)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {card.cardHolder}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${Number(card.creditLimit).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${Number(card.availableCredit).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {String(card.expiryMonth).padStart(2, '0')}/{card.expiryYear}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                      {card._count.transactions}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-8 text-center text-gray-500">
            No credit cards
          </div>
        )}
      </div>

      {/* Passkeys */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Passkeys ({user.passkeys.length})
          </h2>
        </div>
        {user.passkeys.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
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
              {user.passkeys.map((passkey) => (
                <tr key={passkey.id}>
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
