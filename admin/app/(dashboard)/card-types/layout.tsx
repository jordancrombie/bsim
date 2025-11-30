// Force dynamic rendering to prevent static generation during build
export const dynamic = 'force-dynamic';

export default function CardTypesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
