import { Pool } from "pg"

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432"),
  database: process.env.PGDATABASE || "ai_news_db",
  user: process.env.PGUSER || "ai_news_user",
  password: process.env.PGPASSWORD || "StrongPass123!",
})

export type Article = {
  id: number
  title: string
  content: string
  source_url: string | null
  source_name: string
  category: string | null
  published_at: string | null
  created_at: string
  is_published: boolean
  ai_model: string | null
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  estimated_cost: number | null
  featured_image?: string | null
  excerpt?: string | null
  author?: string | null
  views?: number
}

export type Category = {
  id: number
  name: string
  slug: string
  description?: string
  color?: string
  created_at: string
}

export async function getRecentArticles(limit = 20, categorySlug?: string) {
  let query = `
    SELECT a.*, string_agg(c.name, ', ') as categories
    FROM articles a
    LEFT JOIN article_categories ac ON a.id = ac.article_id
    LEFT JOIN categories c ON ac.category_id = c.id
    WHERE a.is_published = true
  `
  const params: any[] = [limit]
  if (categorySlug) {
    query += ` AND c.slug = $${params.length + 1} `
    params.push(categorySlug)
  }
  query += ` GROUP BY a.id ORDER BY a.published_at DESC, a.created_at DESC LIMIT $1`
  const result = await pool.query<Article & { categories?: string }>(query, params)
  return result.rows
}

export async function getArticleById(id: number) {
  const result = await pool.query<Article>(
    `SELECT * FROM articles WHERE id = $1 AND is_published = true`,
    [id]
  )
  return result.rows[0]
}

export async function getAllCategories() {
  const result = await pool.query<Category>("SELECT * FROM categories ORDER BY name")
  return result.rows
}

export async function getCategoryBySlug(slug: string) {
  const result = await pool.query<Category>("SELECT * FROM categories WHERE slug = $1", [slug])
  return result.rows[0]
}

export async function upsertCategory(name: string, slug: string, description?: string, color?: string) {
  const result = await pool.query(
    `INSERT INTO categories (name, slug, description, color) 
     VALUES ($1, $2, $3, $4) 
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color 
     RETURNING *`,
    [name, slug, description || null, color || "#3B82F6"]
  )
  return result.rows[0]
}

export async function assignCategoryToArticle(articleId: number, categoryId: number) {
  await pool.query(
    `INSERT INTO article_categories (article_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [articleId, categoryId]
  )
}

export async function getAllSources() {
  const result = await pool.query("SELECT * FROM sources WHERE is_active = true ORDER BY name")
  return result.rows
}

export async function saveArticle(article: Partial<Article>) {
  const result = await pool.query(
    `INSERT INTO articles 
     (title, content, source_url, source_name, category, published_at, is_published, ai_model, prompt_tokens, completion_tokens, total_tokens, estimated_cost, featured_image, excerpt, author, views) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
     RETURNING *`,
    [
      article.title,
      article.content,
      article.source_url,
      article.source_name,
      article.category || null,
      article.published_at,
      article.is_published || false,
      article.ai_model || null,
      article.prompt_tokens || null,
      article.completion_tokens || null,
      article.total_tokens || null,
      article.estimated_cost || null,
      article.featured_image || null,
      article.excerpt || null,
      article.author || null,
      article.views || 0,
    ]
  )
  return result.rows[0]
}

export async function logCrawl(
  sourceId: number | null,
  status: string,
  error?: string,
  articlesGenerated?: number
) {
  const result = await pool.query(
    `INSERT INTO crawl_logs (source_id, status, error_message, articles_generated) 
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [sourceId, status, error || null, articlesGenerated || 0]
  )
  return result.rows[0]
}

export default pool
