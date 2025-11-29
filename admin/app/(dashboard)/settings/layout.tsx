// Force dynamic rendering to prevent static export errors
export const dynamic = 'force-dynamic';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
