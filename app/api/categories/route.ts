import { NextResponse } from "next/server"
import { getAllCategories } from "@/lib/db"

export async function GET() {
  try {
    const categories = await getAllCategories()
    return NextResponse.json({ categories })
  } catch (error) {
    console.error("Failed to fetch categories:", error)
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 })
  }
}
