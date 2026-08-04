import './globals.css';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RankRentOS — Discovery',
  description: 'Rank & Rent market discovery and Batch 1 selection',
};

const NAV = [
  ['/', 'Dashboard'],
  ['/discovery', 'Run Discovery'],
  ['/progress', 'Progress'],
  ['/candidates', 'Candidates'],
  ['/opportunities', 'Opportunities'],
  ['/batch1', 'Batch 1'],
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-edge bg-panel/60 backdrop-blur sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
              <span className="font-semibold text-brand">RankRentOS</span>
              <nav className="flex gap-1 text-sm">
                {NAV.map(([href, label]) => (
                  <Link key={href} href={href} className="px-3 py-1.5 rounded-lg hover:bg-edge/60 text-slate-300">
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
