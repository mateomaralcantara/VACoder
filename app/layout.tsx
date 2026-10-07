import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'VACoder Agent OS',
  description:
    'App Factory con Dashboard, Studio, Runtime, scanner, orquestación durable y cloud runtime.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
