import { NextResponse } from "next/server"
import * as db from "@/lib/db"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") || "6")))
    const language = searchParams.get("language") || "en"

    const articles = await db.getTrendingArticles(limit, language)
    return NextResponse.json({ articles })
  } catch (error) {
    console.error("Failed to fetch trending articles:", error)
    return NextResponse.json({ error: "Failed to fetch trending articles" }, { status: 500 })
  }
}
