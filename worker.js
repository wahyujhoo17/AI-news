const cron = require("node-cron")
const Parser = require("rss-parser")
const cheerio = require("cheerio")
const axios = require("axios")
const { pool, logCrawl } = require("./lib/db")

console.log("DEBUG: OPENROUTER_API_KEY present?", !!process.env.OPENROUTER_API_KEY)
console.log("DEBUG: OPENROUTER_MODEL:", process.env.OPENROUTER_MODEL)

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/stepfun/step-3.5-flash:free"

const CATEGORY_KEYWORDS = {
  teknologi: ["tech", "teknologi", "software", "hardware", "ai", "artificial intelligence", "kecerdasan buatan", "internet", "gadget", "smartphone", "digital"],
  bisnis: ["bisnis", "business", "ekonomi", "market", "saham", "investasi", "startup", "entrepreneur", "keuangan"],
  olahraga: ["olahraga", "sports", "sepak bola", "basket", "badminton", "tenis", "match", "tim"],
  kesehatan: ["kesehatan", "health", "dokter", "rumah sakit", "obat", "vaksin"],
  hiburan: ["hiburan", "entertainment", "film", "musik", "konser", "game"],
  politik: ["politik", "pemerintah", "presiden", "dpr", "kabinet", "pemilu"],
}

function detectCategory(title, content) {
  const text = (title + " " + content).toLowerCase()
  const matches = []
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      matches.push(category)
    }
  }
  return matches
}

async function fetchRSS(url) {
  const parser = new Parser()
  try {
    const feed = await parser.parseURL(url)
    return feed.items.map((item) => ({
      title: item.title,
      link: item.link,
      content: item.contentSnippet || item.content || item.summary,
      pubDate: item.pubDate,
      sourceUrl: url,
    }))
  } catch (error) {
    console.error("RSS fetch error:", error.message)
    return []
  }
}

async function fetchHTML(url, selector = "article, .post, .news") {
  try {
    const response = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 10000,
    })
    const $ = cheerio.load(response.data)
    const articles = []
    $(selector).each((i, el) => {
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
    console.error("HTML fetch error:", error.message)
    return []
  }
}

async function generateArticle(title, sourceContent, sourceUrl) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY not set")
  }

  const prompt = `Buatkan artikel berita dalam bahasa Indonesia yang menarik dan informatif berdasarkan kontribusi di bawah. 
Jangan mention sumber asli. Artikel harus original, dengan paragraf yang rapi.
Judul: ${title}
Konten sumber: ${sourceContent.slice(0, 2000)}

Buatkan artikel lengkap (sekitar 500-800 kata) dengan:
1. Intro yang menarik
2. Isi berita dengan detail
3. Kesimpulan

Tambahkan juga:
- Excerpt (1-2 kalimat ringkasan)
- Author: "AI News Editor"
Jangan sertakan placeholder gambar.`

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: "Kamu adalah jurnalis profesional bahasa Indonesia." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1200,
      },
      {
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://lumicloud.my.id",
          "X-Title": "AI News Worker",
        },
      }
    )

    const data = response.data
    const fullContent = data.choices[0].message.content
    const usage = data.usage

    const excerpt = fullContent.split(". ").slice(0, 2).join(". ") + "."

    return {
      title,
      content: fullContent,
      excerpt,
      author: "AI News Editor",
      tokens: {
        prompt: usage.prompt_tokens,
        completion: usage.completion_tokens,
        total: usage.total_tokens,
      },
      cost: usage.total_tokens * 0.000001,
      model: OPENROUTER_MODEL,
    }
  } catch (error) {
    if (error.response) {
      throw new Error(`OpenRouter error: ${error.response.status} - ${JSON.stringify(error.response.data)}`)
    }
    throw error
  }
}

async function processSource(source) {
  console.log("Processing source:", source.name)
  let articles = []
  if (source.type === "rss") {
    articles = await fetchRSS(source.url)
  } else {
    articles = await fetchHTML(source.url)
  }

  if (articles.length === 0) {
    console.log("No articles found for", source.name)
    await logCrawl(source.id, "completed", undefined, 0)
    return
  }

  const now = new Date().toISOString()
  await logCrawl(source.id, "started")

  let generatedCount = 0
  for (const article of articles.slice(0, 3)) {
    try {
      const existing = await pool.query(
        "SELECT id FROM articles WHERE title = $1 AND source_name = $2",
        [article.title, source.name]
      )
      if (existing.rows.length > 0) {
        console.log("Skipping duplicate:", article.title)
        continue
      }

      const generated = await generateArticle(article.title, article.content, article.link)

      const saved = await pool.query(
        `INSERT INTO articles 
         (title, content, source_url, source_name, published_at, is_published, ai_model, prompt_tokens, completion_tokens, total_tokens, estimated_cost, excerpt, author)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
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
          generated.excerpt,
          generated.author,
        ]
      )

      // Auto-categorize
      const categories = detectCategory(generated.title, generated.content)
      for (const catName of categories) {
        try {
          const catResult = await pool.query(
            `INSERT INTO categories (name, slug) 
             VALUES ($1, $2) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING *`,
            [catName, catName.toLowerCase().replace(/\s+/g, "-")]
          )
          const cat = catResult.rows[0]
          await pool.query(
            `INSERT INTO article_categories (article_id, category_id) 
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [saved.rows[0].id, cat.id]
          )
          console.log("Assigned category:", cat.name)
        } catch (err) {
          console.error("Category error:", err.message)
        }
      }

      generatedCount++
      console.log("Generated article:", generated.title)
    } catch (err) {
      console.error("Failed to generate article from", article.title, ":", err.message)
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

// Schedule every 1 minute
cron.schedule("* * * * *", async () => {
  console.log("Running scheduled crawl...")
  await runCrawl()
})

console.log("AI News Worker started. Will run every minute.")
if (require.main === module) {
  runCrawl().catch(console.error)
}
