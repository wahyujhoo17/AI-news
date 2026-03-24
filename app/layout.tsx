import "./globals.css"

export const metadata = {
  title: "AI News - Berita Dikelola oleh Kecerdasan Buatan",
  description: "AI News menyajikan berita terkini yang digenerate dan dikelola oleh artificial intelligence. Kategori: Teknologi, Bisnis, Olahraga, Kesehatan, dan lainnya.",
  keywords: ["berita", "ai", "artificial intelligence", "news", "teknologi"],
  openGraph: {
    title: "AI News",
    description: "Berita dikelola oleh AI",
    type: "website",
    locale: "id_ID",
    siteName: "AI News",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI News",
    description: "Berita dikelola oleh AI",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" className="scroll-smooth">
      <body className="bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 transition-colors">
        {children}
      </body>
    </html>
  )
}
