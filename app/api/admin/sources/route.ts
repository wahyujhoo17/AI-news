import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/db"

const ADMIN_SECRET = process.env.ADMIN_SECRET || "secret123"

export async function GET() {
  try {
    const result = await pool.query("SELECT * FROM sources ORDER BY name")
    return NextResponse.json({ sources: result.rows })
  } catch (error) {
    console.error("Failed to fetch sources:", error)
    return NextResponse.json({ error: "Failed to fetch sources" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get("Authorization")
    if (auth !== `Bearer ${ADMIN_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, url, type = "rss", is_active = true } = body

    if (!name || !url) {
      return NextResponse.json({ error: "Name and URL are required" }, { status: 400 })
    }

    const result = await pool.query(
      "INSERT INTO sources (name, url, type, is_active) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, url, type, is_active]
    )

    return NextResponse.json({ source: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error("Failed to create source:", error)
    return NextResponse.json({ error: "Failed to create source" }, { status: 500 })
  }
}
