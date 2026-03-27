import type { Metadata } from "next"
import CategoriesPageClient from "./CategoriesPageClient"

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse Qbitz news by category and explore AI-curated stories across technology, business, sports, and more.",
  alternates: {
    canonical: "/categories",
  },
  openGraph: {
    title: "Categories",
    description: "Browse Qbitz news by category and explore AI-curated stories across technology, business, sports, and more.",
    url: "/categories",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Categories",
    description: "Browse Qbitz news by category and explore AI-curated stories across technology, business, sports, and more.",
  },
}

export default function CategoriesPage() {
  return <CategoriesPageClient />
}
