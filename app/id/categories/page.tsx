import type { Metadata } from "next"
import IdCategoriesPageClient from "./IdCategoriesPageClient"

export const metadata: Metadata = {
  title: "Kategori Berita",
  description: "Jelajahi berita terkini dari qbitznews.com berdasarkan kategori — teknologi, kripto, ekonomi, politik, dan lebih banyak lagi.",
  alternates: {
    canonical: "/id/categories",
  },
  openGraph: {
    title: "Kategori Berita",
    description: "Jelajahi berita terkini dari qbitznews.com berdasarkan kategori — teknologi, kripto, ekonomi, politik, dan lebih banyak lagi.",
    url: "/id/categories",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kategori Berita",
    description: "Jelajahi berita terkini dari qbitznews.com berdasarkan kategori — teknologi, kripto, ekonomi, politik, dan lebih banyak lagi.",
  },
}

export default function IdCategoriesPage() {
  return <IdCategoriesPageClient />
}
