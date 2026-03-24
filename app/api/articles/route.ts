import { NextResponse } from "next/server"
import * as db from "@/lib/db"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "20")
    const category = searchParams.get("category") || undefined
    const articles = await db.getRecentArticles(limit, category)
    const categories = await db.getAllCategories()
    return NextResponse.json({ articles, categories })
  } catch (error) {
    console.error("Failed to fetch articles:", error)
    return NextResponse.json({ error: "Failed to fetch articles" }, { status: 500 })
  }
}
