import { NextResponse } from "next/server"
import * as db from "@/lib/db"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "12")
    const category = searchParams.get("category") || undefined
    const search = (searchParams.get("search") || "").trim()

    const { articles, pagination } = await db.getRecentArticlesPaginated({
      page,
      limit,
      categorySlug: category,
      search,
    })

    const categories = search ? [] : await db.getAllCategories()

    return NextResponse.json({
      articles,
      categories,
      pagination,
    })
  } catch (error) {
    console.error("Failed to fetch articles:", error)
    return NextResponse.json({ error: "Failed to fetch articles" }, { status: 500 })
  }
}
