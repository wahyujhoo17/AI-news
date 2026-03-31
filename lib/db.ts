import { Pool } from "pg"
import { extractArticleRouteParts, normalizeArticleSlug } from "@/lib/article-slug"

export const pool = new Pool({
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
  categories?: string
}

export type ArticleListItem = {
  id: number
  title: string
  excerpt?: string | null
  content?: string
  source_name: string
  source_url: string | null
  published_at: string | null
  created_at: string
  featured_image?: string | null
  views?: number
  categories?: string
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

export async function getRecentArticlesPaginated(options?: {
  page?: number
  limit?: number
  categorySlug?: string
  search?: string
}) {
  const requestedPage = Math.max(1, options?.page || 1)
  const limit = Math.min(100, Math.max(1, options?.limit || 12))
  const categorySlug = options?.categorySlug
  const search = (options?.search || "").trim().toLowerCase()

  const where: string[] = ["a.is_published = true"]
  const params: any[] = []

  if (categorySlug) {
    params.push(categorySlug)
    where.push(`c.slug = $${params.length}`)
  }

  if (search) {
    params.push(`%${search}%`)
    where.push(`(LOWER(a.title) LIKE $${params.length} OR LOWER(COALESCE(a.excerpt, '')) LIKE $${params.length})`)
  }

  const whereClause = `WHERE ${where.join(" AND ")}`

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(DISTINCT a.id) AS total
     FROM articles a
     LEFT JOIN article_categories ac ON a.id = ac.article_id
     LEFT JOIN categories c ON ac.category_id = c.id
     ${whereClause}`,
    params
  )

  const total = parseInt(countResult.rows[0]?.total || "0", 10)
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const page = Math.min(requestedPage, totalPages)
  const offset = (page - 1) * limit

  const listParams = [...params, limit, offset]
  const listResult = await pool.query<ArticleListItem>(
    `SELECT
       a.id,
       a.title,
       a.excerpt,
       LEFT(COALESCE(a.content, ''), 220) AS content,
       a.source_name,
       a.source_url,
       a.published_at,
       a.created_at,
       a.featured_image,
       a.views,
       string_agg(DISTINCT c.name, ', ') AS categories
     FROM articles a
     LEFT JOIN article_categories ac ON a.id = ac.article_id
     LEFT JOIN categories c ON ac.category_id = c.id
     ${whereClause}
     GROUP BY a.id
     ORDER BY a.published_at DESC, a.created_at DESC
     LIMIT $${listParams.length - 1}
     OFFSET $${listParams.length}`,
    listParams
  )

  return {
    articles: listResult.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  }
}

export async function getArticleById(id: number) {
  const result = await pool.query<Article>(
    `SELECT * FROM articles WHERE id = $1 AND is_published = true`,
    [id]
  )
  return result.rows[0]
}

export async function getArticleBySlug(slug: string) {
  const { articleId, slug: normalizedSlug } = extractArticleRouteParts(slug)

  if (articleId !== null) {
    const articleById = await getArticleById(articleId)
    if (articleById) {
      return articleById
    }
  }

  if (!normalizedSlug) {
    return undefined
  }

  // Exact match: normalize title the same way as JS (also strip leading/trailing hyphens)
  const result = await pool.query<Article>(
    `SELECT * FROM articles WHERE is_published = true
     AND trim(both '-' from lower(regexp_replace(trim(title), '[^a-z0-9]+', '-', 'g'))) = $1
     LIMIT 1`,
    [normalizedSlug]
  )

  if (result.rows.length > 0) {
    return result.rows[0]
  }

  // Fuzzy match: compare only alphanumeric chars, ignoring all separators.
  // Handles legacy URLs where apostrophes/special chars produced different hyphens
  // e.g. "Kennedy Center's" → "kennedycenters" matches slug "kennedy-centers"
  const alphanumSlug = normalizedSlug.replace(/-/g, "")
  if (alphanumSlug.length >= 10) {
    const fuzzy = await pool.query<Article>(
      `SELECT * FROM articles WHERE is_published = true
       AND lower(regexp_replace(title, '[^a-z0-9]', '', 'gi')) = $1
       LIMIT 1`,
      [alphanumSlug]
    )
    if (fuzzy.rows.length > 0) {
      return fuzzy.rows[0]
    }
  }

  // Final fallback: JS-side comparison over recent articles
  // LIMIT 500 most recent to avoid loading entire table into memory
  const fallback = await pool.query<Article>(
    `SELECT * FROM articles WHERE is_published = true ORDER BY created_at DESC LIMIT 500`
  )
  return fallback.rows.find((article) => {
    const articleSlug = normalizeArticleSlug(article.title || "")
    // Also try alphanumeric-only comparison for legacy slugs
    return articleSlug === normalizedSlug ||
      articleSlug.replace(/-/g, "") === alphanumSlug
  })
}

export async function getAllCategories() {
  const result = await pool.query<Category & { article_count?: number }>(
    `SELECT c.*, COUNT(DISTINCT ac.article_id)::int AS article_count
     FROM categories c
     LEFT JOIN article_categories ac ON c.id = ac.category_id
     LEFT JOIN articles a ON ac.article_id = a.id AND a.is_published = true
     GROUP BY c.id
     ORDER BY COUNT(DISTINCT ac.article_id) DESC, c.name`
  )
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
