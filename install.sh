#!/bin/bash
set -e

echo "Deploying AI News to /var/www/ai-news..."

# Create directory
mkdir -p /var/www/ai-news
cd /var/www/ai-news

# package.json
cat > package.json << 'PKGEOF'
{
  "name": "ai-news-website",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "worker": "node worker.js"
  },
  "dependencies": {
    "next": "^15.2.4",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "pg": "^8.14.1",
    "node-cron": "^3.0.3",
    "node-fetch": "^3.3.2",
    "rss-parser": "^3.13.0",
    "cheerio": "^1.0.0-rc.12",
    "axios": "^1.8.4"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5"
  }
}
PKGEOF

# Create directories
mkdir -p app/api/articles app/api/admin lib

# Next.js config
cat > next.config.ts << 'CONFEOF'
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  /* config options here */
}

export default nextConfig
CONFEOF

# tsconfig.json
cat > tsconfig.json << 'TSEOF'
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
TSEEOF

# Create directories (additional)
mkdir -p app/api/admin/sources

# layout
cat > app/layout.tsx << 'LAYEOF'
export const metadata = {
  title: "AI News",
  description: "Berita yang dibuat oleh AI",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
LAYEOF

# page
cat > app/page.tsx << 'PGEOF'
"use client"

import { useEffect, useState } from "react"

interface Article {
  id: number
  title: string
  content: string
  source_name: string
  source_url: string
  published_at: string | null
  created_at: string
}

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/articles")
      .then((res) => res.json())
      .then((data) => {
        setArticles(data.articles || [])
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-gray-900">AI News</h1>
        <div className="space-y-6">
          {articles.map((article) => (
            <article key={article.id} className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-2xl font-bold mb-2">{article.title}</h2>
              <p className="text-gray-600 mb-4">{article.content.slice(0, 300)}...</p>
              <div className="text-sm text-gray-500">
                Sumber: {article.source_name} • {new Date(article.created_at).toLocaleString("id-ID")}
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
PGEOF

# lib/db.ts
cat > lib/db.ts << 'DBEOF'
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
}

export type Source = {
  id: number
  name: string
  url: string
  type: string
  is_active: boolean
  created_at: string
}

export async function getRecentArticles(limit: number = 20) {
  const result = await pool.query<Article>(
    `SELECT id, title, content, source_url, source_name, published_at, created_at
     FROM articles 
     WHERE is_published = true 
     ORDER BY published_at DESC, created_at DESC 
     LIMIT $1`,
    [limit]
  )
  return result.rows
}

export async function getAllSources() {
  const result = await pool.query<Source>(
    "SELECT * FROM sources WHERE is_active = true ORDER BY name"
  )
  return result.rows
}

export async function saveArticle(article: Partial<Article>) {
  const result = await pool.query(
    `INSERT INTO articles 
     (title, content, source_url, source_name, category, published_at, is_published, ai_model, prompt_tokens, completion_tokens, total_tokens, estimated_cost) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
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
DBEOF

# API routes
cat > app/api/articles/route.ts << 'ARTEOF'
import { NextResponse } from "next/server"
import { getRecentArticles } from "@/lib/db"

export async function GET() {
  try {
    const articles = await getRecentArticles(50)
    return NextResponse.json({ articles })
  } catch (error) {
    console.error("Failed to fetch articles:", error)
    return NextResponse.json({ error: "Failed to fetch articles" }, { status: 500 })
  }
}
ARTEOF

cat > app/api/admin/sources/route.ts << 'SRCEOF'
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
SRCEOF

# worker
cat > worker.js << 'WRKEOF'
import cron from "node-cron"
import Parser from "rss-parser"
import fetch from "node-fetch"
import cheerio from "cheerio"
import axios from "axios"
import { pool, logCrawl } from "@/lib/db"

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/stepfun/step-3.5-flash:free"

async function fetchRSS(url: string): Promise<any[]> {
  const parser = new Parser()
  try {
    const feed = await parser.parseURL(url)
    return feed.items.map((item: any) => ({
      title: item.title,
      link: item.link,
      content: item.contentSnippet || item.content || item.summary,
      pubDate: item.pubDate,
      sourceUrl: url,
    }))
  } catch (error) {
    console.error("RSS fetch error:", error)
    return []
  }
}

async function fetchHTML(url: string, selector: string = "article, .post, .news"): Promise<any[]> {
  try {
    const response = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 10000,
    })
    const $ = cheerio.load(response.data)
    const articles = []
    $(selector).each((i: number, el: any) => {
      const title = $(el).find("h1, h2, h3, .title").first().text().trim()
      const content = $(el).find("p").slice(0, 3).text().trim().slice(0, 500)
      if (title && content) {
        articles.push({
          title,
          link: url,
          content,
          pubDate: new Date().toISOString(),
          sourceUrl: url,
        })
      }
    })
    return articles.slice(0, 5)
  } catch (error) {
    console.error("HTML fetch error:", error)
    return []
  }
}

async function generateArticle(title: string, sourceContent: string, sourceUrl: string) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY not set")
  }

  const prompt = `Buatkan artikel berita dalam bahasa Indonesia yang menarik dan informasikan berdasarkan kontribusi di bawah. 
Jangan mention sumber asli. Artikel harus original, dengan paragraf yang rapi.
Judul: ${title}
Konten sumber: ${sourceContent.slice(0, 2000)}

Buatkan artikel lengkap (sekitar 500-800 kata) dengan intro, isi, dan kesimpulan.`

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://lumicloud.my.id",
      "X-Title": "AI News Worker",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: "system", content: "Kamu adalah jurnalis profesional bahasa Indonesia." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenRouter error: ${response.status} - ${err}`)
  }

  const data = await response.json()
  const content = data.choices[0].message.content
  const usage = data.usage

  return {
    title,
    content,
    tokens: {
      prompt: usage.prompt_tokens,
      completion: usage.completion_tokens,
      total: usage.total_tokens,
    },
    cost: usage.total_tokens * 0.000001,
    model: OPENROUTER_MODEL,
  }
}

async function processSource(source: any) {
  console.log(`Processing source: ${source.name}`)
  let articles = []
  if (source.type === "rss") {
    articles = await fetchRSS(source.url)
  } else {
    articles = await fetchHTML(source.url)
  }

  const now = new Date().toISOString()
  await logCrawl(source.id, "started")

  let generatedCount = 0
  for (const article of articles.slice(0, 3)) {
    try {
      const generated = await generateArticle(article.title, article.content, article.link)
      await pool.query(
        `INSERT INTO articles 
         (title, content, source_url, source_name, published_at, is_published, ai_model, prompt_tokens, completion_tokens, total_tokens, estimated_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          generated.title,
          generated.content,
          article.link,
          source.name,
          now,
          true,
          generated.model,
          generated.tokens.prompt,
          generated.tokens.completion,
          generated.tokens.total,
          generated.cost,
        ]
      )
      generatedCount++
      console.log(`Generated article: ${generated.title}`)
    } catch (err) {
      console.error(`Failed to generate article from ${article.title}:`, err.message)
    }
  }

  await logCrawl(source.id, "completed", undefined, generatedCount)
  console.log(`Source ${source.name} done. Generated: ${generatedCount}`)
}

async function runCrawl() {
  console.log("Starting crawl job...")
  try {
    const result = await pool.query("SELECT * FROM sources WHERE is_active = true")
    const sources = result.rows

    for (const source of sources) {
      try {
        await processSource(source)
      } catch (err) {
        console.error(`Crawl failed for source ${source.name}:`, err.message)
        await logCrawl(source.id, "error", err.message)
      }
    }
    console.log("Crawl job completed.")
  } catch (error) {
    console.error("Crawl job fatal error:", error)
  }
}

cron.schedule("* * * * *", async () => {
  console.log("Running scheduled crawl...")
  await runCrawl()
})

console.log("AI News Worker started. Will run every minute.")
if (require.main === module) {
  runCrawl().catch(console.error)
}
WRKEOF

# .env file
cat > .env << 'ENVEOF'
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=openrouter/stepfun/step-3.5-flash:free
ADMIN_SECRET=superadminsecret123
PGHOST=localhost
PGPORT=5432
PGDATABASE=ai_news_db
PGUSER=ai_news_user
PGPASSWORD=StrongPass123!
ENVEOF

# .env.example
cat > .env.example << 'ENVEXEOF'
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=openrouter/stepfun/step-3.5-flash:free
ADMIN_SECRET=change_this_secret
PGHOST=localhost
PGPORT=5432
PGDATABASE=ai_news_db
PGUSER=ai_news_user
PGPASSWORD=your_db_password
ENVEXEOF

echo "Deployment files prepared. To deploy:"
echo "1. Copy this content into /var/www/ai-news on the server"
echo "2. Run: npm install"
echo "3. Copy .env to actual env file and fill values"
echo "4. Run: pm2 start npm --name ai-news -- start"
echo "5. Run: pm2 start npm --name ai-news-worker -- run worker"
echo "6. Setup Nginx config"
