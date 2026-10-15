import type { Metadata, Viewport } from 'next';
import './globals.css'; // Global styles

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export const metadata: Metadata = {
  title: 'ATNotebook - Caderno Inteligente Baseado em Fontes',
  description: 'Ambiente factual para ingestão de fontes, migração íntegra do Gemini Notebook e respostas estritamente ancoradas em documentos, sem suposições.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/logo.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/logo.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'ATNotebook - Caderno Inteligente Baseado em Fontes',
    description: 'Ambiente factual para ingestão de fontes, migração íntegra do Gemini Notebook e respostas estritamente ancoradas em documentos, sem suposições.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ATNotebook - Caderno Inteligente Baseado em Fontes',
    description: 'Ambiente factual para ingestão de fontes, migração íntegra do Gemini Notebook e respostas estritamente ancoradas em documentos, sem suposições.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}


