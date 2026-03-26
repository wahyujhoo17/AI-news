const { pool } = require("./lib/db-worker")

const categories = [
  { name: "Teknologi", slug: "teknologi", description: "Berita teknologi dan digital", color: "#3B82F6" },
  { name: "Bisnis", slug: "bisnis", description: "Berita bisnis dan ekonomi", color: "#10B981" },
  { name: "Olahraga", slug: "olahraga", description: "Berita olahraga", color: "#F59E0B" },
  { name: "Kesehatan", slug: "kesehatan", description: "Berita kesehatan", color: "#EF4444" },
  { name: "Hiburan", slug: "hiburan", description: "Berita hiburan dan budaya", color: "#8B5CF6" },
  { name: "Politik", slug: "politik", description: "Berita politik", color: "#6366F1" },
  { name: "Otomotif", slug: "otomotif", description: "Berita otomotif", color: "#EC4899" },
]

async function seed() {
  for (const cat of categories) {
    await pool.query(
      `INSERT INTO categories (name, slug, description, color) 
       VALUES ($1, $2, $3, $4) ON CONFLICT (slug) DO NOTHING`,
      [cat.name, cat.slug, cat.description, cat.color]
    )
    console.log(`Seeded: ${cat.name}`)
  }
  process.exit(0)
}

seed().catch(console.error)
