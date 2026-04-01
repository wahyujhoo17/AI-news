import type { Metadata } from "next"
import HomePageClient from "./HomePageClient"
import * as db from "@/lib/db"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "AI-Powered News Platform",
  description: "Stay updated with AI-powered global news coverage, real-time analysis, and automatically categorized stories from Qbitz.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Qbitz - AI-Powered News Platform",
    description: "Stay updated with AI-powered global news coverage, real-time analysis, and automatically categorized stories from Qbitz.",
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Qbitz - AI-Powered News Platform",
    description: "Stay updated with AI-powered global news coverage, real-time analysis, and automatically categorized stories from Qbitz.",
  },
}

export default async function HomePage() {
  const [{ articles, pagination }, categories, trending] = await Promise.all([
    db.getRecentArticlesPaginated({ page: 1, limit: 20, language: "en" }),
    db.getAllCategories("en"),
    db.getTrendingArticles(6, "en"),
  ])

  return (
    <HomePageClient
      language="en"
      prefix=""
      initialArticles={articles as any}
      initialCategories={categories}
      initialTrending={trending as any}
      initialHasMore={pagination.hasMore}
      initialTotal={pagination.total}
    />
  )
}
