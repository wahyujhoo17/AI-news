const { Pool } = require("pg")

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432"),
  database: process.env.PGDATABASE || "ai_news_db",
  user: process.env.PGUSER || "ai_news_user",
  password: process.env.PGPASSWORD || "StrongPass123!",
})

async function getRecentArticles(limit = 20, categorySlug) {
  let query = `
    SELECT a.*, string_agg(c.name, ', ') as categories
    FROM articles a
    LEFT JOIN article_categories ac ON a.id = ac.article_id
    LEFT JOIN categories c ON ac.category_id = c.id
    WHERE a.is_published = true
  `
  const params = [limit]
  if (categorySlug) {
    query += ` AND c.slug = $${params.length + 1} `
    params.push(categorySlug)
  }
  query += ` GROUP BY a.id ORDER BY a.published_at DESC, a.created_at DESC LIMIT $1`
  const result = await pool.query(query, params)
  return result.rows
}

async function getArticleById(id) {
  const result = await pool.query(
    `SELECT * FROM articles WHERE id = $1 AND is_published = true`,
    [id]
  )
  return result.rows[0]
}

async function getArticleBySlug(slug) {
  const normalizedSlug = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  const result = await pool.query(
    `SELECT * FROM articles WHERE is_published = true AND lower(regexp_replace(trim(title), '[^a-z0-9]+', '-', 'g')) = $1 LIMIT 1`,
    [normalizedSlug]
  )

  if (result.rows.length > 0) {
    return result.rows[0]
  }

  const fallback = await pool.query(`SELECT * FROM articles WHERE is_published = true`)
  return fallback.rows.find((article) => {
    const articleSlug = (article.title || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
    return articleSlug === normalizedSlug
  })
}

async function getAllCategories() {
  const result = await pool.query("SELECT * FROM categories ORDER BY name")
  return result.rows
}

async function getCategoryBySlug(slug) {
  const result = await pool.query("SELECT * FROM categories WHERE slug = $1", [slug])
  return result.rows[0]
}

async function upsertCategory(name, slug, description, color) {
  const result = await pool.query(
    `INSERT INTO categories (name, slug, description, color) 
     VALUES ($1, $2, $3, $4) 
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color 
     RETURNING *`,
    [name, slug, description || null, color || "#3B82F6"]
  )
  return result.rows[0]
}

async function assignCategoryToArticle(articleId, categoryId) {
  await pool.query(
    `INSERT INTO article_categories (article_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [articleId, categoryId]
  )
}

async function getAllSources() {
  const result = await pool.query("SELECT * FROM sources WHERE is_active = true ORDER BY name")
  return result.rows
}

async function saveArticle(article) {
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

async function logCrawl(sourceId, status, error, articlesGenerated) {
  const result = await pool.query(
    `INSERT INTO crawl_logs (source_id, status, error_message, articles_generated) 
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [sourceId, status, error || null, articlesGenerated || 0]
  )
  return result.rows[0]
}

const dbExports = {
  pool,
  getRecentArticles,
  getArticleById,
  getArticleBySlug,
  getAllCategories,
  getCategoryBySlug,
  upsertCategory,
  assignCategoryToArticle,
  getAllSources,
  saveArticle,
  logCrawl,
}

module.exports = dbExports
module.exports.default = dbExports
