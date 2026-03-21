import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Trip Planner',
  description: 'AI-powered trip planning with personalized proposals',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <nav className="bg-blue-600 text-white px-6 py-4 shadow-md">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <a href="/" className="text-xl font-bold tracking-tight hover:text-blue-100 transition-colors">
              ✈️ Trip Planner
            </a>
            <div className="flex gap-4 text-sm">
              <a href="/" className="hover:text-blue-200 transition-colors">My Trips</a>
            </div>
          </div>
        </nav>
        <main className="min-h-screen bg-gray-50">
          {children}
        </main>
      </body>
    </html>
  );
}
