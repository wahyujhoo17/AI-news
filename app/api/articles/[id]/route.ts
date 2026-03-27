import { NextResponse, NextRequest } from "next/server"
import { pool, getArticleById, getArticleBySlug } from "@/lib/db"
import { extractArticleRouteParts } from "@/lib/article-slug"

export async function GET(request: NextRequest) {
  try {
    const pathParts = request.nextUrl.pathname.split("/").filter(Boolean)
    const idParam = pathParts[pathParts.length - 1] || ""
    const { articleId } = extractArticleRouteParts(idParam)
    let article

    if (articleId !== null) {
      const id = parseInt(String(articleId), 10)
      article = await getArticleById(id)
    } else {
      article = await getArticleBySlug(idParam)
    }

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 })
    }

    await pool.query("UPDATE articles SET views = views + 1 WHERE id = $1", [article.id])
    return NextResponse.json({ article })
  } catch (error) {
    console.error("Failed to fetch article:", error)
    return NextResponse.json({ error: "Failed to fetch article" }, { status: 500 })
  }
}
