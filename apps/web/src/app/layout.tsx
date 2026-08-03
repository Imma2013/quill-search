import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Quill — Evidence-first AI search',
  description: 'Newsletter-style answers with source-verifiable quotations.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
