import type { Metadata } from 'next'
import './globals.css'

const siteUrl = 'https://qbitznews.com'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: 'Qbitznews',
  title: {
    default: 'Qbitz - AI-Powered News Platform',
    template: '%s | Qbitz',
  },
  description: 'Revolutionary news platform powered by AI. Real-time analysis, automatic categorization, and original content from global sources.',
  keywords: ['news', 'ai', 'artificial intelligence', 'qbitz', 'technology'],
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  verification: {
    google: 'dNCIakI3iJz8B_1851j9qYbc4oxyIn_b9Jl5Fx27nIU',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'icon', url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { rel: 'icon', url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'Qbitz - AI-Powered News Platform',
    description: 'Revolutionary news platform powered by AI. Real-time analysis, automatic categorization, and original content from global sources.',
    url: siteUrl,
    type: 'website',
    locale: 'en_US',
    siteName: 'Qbitz',
    images: [
      {
        url: '/img/qbitznew.png',
        width: 512,
        height: 512,
        alt: 'Qbitz Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Qbitz - AI-Powered News Platform',
    description: 'Revolutionary news platform powered by AI',
    images: ['/img/qbitznew.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" className="scroll-smooth">
      <head>
        <meta name="google-adsense-account" content="ca-pub-5926049453295619" />
        <meta name="monetag" content="b6acb39d1815c899fc652ab123219fd8" />
        <script src="https://quge5.com/88/tag.min.js" data-zone="225633" async data-cfasync="false" />
        {/* Monetag In-Page Push — zone 10818984 */}
        <script dangerouslySetInnerHTML={{ __html: `(function(s){s.dataset.zone='10818984',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))` }} />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5926049453295619"
          crossOrigin="anonymous"
        />
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700;900&display=swap');
          
          html {
            font-family: 'Inter', sans-serif;
          }
          
          code, pre {
            font-family: 'JetBrains Mono', monospace;
          }
          
          /* Smooth scrollbar */
          ::-webkit-scrollbar {
            width: 8px;
          }
          
          ::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.1);
          }
          
          ::-webkit-scrollbar-thumb {
            background: rgba(34, 211, 238, 0.3);
            border-radius: 4px;
          }
          
          ::-webkit-scrollbar-thumb:hover {
            background: rgba(34, 211, 238, 0.5);
          }
        `}</style>
      </head>
      <body className="bg-black text-white antialiased">
        {children}
      </body>
    </html>
  )
}

