import type { Metadata } from 'next';
import Link from 'next/link';
import AuthNav from '@/components/AuthNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Trip Planner',
  description: 'AI-powered trip planning with personalized activities',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <nav className="bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white px-6 py-4 shadow-lg">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-xl font-bold tracking-tight hover:text-blue-100 transition-colors">
              ✈️ Trip Planner
            </Link>
            <div className="flex gap-4 text-sm">
              <Link href="/" className="hover:text-blue-200 transition-colors">My Trips</Link>
            </div>
            <AuthNav />
          </div>
        </nav>
        <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
          {children}
        </main>
      </body>
    </html>
  );
}
