import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BSIM Admin",
  description: "BSIM Banking Simulator - Admin Interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-100 min-h-screen">
        <nav className="bg-gray-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <span className="text-xl font-bold">BSIM Admin</span>
              </div>
              <div className="flex items-center space-x-4">
                <a href="/" className="hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium">
                  Dashboard
                </a>
                <a href="/users" className="hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium">
                  Users
                </a>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
