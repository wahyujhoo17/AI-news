import { NextResponse, NextRequest } from "next/server"
import pool from "@/lib/db.js"
import { getArticleById } from "@/lib/db.js"

export async function GET(request: NextRequest) {
  try {
    const id = parseInt(request.nextUrl.pathname.split("/").pop() || "0")
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid article ID" }, { status: 400 })
    }
    const article = await getArticleById(id)
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 })
    }
    await pool.query("UPDATE articles SET views = views + 1 WHERE id = $1", [id])
    return NextResponse.json({ article })
  } catch (error) {
    console.error("Failed to fetch article:", error)
    return NextResponse.json({ error: "Failed to fetch article" }, { status: 500 })
  }
}
