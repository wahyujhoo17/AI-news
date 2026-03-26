import './globals.css'

export const metadata = {
  title: "Qbitz - AI-Powered News Platform",
  description: "Revolutionary news platform powered by AI. Real-time analysis, automatic categorization, and original content from global sources.",
  keywords: ["news", "ai", "artificial intelligence", "qbitz", "technology"],
  openGraph: {
    title: "Qbitz - AI-Powered News",
    description: "News powered by artificial intelligence",
    type: "website",
    locale: "en_US",
    siteName: "Qbitz",
  },
  twitter: {
    card: "summary_large_image",
    title: "Qbitz",
    description: "AI-powered news platform for the digital era",
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

