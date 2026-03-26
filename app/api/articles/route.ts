import { NextResponse } from "next/server"
import * as db from "@/lib/db"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "12")
    const category = searchParams.get("category") || undefined
    const offset = (page - 1) * limit

    // Fetch more articles than needed to ensure we have data for pagination
    const articles = await db.getRecentArticles(limit + 100, category)
    const categories = await db.getAllCategories()

    // Manual pagination
    const paginatedArticles = articles.slice(offset, offset + limit)
    const total = articles.length
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      articles: paginatedArticles,
      categories,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    })
  } catch (error) {
    console.error("Failed to fetch articles:", error)
    return NextResponse.json({ error: "Failed to fetch articles" }, { status: 500 })
  }
}
