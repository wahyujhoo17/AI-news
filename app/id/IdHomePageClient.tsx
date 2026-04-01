"use client"

import HomePageClient from "@/app/HomePageClient"

interface Article {
  id: number
  title: string
  content: string
  source_name: string
  source_url: string
  published_at: string | null
  created_at: string
  excerpt?: string
  views?: number
  categories?: string
  featured_image?: string
}

interface Category {
  id: number
  name: string
  slug: string
  color?: string
  article_count?: number
}

interface Props {
  initialArticles?: Article[]
  initialCategories?: Category[]
  initialTrending?: Article[]
  initialHasMore?: boolean
  initialTotal?: number
}

export default function IdHomePageClient(props: Props) {
  return <HomePageClient language="id" prefix="/id" {...props} />
}
