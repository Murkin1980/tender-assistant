import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Tender Assistant',
  description: 'Tender Assistant development environment',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
