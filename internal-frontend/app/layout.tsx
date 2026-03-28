import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'InternAL - Internship Management Platform',
  description: 'A platform connecting Universities, Students, and Companies for managing internship opportunities.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <main className="min-h-screen bg-slate-50">
          {children}
        </main>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
