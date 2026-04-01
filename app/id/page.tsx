import type { Metadata } from "next"
import IdHomePageClient from "./IdHomePageClient"
import * as db from "@/lib/db"

export const metadata: Metadata = {
  title: "Platform Berita Bertenaga AI",
  description: "Tetap update dengan berita Indonesia dan dunia yang dikurasi AI — analisis real-time, topik terkini, dan artikel berkategori otomatis dari Qbitz.",
  alternates: {
    canonical: "/id",
    languages: {
      "en": "/",
      "id": "/id",
    },
  },
  openGraph: {
    title: "Qbitz — Berita Terkini Bertenaga AI",
    description: "Tetap update dengan berita Indonesia dan dunia yang dikurasi AI dari Qbitz.",
    url: "/id",
    type: "website",
    locale: "id_ID",
  },
}

export default async function IdHomePage() {
  const [{ articles, pagination }, categories, trending] = await Promise.all([
    db.getRecentArticlesPaginated({ page: 1, limit: 20, language: "id" }),
    db.getAllCategories("id"),
    db.getTrendingArticles(6, "id"),
  ])

  return (
    <IdHomePageClient
      initialArticles={articles as any}
      initialCategories={categories}
      initialTrending={trending as any}
      initialHasMore={pagination.hasMore}
      initialTotal={pagination.total}
    />
  )
}
