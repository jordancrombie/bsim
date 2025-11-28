import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BSIM - Banking Simulator",
  description: "A full-stack banking simulator with authentication and transaction management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.Node;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
