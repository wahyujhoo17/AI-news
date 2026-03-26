require('dotenv').config()
const cron = require('node-cron')
const axios = require('axios')
const Parser = require('rss-parser')
const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')
const { pool } = require('./lib/db')

console.log("[STARTUP] Environment variables loaded:")
console.log("[STARTUP] GROQ_API_KEY:", process.env.GROQ_API_KEY ? "✓" : "✗")
console.log("[STARTUP] UNSPLASH_API_KEY:", process.env.UNSPLASH_API_KEY ? "✓" : "✗")
console.log("[STARTUP] GROQ_MODEL:", process.env.GROQ_MODEL)

const BUILTIN_FEEDS = [
  { name: 'Google News', type: 'rss', url: 'https://news.google.com/rss' },
  { name: 'BBC World', type: 'rss', url: 'https://feeds.bbc.co.uk/news/world/rss.xml' },
  { name: 'Reuters', type: 'rss', url: 'https://www.reutersagency.com/feed/?taxonomy=best-topics&output=rss' },
  { name: 'Al Jazeera', type: 'rss', url: 'https://www.aljazeera.com/xml/feeds/rss/all.xml' },
  { name: 'AP News', type: 'rss', url: 'https://apnews.com/hub/ap-top-news/rss' },
  { name: 'NPR', type: 'rss', url: 'https://feeds.npr.org/1001/rss.xml' },
  { name: 'The Guardian', type: 'rss', url: 'https://www.theguardian.com/world/rss' }
]

// Tech-specific feeds
const TECH_FEEDS = [
  { id: 901, name: 'TechCrunch', type: 'rss', url: 'https://techcrunch.com/feed/', isTech: true },
  { id: 902, name: 'The Verge', type: 'rss', url: 'https://www.theverge.com/rss/index.xml', isTech: true },
  { id: 903, name: 'Ars Technica', type: 'rss', url: 'https://feeds.arstechnica.com/arstechnica/index', isTech: true },
  { id: 904, name: 'Wired', type: 'rss', url: 'https://www.wired.com/feed/rss', isTech: true },
  { id: 905, name: 'MIT Tech Review', type: 'rss', url: 'https://www.technologyreview.com/feed/', isTech: true },
]

// Football-specific feeds
const FOOTBALL_FEEDS = [
  { id: 911, name: 'BBC Football', type: 'rss', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', isFootball: true },
  { id: 912, name: 'Sky Sports Football', type: 'rss', url: 'https://www.skysports.com/rss/12040', isFootball: true },
  { id: 913, name: 'ESPN Soccer', type: 'rss', url: 'https://www.espn.com/espn/rss/soccer/news', isFootball: true },
]

// Konfigurasi rasio artikel per siklus crawl
const CRAWL_CONFIG = {
  TOTAL_BUDGET: 10,        // total artikel target per siklus
  TECH_RATIO: 0.05,        // 5% technology
  FOOTBALL_RATIO: 0.10,    // 10% football
  MAX_PER_SOURCE: 3,       // maks artikel diambil per sumber
}

async function fetchImageFromUnsplash(keywords) {
  try {
    const unsplashKey = process.env.UNSPLASH_API_KEY
    if (!unsplashKey) {
      console.log("[DEBUG] UNSPLASH_API_KEY not set, skipping image fetch")
      return null
    }

    // Extract better keywords from title - take meaningful words (skip "the", "a", etc)
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'by', 'for', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'releases', 'released', 'issue']
    const words = keywords.toLowerCase().split(/\s+/)
      .filter(w => !stopWords.includes(w) && w.length > 3)
      .slice(0, 3)

    let query = words.join(' ').trim()

    // If query too short or generic, use fallback queries based on keywords
    if (!query || query.length < 4) {
      const lowerTitle = keywords.toLowerCase()
      if (lowerTitle.includes('asean') || lowerTitle.includes('southeast')) query = 'tropical forest asia'
      else if (lowerTitle.includes('trump')) query = 'government politics'
      else if (lowerTitle.includes('war') || lowerTitle.includes('iran') || lowerTitle.includes('israel')) query = 'international conflict'
      else if (lowerTitle.includes('ukraine')) query = 'war conflict'
      else if (lowerTitle.includes('africa') || lowerTitle.includes('african')) query = 'africa landscape'
      else if (lowerTitle.includes('climate') || lowerTitle.includes('environment')) query = 'nature environment'
      else if (lowerTitle.includes('business') || lowerTitle.includes('market')) query = 'business finance'
      else if (lowerTitle.includes('tech') || lowerTitle.includes('ai')) query = 'technology innovation'
      else query = 'world landscape'
    } else if (query === 'asean secretariat asean' || query === 'asean magazine' || query === 'secretariat magazine') {
      // Override specific generic ASEAN queries
      query = 'tropical forest coral reef'
    } else if (query === 'melania trump shares') {
      query = 'government white house'
    } else if (!query || query.split(' ').length === 0) {
      query = 'world news'
    }

    console.log(`[DEBUG] Searching Unsplash for: "${query}"`)
    const response = await axios.get('https://api.unsplash.com/search/photos', {
      params: {
        query: query,
        per_page: 1,
        orientation: 'landscape'
      },
      headers: {
        'Authorization': `Client-ID ${unsplashKey}`
      },
      timeout: 10000
    })

    if (response.data.results && response.data.results.length > 0) {
      const imageUrl = response.data.results[0].urls.regular
      console.log(`✓ Fetched image (${query}): ${imageUrl.slice(0, 60)}...`)
      return imageUrl
    }
    console.log(`✗ No image results for: "${query}"`)
    return null
  } catch (error) {
    console.error("[ERROR] Unsplash fetch:", error.message)
    return null
  }
}

async function fetchRSS(url) {
  try {
    const parser = new Parser()
    const feed = await parser.parseURL(url)
    return (feed.items || []).map(item => ({
      title: item.title || 'Untitled',
      content: item.contentSnippet || item.content || item.description || '',
      link: item.link || '',
      pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      sourceUrl: url
    }))
  } catch (error) {
    console.error("RSS fetch error:", error.message)
    return []
  }
}

async function fetchHTML(url, selector = 'article') {
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
  // Groq-only (no fallback)
  const groqKey = process.env.GROQ_API_KEY
  const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-20b'
  if (!groqKey) throw new Error('GROQ_API_KEY not configured')

  const prompt = `You are a professional news journalist. Write a comprehensive news article based on the source below.

Source Title: ${title}
Source Content: ${sourceContent.slice(0, 2000)}

OUTPUT FORMAT (follow exactly):
1. First line: A SPECIFIC, SEO-friendly headline (55-80 chars)
   - Must mention WHO and WHAT specifically (name, organization, country, topic)
   - Must be descriptive enough to stand alone without reading the article
   - BAD examples (too vague): "The Courtesy Visit", "Breaking News", "Official Statement", "New Development"
   - GOOD examples: "ASEAN Secretary-General Meets UN University Network Chief in Jakarta", "South Africa Composer Sues Comedian Over Lion King Chant Misrepresentation", "UN Votes to Label Transatlantic Slave Trade as Gravest Crime Against Humanity"
2. Blank line
3. Article body in MARKDOWN (minimum 800 words)
  - Keep journalistic narrative flow; structure must adapt to this specific story
  - Headings are OPTIONAL (use only when truly needed, max 2)
  - NEVER use generic templated headings: "Introduction", "Background", "Overview", "Conclusion", "Summary"
  - Do not follow a rigid pattern like heading → short paragraph → heading repeatedly
  - Tables are OPTIONAL: include only when there is structured data (dates, figures, comparisons)
  - Mermaid flowchart/diagram blocks are OPTIONAL: include only if chronology/process is central and clearer as a diagram
  - If context is purely narrative, do NOT force tables or flowcharts
  - Use **bold** only when it adds clarity, not in every paragraph
  - Include context, analysis, implications, and concrete details relevant to this specific story

Do NOT include any preamble, explanation, or commentary. Start directly with the headline on line 1.

Begin:`

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: groqModel,
        messages: [
          { role: 'system', content: 'You are a professional news journalist. Always start directly with the headline. Output valid Markdown only. Avoid templated section structures and generic headings like Introduction/Conclusion. Use natural, context-driven narrative flow. Tables and mermaid flowcharts are optional and must not be forced; use them only when they genuinely improve clarity for structured/process-heavy stories. Do not include any preamble, explanation, meta-commentary, or instructions.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 3000,
        temperature: 0.8
      },
      {
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    )

    console.log(`[GENERATE] Groq API response received for "${title.slice(0, 50)}"`)
    const data = response.data || {}
    let fullContent = ''
    if (data.choices && data.choices[0]) {
      fullContent = data.choices[0].message?.content || data.choices[0].text || ''
    } else if (data.output_text) {
      fullContent = data.output_text
    } else if (Array.isArray(data.output)) {
      fullContent = data.output.map(o => {
        if (typeof o === 'string') return o
        if (o.content) {
          if (Array.isArray(o.content)) return o.content.map(c => c.text || '').join('')
          return o.content.text || ''
        }
        return ''
      }).join('\n')
    }

    if (!fullContent) throw new Error('No content in response')
    console.log(`[GENERATE] Content received, length: ${fullContent.length} chars`)

    // === CONTENT CLEANING ===
    // Pola instruksi/preamble yang harus dibuang
    const instructionPatterns = [
      /^(we need|we will|we are|we should|let me|let's|here's|here is|i will|i'll|i am|this article|the article|note:|note that|below is|as requested|certainly|sure,|of course|absolutely)/i,
      /^(writing|drafting|creating|generating|producing) (a|an|the) (news|article|comprehensive|original)/i,
      /^(source title|source content|output format|begin:|article:|---)/i,
      /^(format|instructions|example|aim for|provide|include|return only|keep neutral)/i,
      /^\*\*(important|note|output|format|instructions?)\*\*/i,
    ]

    const rawLines = fullContent.split('\n')

    // Cari baris pertama yang benar-benar konten artikel
    // Strategy: cari heading # pertama, atau skip semua baris instruksi
    let realContentStart = 0

    // Pass 1: cari heading # pertama dalam 30 baris pertama
    for (let i = 0; i < Math.min(rawLines.length, 30); i++) {
      const line = rawLines[i].trim()
      if (line.startsWith('#')) {
        realContentStart = i
        break
      }
    }

    // Pass 2: kalau tidak ada heading, cari baris pertama non-instruksi yang substantif
    if (realContentStart === 0) {
      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i].trim()
        if (!line) continue
        const isInstruction = instructionPatterns.some(p => p.test(line))
        if (!isInstruction && line.length > 20) {
          realContentStart = i
          break
        }
      }
    }

    // Potong semua baris instruksi/preamble di awal
    let contentLines = rawLines.slice(realContentStart)

    // Buang juga trailing whitespace & baris kosong berlebih di awal
    while (contentLines.length > 0 && !contentLines[0].trim()) contentLines.shift()

    // Gabungkan kembali sebagai konten bersih
    let cleanContent = contentLines.join('\n').trim()

    // Hilangkan baris instruksi yang mungkin masih tersisa di awal konten
    const cleanLineArr = cleanContent.split('\n')
    let skipUntil = 0
    for (let i = 0; i < Math.min(cleanLineArr.length, 10); i++) {
      const line = cleanLineArr[i].trim()
      if (!line) continue
      if (instructionPatterns.some(p => p.test(line))) {
        skipUntil = i + 1
      } else {
        break
      }
    }
    if (skipUntil > 0) {
      cleanContent = cleanLineArr.slice(skipUntil).join('\n').trim()
    }

    // Buang heading template generik jika masih lolos dari model
    const templatedHeadingPattern = /^#{1,3}\s*(introduction|background|overview|conclusion|summary|context|analysis|key takeaways?|final thoughts?)\s*:?$/i
    cleanContent = cleanContent
      .split('\n')
      .filter(line => !templatedHeadingPattern.test(line.trim()))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    // === EXTRACT SEO HEADLINE ===
    let seoHeadline = null
    const finalLines = cleanContent.split('\n')

    // Pola heading/headline yang terlalu generik / tidak SEO
    const genericSectionTitles = /^(introduction|background|overview|conclusion|summary|context|analysis|details?|contents?|breaking news|news brief|latest news|update|report|the (latest|news|update|report|visit|meeting|event|announcement|statement|development))\b/i
    // Headline dianggap valid hanya jika panjang >= 40 dan tidak generik
    const isValidHeadline = (s) => s.length >= 40 && s.length <= 120 && !genericSectionTitles.test(s)

    for (const line of finalLines.slice(0, 5)) {
      const trimmed = line.trim()
      if (!trimmed) continue

      if (trimmed.startsWith('#')) {
        const candidate = trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim()
        if (!isValidHeadline(candidate)) continue
        seoHeadline = candidate
        cleanContent = finalLines.filter(l => l.trim() !== trimmed).join('\n').trim()
        break
      } else if (trimmed.startsWith('**') && trimmed.endsWith('**') && !trimmed.includes('\n')) {
        const candidate = trimmed.replace(/\*\*/g, '').trim()
        if (isValidHeadline(candidate)) {
          seoHeadline = candidate
          cleanContent = finalLines.filter(l => l.trim() !== trimmed).join('\n').trim()
          break
        }
      } else if (!trimmed.startsWith('-') && !trimmed.startsWith('|') && !trimmed.startsWith('#')) {
        const candidate = trimmed.replace(/\*\*/g, '').trim()
        if (isValidHeadline(candidate)) {
          seoHeadline = candidate
          cleanContent = finalLines.filter(l => l.trim() !== trimmed).join('\n').trim()
          break
        }
      }
    }

    // Fallback 1: coba ambil kalimat pertama dari paragraf pembuka artikel
    if (!seoHeadline || !isValidHeadline(seoHeadline)) {
      for (const line of finalLines) {
        const t = line.trim()
        if (!t || t.startsWith('#') || t.startsWith('|') || t.startsWith('-')) continue
        const clean = t.replace(/\*\*/g, '').trim()
        const firstSentence = clean.split(/\.\s/)[0].trim()
        if (firstSentence.length >= 40 && firstSentence.length <= 110 && !genericSectionTitles.test(firstSentence)) {
          seoHeadline = firstSentence
          console.log('[HEADLINE] Extracted from first sentence')
          break
        }
      }
    }

    // Fallback 2: gunakan source title yang sudah dibersihkan
    if (!seoHeadline || !isValidHeadline(seoHeadline)) {
      seoHeadline = title.split(' - ')[0].replace(/\s*[-|:]\s*$/, '').trim().slice(0, 95)
      console.log('[HEADLINE] Fell back to source title')
    }

    if (seoHeadline.length > 95) seoHeadline = seoHeadline.slice(0, 92).trim() + '...'

    console.log(`[HEADLINE] Extracted SEO headline (${seoHeadline.length} chars): ${seoHeadline.slice(0, 70)}`)

    // === EXTRACT EXCERPT dari konten bersih ===
    const excerptLines = cleanContent.split('\n').filter(l => l.trim())
    let excerpt = ''
    for (const line of excerptLines) {
      const t = line.trim()
      if (!t.startsWith('#') && !t.startsWith('|') && !t.startsWith('-') && t.length > 40) {
        excerpt = t.replace(/\*\*/g, '').trim()
        break
      }
    }
    if (!excerpt) excerpt = 'Read the full article for details.'
    excerpt = excerpt.split('. ').slice(0, 2).join('. ')
    if (!excerpt.endsWith('.')) excerpt += '.'

    const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

    return {
      title: seoHeadline,  // Use extracted SEO headline instead of source title
      content: cleanContent,
      excerpt,
      author: 'AI News Editor',
      tokens: { prompt: usage.prompt_tokens, completion: usage.completion_tokens, total: usage.total_tokens },
      cost: (usage.total_tokens || 0) * 0.000001,
      model: groqModel,
      format: 'markdown'
    }
  } catch (err) {
    console.error('Groq API error:', err.response?.data || err.message)
    throw err
  }
}

function detectCategory(title, content) {
  const text = (title + ' ' + content).toLowerCase()
  const keywords = {
    'technology': ['technology', 'tech', 'digital', 'ai', 'software', 'app', 'code', 'programming', 'cyber', 'internet', 'data'],
    'business': ['business', 'market', 'trade', 'commerce', 'company', 'corporate', 'economy', 'finance', 'stock', 'investor'],
    'sports': ['sport', 'football', 'soccer', 'game', 'athlete', 'championship', 'match', 'league', 'player', 'team'],
    'health': ['health', 'medical', 'doctor', 'disease', 'hospital', 'vaccine', 'covid', 'pandemic', 'treatment', 'wellness'],
    'entertainment': ['entertainment', 'movie', 'music', 'celebrity', 'actor', 'film', 'show', 'series', 'hollywood', 'drama'],
    'politics': ['politics', 'government', 'election', 'president', 'parliament', 'law', 'vote', 'congress', 'senator', 'minister']
  }

  const categories = []
  for (const [cat, words] of Object.entries(keywords)) {
    if (words.some(w => text.includes(w))) {
      categories.push(cat)
    }
  }
  return categories.length > 0 ? categories : null // Return null to trigger AI classification
}

async function classifyArticleWithAI(title, excerpt) {
  try {
    const groqKey = process.env.GROQ_API_KEY
    const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-20b'
    if (!groqKey) throw new Error('GROQ_API_KEY not configured')

    // More strict prompt that forces output format
    const prompt = `Categorize this article. Respond with ONLY 1-3 category names, separated by commas. Each name must be lowercase, single word or hyphenated. No other text.

Title: ${title}
Excerpt: ${excerpt}

Example output: politics, technology, international
Your output:`

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: groqModel,
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 30,
        temperature: 0.1
      },
      {
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    )

    const data = response.data || {}
    let result = ''
    if (data.choices && data.choices[0]) {
      result = data.choices[0].message?.content || data.choices[0].text || ''
    } else if (data.output_text) {
      result = data.output_text
    }

    // Parse categories - strict validation with stop-word filter
    const stopWords = ['the', 'and', 'or', 'a', 'an', 'is', 'are', 'was', 'were', 'with', 'for', 'of', 'to', 'in', 'on', 'at', 'by', 'from', 'as', 'it', 'this', 'that', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can']

    const categoryList = result
      .trim()
      .split(',')
      .map(c => {
        const cleaned = c.trim().toLowerCase().replace(/[^a-z0-9\-]/g, '')
        return cleaned
      })
      .filter(c => {
        // Strict validation
        return c.length >= 3 && c.length <= 20 &&
          !stopWords.includes(c) &&
          !c.includes('output') &&
          !c.includes('example') &&
          !c.includes('respond') &&
          !c.includes('text') &&
          !c.includes('format') &&
          /^[a-z0-9\-]+$/.test(c) && // Only valid chars
          !c.match(/^\d+/) // No starting with numbers
      })

    if (categoryList.length > 0) {
      console.log(`[AI Classification] Suggested for "${title.slice(0, 40)}...": ${categoryList.join(', ')}`)
    }
    return categoryList
  } catch (error) {
    console.error("AI Classification error:", error.message)
    return [] // Return empty array, fallback to keyword categories
  }
}

async function logCrawl(sourceId, status, error = null, count = 0) {
  try {
    await pool.query(
      `INSERT INTO crawl_logs (source_id, status, error_message, articles_generated)
       VALUES ($1, $2, $3, $4)`,
      [sourceId, status, error, count]
    )
  } catch (err) {
    console.error("Crawl log error:", err.message)
  }
}

// options: { maxArticles, forcedCategories }
async function processSource(source, options = {}) {
  const maxArticles = options.maxArticles || CRAWL_CONFIG.MAX_PER_SOURCE
  const forcedCategories = options.forcedCategories || []

  console.log(`Processing source: ${source.name} (max: ${maxArticles} articles${source.isTech ? ' 🔧 tech' : ''})`)
  let articles = []
  if (source.type === "rss") {
    articles = await fetchRSS(source.url)
  } else {
    articles = await fetchHTML(source.url)
  }

  if (articles.length === 0) {
    console.log("No articles found for", source.name)
    if (source.id < 900) await logCrawl(source.id, "completed", undefined, 0)
    return 0
  }

  const now = new Date().toISOString()
  if (source.id < 900) await logCrawl(source.id, "started")

  let generatedCount = 0
  for (const article of articles.slice(0, maxArticles)) {
    try {
      // Verifikasi 1: Cek judul source sudah pernah di-process
      const existingSource = await pool.query(
        "SELECT id FROM articles WHERE title = $1 AND source_name = $2",
        [article.title, source.name]
      )
      if (existingSource.rows.length > 0) {
        console.log(`[PROCESS] Skipping duplicate source for ${source.name}: ${article.title}`)
        continue
      }
      console.log(`[PROCESS] Source check passed for ${source.name}: ${article.title}`)


      const generated = await generateArticle(article.title, article.content, article.link)

      // Verifikasi 2: Cek judul artikel yang sudah di-generate
      const existingGenerated = await pool.query(
        "SELECT id FROM articles WHERE title = $1",
        [generated.title]
      )
      if (existingGenerated.rows.length > 0) {
        console.log(`[DUP-CHECK-2] Skipping duplicate generated title: ${generated.title}`)
        continue
      }
      console.log(`[DUP-CHECK-2] PASS - new generated title`)

      // Verifikasi 3: Cek similarity pada excerpt (similar text check)
      const existingSimilar = await pool.query(
        "SELECT id, excerpt FROM articles WHERE excerpt LIKE $1 LIMIT 1",
        [`%${generated.excerpt.slice(0, 50)}%`]
      )
      if (existingSimilar.rows.length > 0) {
        console.log(`[DUP-CHECK-3] Skipping similar excerpt: ${generated.excerpt.slice(0, 40)}`)
        continue
      }
      console.log(`[DUP-CHECK-3] PASS - unique excerpt`)

      // Fetch featured image from Unsplash
      const featuredImage = await fetchImageFromUnsplash(generated.title)

      const saved = await pool.query(
        `INSERT INTO articles 
         (title, content, source_url, source_name, published_at, is_published, ai_model, prompt_tokens, completion_tokens, total_tokens, estimated_cost, excerpt, author, featured_image)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
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
          featuredImage
        ]
      )

      // Auto-categorize with hybrid approach (keyword + AI)
      let categories = detectCategory(generated.title, generated.content) || []

      // Always use AI classification to find more specific categories
      console.log("[AI Classification] Analyzing article for additional categories...")
      const aiCategories = await classifyArticleWithAI(generated.title, generated.excerpt)

      // Merge keyword categories + AI suggestions + forced categories (e.g. 'technology' for tech sources)
      const allCategories = [...new Set([...categories, ...aiCategories, ...forcedCategories])]
      console.log(`[Categorization] Final categories: ${allCategories.join(', ')}`)

      for (const catName of allCategories) {
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
      console.log("Generated:", saved.rows[0].id, "-", generated.title.slice(0, 50))
    } catch (err) {
      console.error(`Failed to generate article from ${article.title} :`, err.message)
    }
  }

  console.log(`Source ${source.name} done. Generated: ${generatedCount}`)
  if (source.id < 900) await logCrawl(source.id, "completed", undefined, generatedCount)
  return generatedCount
}

async function getSources() {
  try {
    const result = await pool.query("SELECT id, name, type, url FROM sources ORDER BY id")
    return result.rows
  } catch (err) {
    console.log("DB sources unavailable, using builtin feeds:", err.message)
    return BUILTIN_FEEDS.map((f, i) => ({ id: i + 1, name: f.name, type: f.type, url: f.url }))
  }
}

async function runCrawl() {
  console.log("Running scheduled crawl...")
  console.log("Starting crawl job...")

  // Untuk rasio kecil (5%) dan budget kecil (10), gunakan pembulatan probabilistik
  // agar rata-rata antar siklus tetap sesuai target.
  const probabilisticBudget = (total, ratio) => {
    const exact = total * ratio
    const base = Math.floor(exact)
    const remainder = exact - base
    return base + (Math.random() < remainder ? 1 : 0)
  }

  const techBudget = probabilisticBudget(CRAWL_CONFIG.TOTAL_BUDGET, CRAWL_CONFIG.TECH_RATIO)
  const footballBudget = probabilisticBudget(CRAWL_CONFIG.TOTAL_BUDGET, CRAWL_CONFIG.FOOTBALL_RATIO)
  const generalBudget = Math.max(0, CRAWL_CONFIG.TOTAL_BUDGET - techBudget - footballBudget)

  console.log(`[BUDGET] Cycle target: ${CRAWL_CONFIG.TOTAL_BUDGET} artikel | Tech: ${techBudget} (~${CRAWL_CONFIG.TECH_RATIO * 100}%) | Football: ${footballBudget} (~${CRAWL_CONFIG.FOOTBALL_RATIO * 100}%) | General: ${generalBudget}`)

  try {
    // ── 5% TECH SOURCES ──────────────────────────────────────────
    let techGenerated = 0
    const shuffledTech = [...TECH_FEEDS].sort(() => Math.random() - 0.5)

    for (const source of shuffledTech) {
      if (techGenerated >= techBudget) break
      const remaining = techBudget - techGenerated
      const count = await processSource(source, {
        maxArticles: Math.min(remaining, CRAWL_CONFIG.MAX_PER_SOURCE),
        forcedCategories: ['technology']
      })
      techGenerated += count
    }
    console.log(`[BUDGET] Tech selesai: ${techGenerated}/${techBudget} artikel`)

    // ── 5% FOOTBALL SOURCES ───────────────────────────────────────
    let footballGenerated = 0
    const shuffledFootball = [...FOOTBALL_FEEDS].sort(() => Math.random() - 0.5)

    for (const source of shuffledFootball) {
      if (footballGenerated >= footballBudget) break
      const remaining = footballBudget - footballGenerated
      const count = await processSource(source, {
        maxArticles: Math.min(remaining, CRAWL_CONFIG.MAX_PER_SOURCE),
        forcedCategories: ['football', 'sports']
      })
      footballGenerated += count
    }
    console.log(`[BUDGET] Football selesai: ${footballGenerated}/${footballBudget} artikel`)

    // ── 90% GENERAL SOURCES ───────────────────────────────────────
    let generalGenerated = 0
    const generalSources = await getSources()
    const shuffledGeneral = [...generalSources].sort(() => Math.random() - 0.5)

    for (const source of shuffledGeneral) {
      if (generalGenerated >= generalBudget) break
      const remaining = generalBudget - generalGenerated
      const count = await processSource(source, {
        maxArticles: Math.min(remaining, CRAWL_CONFIG.MAX_PER_SOURCE)
      })
      generalGenerated += count
    }
    console.log(`[BUDGET] General selesai: ${generalGenerated}/${generalBudget} artikel`)

    console.log(`[BUDGET] Total siklus ini: ${techGenerated + footballGenerated + generalGenerated} artikel (tech: ${techGenerated}, football: ${footballGenerated}, general: ${generalGenerated})`)
    console.log("Crawl job completed.")
  } catch (err) {
    console.error("Crawl error:", err.message)
  }
}

// Cron: every 30 minutes
cron.schedule('*/30 * * * *', () => {
  runCrawl()
})

// RUN_ONCE trigger
const RUN_ONCE_FILE = '/tmp/run_ai_news_once'
setInterval(async () => {
  if (fs.existsSync(RUN_ONCE_FILE)) {
    fs.unlinkSync(RUN_ONCE_FILE)
    console.log("RUN_ONCE triggered")
    await runCrawl()
  }
}, 5000)

// Initial run on startup
runCrawl()

console.log("Worker started. Cron scheduled for */30 * * * *")
