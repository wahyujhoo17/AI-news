require('dotenv').config()
const cron = require('node-cron')
const axios = require('axios')
const Parser = require('rss-parser')
const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')
const { pool } = require('./lib/db-worker')

console.log("[STARTUP] Environment variables loaded:")
console.log("[STARTUP] UNSPLASH_API_KEY:", process.env.UNSPLASH_API_KEY ? "✓" : "✗")
console.log("[STARTUP] GROQ_MODEL:", process.env.GROQ_MODEL)

// ============================================
// MULTI-KEY GROQ API MANAGER
// ============================================
class GroqKeyManager {
  constructor() {
    const keysEnv = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY
    if (!keysEnv) throw new Error('GROQ_API_KEYS or GROQ_API_KEY not configured')

    this.keys = keysEnv.split(',').map(k => k.trim()).filter(k => k.length > 0)
    this.currentIndex = 0
    this.keyStats = {}
    this.cooldownTimes = {}; // New: Store when a key should be available again
    this.DEFAULT_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes cooldown

    this.keys.forEach(key => {
      this.keyStats[key] = { attempts: 0, failures: 0, success: 0 }
      this.cooldownTimes[key] = 0; // Initialize cooldown for each key
    })

    console.log()
    this.keys.forEach((key, idx) => {
      console.log()
    })
  }

  getNextKey() {
    const availableKeys = this.keys.filter(key => this.cooldownTimes[key] <= Date.now());

    if (availableKeys.length === 0) {
      console.warn('[GROQ] All keys are currently in cooldown. Waiting...');
      // Fallback: Return any key if all are in cooldown (will likely fail, but prevents deadlock)
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
      return this.keys[this.currentIndex];
    }

    // Find the next key using round-robin among available keys
    let nextKeyIndex = -1;
    for (let i = 0; i < availableKeys.length; i++) {
      const potentialKey = availableKeys[(this.currentIndex + i) % availableKeys.length];
      if (this.cooldownTimes[potentialKey] <= Date.now()) {
        nextKeyIndex = this.keys.indexOf(potentialKey); // Get original index
        break;
      }
    }

    if (nextKeyIndex === -1) { // Should not happen if availableKeys.length > 0
      nextKeyIndex = this.keys.indexOf(availableKeys[0]);
    }

    this.currentIndex = nextKeyIndex;
    const key = this.keys[this.currentIndex];
    this.keyStats[key].attempts++;
    return key;
  }

  recordSuccess(key) {
    if (this.keyStats[key]) {
      this.keyStats[key].success++;
      this.cooldownTimes[key] = 0; // Clear cooldown on success
    }
  }

  recordFailure(key, errorType, cooldownMs) {
    if (this.keyStats[key]) {
      this.keyStats[key].failures++;
      // Set cooldown if it's a rate limit error
      if (errorType === 'rate_limit_exceeded') {
        const cd = cooldownMs ?? this.DEFAULT_COOLDOWN_MS;
        this.cooldownTimes[key] = Date.now() + cd;
        console.warn(`[GROQ] Key ...${key.slice(-6)} rate-limited, cooldown ${Math.round(cd / 1000)}s until ${new Date(Date.now() + cd).toISOString()}`);
      }
    }
  }
}
let groqManager
try {
  groqManager = new GroqKeyManager()
} catch (err) {
  console.error('[GROQ] Failed to initialize:', err.message)
  process.exit(1)
}

const BUILTIN_FEEDS = [
  { name: 'Google News Top Stories', type: 'rss', url: 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en' },
  { name: 'CNN World', type: 'rss', url: 'http://rss.cnn.com/rss/edition_world.rss' },
  { name: 'BBC World', type: 'rss', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'Reuters Top News', type: 'rss', url: 'https://www.reutersagency.com/feed/?post_type=best&post_type_best_topics=top-news&output=rss' },
  { name: 'France 24', type: 'rss', url: 'https://www.france24.com/en/rss' },
  { name: 'CBS News', type: 'rss', url: 'https://www.cbsnews.com/latest/rss/main' },
  { name: 'NPR News', type: 'rss', url: 'https://feeds.npr.org/1001/rss.xml' },
  { name: 'The Guardian International', type: 'rss', url: 'https://www.theguardian.com/world/rss' },
  { name: 'Sky News', type: 'rss', url: 'https://news.sky.com/tools/rss' },
  { name: 'Independent', type: 'rss', url: 'https://www.independent.co.uk/rss' }
]

// Tech-specific feeds
const TECH_FEEDS = [
  { id: 901, name: 'TechCrunch', type: 'rss', url: 'https://techcrunch.com/feed/', isTech: true },
  { id: 902, name: 'The Verge', type: 'rss', url: 'https://www.theverge.com/rss/index.xml', isTech: true },
  { id: 903, name: 'Ars Technica', type: 'rss', url: 'https://feeds.arstechnica.com/arstechnica/index', isTech: true },
  { id: 904, name: 'Wired', type: 'rss', url: 'https://www.wired.com/feed/rss', isTech: true },
  { id: 905, name: 'MIT Technology Review', type: 'rss', url: 'https://www.technologyreview.com/feed/', isTech: true },
  { id: 906, name: 'CNET', type: 'rss', url: 'https://www.cnet.com/rss/news/', isTech: true },
  { id: 907, name: 'Engadget', type: 'rss', url: 'https://www.engadget.com/rss.xml', isTech: true },
  { id: 908, name: 'ZDNet', type: 'rss', url: 'https://www.zdnet.com/topic/rss.xml', isTech: true },
]

// Football-specific feeds
const FOOTBALL_FEEDS = [
  { id: 911, name: 'BBC Football', type: 'rss', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', isFootball: true },
  { id: 912, name: 'Sky Sports Football', type: 'rss', url: 'https://www.skysports.com/rss/12040', isFootball: true },
  { id: 913, name: 'ESPN FC', type: 'rss', url: 'https://www.espn.com/espn/rss/soccer/news', isFootball: true },
  { id: 914, name: 'BBC Premier League', type: 'rss', url: 'https://feeds.bbci.co.uk/sport/football/premier-league/rss.xml', isFootball: true },
  { id: 915, name: '90min Football', type: 'rss', url: 'https://www.90min.com/posts.rss', isFootball: true },
  { id: 916, name: 'Football London', type: 'rss', url: 'https://www.football.london/?widget_name=football_london_rss_feed', isFootball: true },
]

// Konfigurasi rasio artikel per siklus crawl
const CRAWL_CONFIG = {
  TOTAL_BUDGET: 10,        // total artikel target per siklus
  TECH_RATIO: 0.05,        // 5% technology
  FOOTBALL_RATIO: 0.10,    // 10% football
  MAX_PER_SOURCE: 3,       // maks artikel diambil per sumber
}

const IMAGE_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'by', 'for', 'from', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'with', 'that', 'this', 'these', 'those', 'into', 'onto', 'about', 'after', 'before',
  'during', 'over', 'under', 'between', 'within', 'without', 'their', 'there', 'have', 'has', 'had', 'its',
  'will', 'would', 'could', 'should', 'said', 'says', 'say', 'new', 'latest', 'report', 'reports', 'amid',
  'issue', 'issues', 'release', 'releases', 'released', 'update', 'updates'
])

const CATEGORY_HINT_CACHE_TTL_MS = 10 * 60 * 1000
let categoryHintCache = {
  bySlug: new Map(),
  loadedAt: 0,
}

function extractMeaningfulTerms(text, limit = 8) {
  if (!text) return []

  const uniqueTerms = []
  const seen = new Set()
  const terms = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map(term => term.trim())
    .filter(term => term.length > 2 && !IMAGE_STOP_WORDS.has(term) && !/^\d+$/.test(term))

  for (const term of terms) {
    if (seen.has(term)) continue
    seen.add(term)
    uniqueTerms.push(term)
    if (uniqueTerms.length >= limit) break
  }

  return uniqueTerms
}

function sanitizeImageHint(text) {
  if (!text || typeof text !== 'string') return ''

  return text
    .replace(/^image\s*hint\s*[:\-]\s*/i, '')
    .replace(/[`*_#>\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

function buildFallbackImageHint(title = '', content = '') {
  const titleTerms = extractMeaningfulTerms(title, 5)
  const contentTerms = extractMeaningfulTerms(content, 7).filter(term => !titleTerms.includes(term))
  const terms = [...titleTerms, ...contentTerms.slice(0, 3)]

  return terms.slice(0, 6).join(' ').trim()
}

function buildContextualImageHint(aiImageHint = '', title = '', excerpt = '') {
  // Trust the AI hint — it was already prompted to be broad/contextual.
  // Just sanitize and use it directly; only fall back when it's empty.
  const sanitized = sanitizeImageHint(aiImageHint)
  if (sanitized.length >= 8) return sanitized

  return buildFallbackImageHint(title, excerpt)
}

function stripImageHintArtifacts(text = '') {
  if (!text) return ''

  return text
    .split('\n')
    .filter(line => !/^\s*image[_\s-]?hint\s*[:\-]/i.test(line.trim()))
    .join('\n')
    .replace(/(?:^|\n)\s*image[_\s-]?hint\s*[:\-]\s*[^\n]*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeCategoryKey(value) {
  return String(value || '').trim().toLowerCase()
}

function createCategoryHintTerms(categoryRow) {
  const combinedText = [categoryRow.slug, categoryRow.name, categoryRow.description]
    .filter(Boolean)
    .join(' ')

  return extractMeaningfulTerms(combinedText, 8)
}

async function loadCategoryHintCache(forceRefresh = false) {
  const now = Date.now()
  if (!forceRefresh && categoryHintCache.loadedAt && now - categoryHintCache.loadedAt < CATEGORY_HINT_CACHE_TTL_MS) {
    return categoryHintCache.bySlug
  }

  const result = await pool.query(`SELECT slug, name, description FROM categories`)
  const nextCache = new Map()

  for (const row of result.rows) {
    const terms = createCategoryHintTerms(row)
    if (row.slug) nextCache.set(normalizeCategoryKey(row.slug), terms)
    if (row.name) nextCache.set(normalizeCategoryKey(row.name), terms)
  }

  categoryHintCache = {
    bySlug: nextCache,
    loadedAt: now,
  }

  return categoryHintCache.bySlug
}

async function getCategoryImageHints(categories = []) {
  const normalizedCategories = [...new Set((categories || []).map(normalizeCategoryKey).filter(Boolean))]
  if (normalizedCategories.length === 0) return []

  try {
    const cache = await loadCategoryHintCache()
    const missingCategories = normalizedCategories.filter(category => !cache.has(category))

    if (missingCategories.length > 0) {
      await loadCategoryHintCache(true)
    }

    const refreshedCache = categoryHintCache.bySlug
    return [...new Set(normalizedCategories.flatMap(category => refreshedCache.get(category) || []))]
  } catch (error) {
    console.error('[IMAGE] Failed to load category hints from database:', error.message)
    return []
  }
}

async function ensureCategoriesExist(categoryNames = []) {
  const uniqueCategories = [...new Set((categoryNames || []).map(cat => String(cat || '').trim()).filter(Boolean))]
  const categoryRows = []

  for (const catName of uniqueCategories) {
    const catSlug = catName.toLowerCase().replace(/\s+/g, '-')
    const catResult = await pool.query(
      `INSERT INTO categories (name, slug)
       VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING *`,
      [catName, catSlug]
    )

    if (catResult.rows[0]) {
      categoryRows.push(catResult.rows[0])
    }
  }

  if (uniqueCategories.length > 0) {
    categoryHintCache.loadedAt = 0
  }

  return categoryRows
}

function normalizeImageUrl(url, baseUrl = '') {
  if (!url || typeof url !== 'string') return null
  if (url.startsWith('data:')) return null

  try {
    return new URL(url, baseUrl).href
  } catch {
    return null
  }
}

// Domains known to serve app icons / aggregator logos, not article photos
const BLOCKED_IMAGE_HOSTS = new Set([
  'news.google.com',
  'www.gstatic.com',
])

// Specific URL substrings that identify CDN-proxied app/platform icons
const BLOCKED_IMAGE_PATTERNS = [
  'logo', 'icon', '/icons/', 'avatar', 'sprite', 'placeholder',
  'favicon', 'advert', 'banner', 'app-image', 'brand-image',
  '/app/', 'touch-icon', 'apple-touch', 'badge', 'watermark',
]

function isLikelyUsableImage(url) {
  if (!url) return false
  const lowerUrl = url.toLowerCase()

  if (lowerUrl.endsWith('.ico') || lowerUrl.endsWith('.svg')) return false
  if (BLOCKED_IMAGE_PATTERNS.some(p => lowerUrl.includes(p))) return false

  try {
    const host = new URL(url).hostname.toLowerCase()
    if (BLOCKED_IMAGE_HOSTS.has(host)) return false
  } catch { }

  return true
}

function extractImageFromFeedItem(item) {
  if (!item) return null

  const directCandidates = [
    item.enclosure?.url,
    item.image?.url,
    item.thumbnail,
    item['media:thumbnail']?.url,
    item['media:content']?.url,
    Array.isArray(item['media:content']) ? item['media:content'][0]?.url : null,
  ]

  for (const candidate of directCandidates) {
    const normalized = normalizeImageUrl(candidate)
    if (isLikelyUsableImage(normalized)) return normalized
  }

  const htmlSources = [item.content, item['content:encoded'], item.summary]
    .filter(Boolean)
    .join(' ')

  const imgMatch = htmlSources.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (!imgMatch) return null

  const normalized = normalizeImageUrl(imgMatch[1])
  return isLikelyUsableImage(normalized) ? normalized : null
}

async function fetchSourceImage(sourceUrl) {
  if (!sourceUrl) return null

  try {
    const response = await axios.get(sourceUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000,
      maxRedirects: 5,
    })

    const $ = cheerio.load(response.data)
    const candidates = [
      $('meta[property="og:image:secure_url"]').attr('content'),
      $('meta[property="og:image"]').attr('content'),
      $('meta[name="twitter:image:src"]').attr('content'),
      $('meta[name="twitter:image"]').attr('content'),
      $('article img').first().attr('src'),
      $('main img').first().attr('src'),
      $('img').first().attr('src'),
    ]

    for (const candidate of candidates) {
      const normalized = normalizeImageUrl(candidate, sourceUrl)
      if (isLikelyUsableImage(normalized)) {
        console.log(`[IMAGE] Using source page image: ${normalized.slice(0, 80)}...`)
        return normalized
      }
    }
  } catch (error) {
    console.log(`[IMAGE] Source image lookup failed: ${error.message}`)
  }

  return null
}

async function buildUnsplashQueries({ title = '', excerpt = '', imageHint = '', categories = [], sourceName = '' }) {
  const titleTerms = extractMeaningfulTerms(title, 6)
  const excerptTerms = extractMeaningfulTerms(excerpt, 8).filter(term => !titleTerms.includes(term))
  const imageHintText = sanitizeImageHint(imageHint)
  const imageHintTerms = extractMeaningfulTerms(imageHintText, 6)
  const categoryHints = await getCategoryImageHints(categories)
  const combinedText = `${title} ${excerpt}`.toLowerCase()

  const queries = []

  // Highest priority: AI-generated hint (already contextual)
  if (imageHintText.length >= 8) queries.push(imageHintText)

  // Second: blend hint terms with strong title terms
  const blended = [...new Set([...imageHintTerms.slice(0, 3), ...titleTerms.slice(0, 3)])].join(' ').trim()
  if (blended.length >= 4) queries.push(blended)

  // Third: title terms alone
  const titleQuery = titleTerms.slice(0, 4).join(' ').trim()
  if (titleQuery.length >= 4) queries.push(titleQuery)

  // Fourth: topic-specific fallbacks based on article content
  if (/(attack|bomb|explos|shoot|kill|dead|wound|injur|terror|militant|hostage)/i.test(combinedText)) {
    queries.push('conflict explosion destruction military')
  }
  if (/(war|battle|troops|soldier|army|airstr|missile|weapon|front|ceasefire)/i.test(combinedText)) {
    queries.push('military soldiers armed forces war')
  }
  if (/(protest|demonstrat|riot|crowd|march|rally|clashes?)/i.test(combinedText)) {
    queries.push('protest crowd demonstration street')
  }
  if (/(sanction|condemn|statement|issued|declared|resolution|ceasefire)/i.test(combinedText)) {
    queries.push('government diplomacy statement press conference')
  }
  if (/(meeting|summit|visit|minister|president|secretary|parliament|diplom)/i.test(combinedText)) {
    queries.push('government diplomacy meeting')
  }
  if (/(market|trade|finance|earnings|startup|company|investor|stock)/i.test(combinedText)) {
    queries.push('business finance market')
  }
  if (/(technology|tech|software|chip|robot|cyber|digital|\bai\b)/i.test(combinedText)) {
    queries.push('technology innovation digital')
  }
  if (/(climate|forest|ocean|emission|wildlife|environment)/i.test(combinedText)) {
    queries.push('climate environment nature')
  }
  if (/(health|medical|hospital|vaccine|disease|wellness)/i.test(combinedText)) {
    queries.push('healthcare medical hospital')
  }
  if (/(sport|football|soccer|match|league|athlete|team)/i.test(combinedText)) {
    queries.push('sports football match stadium')
  }
  if (/(election|vote|ballot|campaign|candidate|democracy|poll)/i.test(combinedText)) {
    queries.push('election politics voting democracy')
  }
  if (/(earthquake|flood|hurricane|disaster|tsunami|wildfire|storm)/i.test(combinedText)) {
    queries.push('natural disaster emergency crisis')
  }

  // Final fallback: category hints or generic news
  if (categoryHints.length > 0) {
    queries.push(categoryHints.slice(0, 3).join(' ').trim())
  }
  queries.push('world news international')

  return [...new Set(queries.map(q => q.replace(/\s+/g, ' ').trim()).filter(q => q.length >= 4))].slice(0, 5)
}

function scoreUnsplashResult(result, { primaryTerms = [], secondaryTerms = [], categoryHints = [] }) {
  const searchableText = [
    result.alt_description || '',
    result.description || '',
    result.slug || '',
    Array.isArray(result.tags) ? result.tags.map(tag => tag.title || '').join(' ') : '',
  ].join(' ').toLowerCase()

  let score = 0
  if (!searchableText.trim()) score -= 2

  primaryTerms.forEach((term, index) => {
    if (searchableText.includes(term)) score += index < 3 ? 12 : 6
  })

  secondaryTerms.forEach(term => {
    if (searchableText.includes(term)) score += 4
  })

  categoryHints.forEach(term => {
    if (searchableText.includes(term)) score += 3
  })

  if (result.width > result.height) score += 2
  if (typeof result.likes === 'number') score += Math.min(result.likes / 100, 3)

  return score
}

async function fetchImageFromUnsplash(context) {
  try {
    const unsplashKey = process.env.UNSPLASH_API_KEY
    if (!unsplashKey) {
      console.log("[DEBUG] UNSPLASH_API_KEY not set, skipping image fetch")
      return null
    }

    const imageContext = typeof context === 'string' ? { title: context } : (context || {})
    const categoryHints = await getCategoryImageHints(imageContext.categories)
    const queries = await buildUnsplashQueries(imageContext)
    const imageHintTerms = extractMeaningfulTerms(sanitizeImageHint(imageContext.imageHint), 6)
    const titleTerms = extractMeaningfulTerms(imageContext.title, 6)
    const primaryTerms = [...new Set([...imageHintTerms, ...titleTerms])]
    const secondaryTerms = extractMeaningfulTerms(imageContext.excerpt, 8).filter(term => !primaryTerms.includes(term))

    for (const query of queries) {
      console.log(`[IMAGE] Searching Unsplash for: "${query}"`)
      const response = await axios.get('https://api.unsplash.com/search/photos', {
        params: {
          query,
          per_page: 8,
          orientation: 'landscape',
          content_filter: 'high',
          order_by: 'relevant'
        },
        headers: {
          'Authorization': `Client-ID ${unsplashKey}`
        },
        timeout: 10000
      })

      const results = Array.isArray(response.data.results) ? response.data.results : []
      if (results.length === 0) {
        console.log(`✗ No image results for: "${query}"`)
        continue
      }

      const scored = results
        .map(result => ({
          result,
          score: scoreUnsplashResult(result, { primaryTerms, secondaryTerms, categoryHints })
        }))
        .sort((a, b) => b.score - a.score)

      const bestMatch = scored[0]

      // Require a minimum positive score so we don't use completely unrelated images
      if (bestMatch?.result?.urls?.regular && bestMatch.score >= 0) {
        const imageUrl = bestMatch.result.urls.regular
        console.log(`✓ Selected image (query="${query}", score ${bestMatch.score.toFixed(1)}): ${imageUrl.slice(0, 60)}...`)
        return imageUrl
      }
    }

    console.log('✗ No suitable Unsplash image found')
    return null
  } catch (error) {
    console.error("[ERROR] Unsplash fetch:", error.message)
    return null
  }
}

async function ensureUniqueFeaturedImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return null

  const normalizedImageUrl = imageUrl.trim()
  if (!normalizedImageUrl) return null

  try {
    const existingImage = await pool.query(
      "SELECT id FROM articles WHERE LOWER(TRIM(featured_image)) = LOWER(TRIM($1)) LIMIT 1",
      [normalizedImageUrl]
    )

    if (existingImage.rows.length > 0) {
      console.log(`[IMAGE] Duplicate featured image detected, clearing image: ${normalizedImageUrl.slice(0, 80)}`)
      return null
    }

    return normalizedImageUrl
  } catch (error) {
    console.error('[IMAGE] Failed to validate featured image uniqueness:', error.message)
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
      sourceUrl: url,
      sourceImage: extractImageFromFeedItem(item)
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

async function generateArticle(title, sourceContent, sourceUrl, _attempt = 0) {
  // Groq-only (no fallback)
  const groqKey = groqManager.getNextKey()
  const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-20b'

  const prompt = `You are a professional news journalist. Write a comprehensive news article based on the source below.

Source Title: ${title}
Source Content: ${sourceContent.slice(0, 2000)}

OUTPUT FORMAT (follow exactly):
1. First line: A SPECIFIC, SEO-friendly headline (55-80 chars)
   - Structure: Subject + Verb + Object (e.g., "[Who] [Does/Announces/Wins] [What]")
   - Must mention WHO and WHAT specifically (name, organization, country, topic)
   - Must be descriptive enough to stand alone without reading the article
   - Use present tense or past participle (e.g., "Launches", "Signs", "Warns", "Passed")
   - Do NOT start with "The", "A", or "An" — start with a proper noun, organization, or country name
   - Do NOT write a body sentence (e.g., "The root of the crisis lies in...") — write a headline
   - BAD examples: "The Courtesy Visit", "Breaking News", "A Momentum Shift", "The legal case is unprecedented"
   - GOOD examples: "ASEAN Secretary-General Meets UN University Network Chief in Jakarta", "South Africa Composer Sues Comedian Over Lion King Chant Misrepresentation", "UN Votes to Label Transatlantic Slave Trade as Gravest Crime Against Humanity"
2. Blank line
3. Second line: IMAGE_HINT: 4-8 keywords in English for photo search
  - Must be concrete visual concepts (scene/object/action), but keep it broad and contextual
  - Avoid specific names of people, organizations, or exact locations
  - Avoid generic words: "news", "update", "breaking"
  - Example: IMAGE_HINT: diplomatic meeting conference room discussion
4. Blank line
5. Article body in MARKDOWN (minimum 800 words)
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
      /^image[_\s-]?hint\s*[:\-]/i,
      /^(format|instructions|example|aim for|provide|include|return only|keep neutral)/i,
      /^\*\*(important|note|output|format|instructions?)\*\*/i,
    ]

    let aiImageHint = ''
    let rawLines = fullContent.split('\n')

    for (let i = 0; i < Math.min(rawLines.length, 12); i++) {
      const line = rawLines[i].trim()
      const match = line.match(/^image[_\s-]?hint\s*[:\-]\s*(.+)$/i)
      if (match && match[1]) {
        aiImageHint = sanitizeImageHint(match[1])
        rawLines.splice(i, 1)
        break
      }
    }

    if (!aiImageHint) {
      const inlineHintMatch = fullContent.match(/image[_\s-]?hint\s*[:\-]\s*([^\n]+)/i)
      if (inlineHintMatch && inlineHintMatch[1]) {
        aiImageHint = sanitizeImageHint(inlineHintMatch[1])
      }
    }

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
    let cleanContent = stripImageHintArtifacts(contentLines.join('\n').trim())

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

    cleanContent = stripImageHintArtifacts(cleanContent)

    // Buang heading template generik jika masih lolos dari model
    const templatedHeadingPattern = /^#{1,3}\s*(introduction|background|overview|conclusion|summary|context|analysis|key takeaways?|final thoughts?)\s*:?$/i
    cleanContent = cleanContent
      .split('\n')
      .filter(line => !templatedHeadingPattern.test(line.trim()))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    cleanContent = stripImageHintArtifacts(cleanContent)

    // === EXTRACT SEO HEADLINE ===
    let seoHeadline = null
    const finalLines = cleanContent.split('\n')

    // Pola heading/headline yang terlalu generik / tidak SEO
    const genericSectionTitles = /^(introduction|background|overview|conclusion|summary|context|analysis|details?|contents?|breaking news|news brief|latest news|update|report|the (latest|news|update|report|visit|meeting|event|announcement|statement|development))\b/i
    // Pola kalimat isi artikel (bukan headline): "The X is/was/lies/has/carries...", "A X is..."
    const bodySentencePattern = /^(the|a|an)\s+\w+(\s+\w+)?\s+(is|was|are|were|has|have|lies|lie|carries|carry|remain|remains|shows?|shows?|indicates?|suggests?|reveals?|comes?|came|goes?|went|continues?|started?|began?|became?|includes?|involves?|affects?)\b/i
    // Headline valid: 50-120 char, bukan generik, bukan pola kalimat isi
    const isValidHeadline = (s) => s.length >= 50 && s.length <= 120 && !genericSectionTitles.test(s) && !bodySentencePattern.test(s)

    let seenHeading = false
    for (const line of finalLines.slice(0, 5)) {
      const trimmed = line.trim()
      if (!trimmed) continue

      if (trimmed.startsWith('#')) {
        seenHeading = true
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
      } else if (!seenHeading && !trimmed.startsWith('-') && !trimmed.startsWith('|') && !trimmed.startsWith('#')) {
        // Only use plain text as headline if no heading has been seen yet (i.e. it truly is the first line)
        const candidate = trimmed.replace(/\*\*/g, '').trim()
        if (isValidHeadline(candidate)) {
          seoHeadline = candidate
          cleanContent = finalLines.filter(l => l.trim() !== trimmed).join('\n').trim()
          break
        }
      }
    }

    // Fallback 1: gunakan source title yang sudah dibersihkan
    if (!seoHeadline || !isValidHeadline(seoHeadline)) {
      seoHeadline = title.split(' - ')[0].replace(/\s*[-|:]\s*$/, '').trim().slice(0, 95)
      console.log('[HEADLINE] Fell back to source title')
    }

    // Fallback 2 (last resort): coba ambil kalimat pertama dari paragraf pembuka artikel
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
    const finalImageHint = buildContextualImageHint(aiImageHint, seoHeadline, excerpt)

    return {
      title: seoHeadline,  // Use extracted SEO headline instead of source title
      content: cleanContent,
      excerpt,
      image_hint: finalImageHint,
      author: 'AI News Editor',
      tokens: { prompt: usage.prompt_tokens, completion: usage.completion_tokens, total: usage.total_tokens },
      cost: (usage.total_tokens || 0) * 0.000001,
      model: groqModel,
      format: 'markdown'
    }
    groqManager.recordSuccess(groqKey)
  } catch (err) {
    const status = err.response?.status
    const errData = err.response?.data
    const errCode = errData?.error?.code || errData?.error?.type || ''
    if (status === 429 || errCode === 'rate_limit_exceeded') {
      // Parse retry-after duration from Groq error message
      const msg = errData?.error?.message || ''
      let cooldownMs = groqManager.DEFAULT_COOLDOWN_MS
      const retryMatch = msg.match(/try again in (?:(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:([\d.]+)s)?)/i)
      if (retryMatch) {
        const h = parseFloat(retryMatch[1] || 0)
        const m = parseFloat(retryMatch[2] || 0)
        const s = parseFloat(retryMatch[3] || 0)
        cooldownMs = Math.ceil((h * 3600 + m * 60 + s) * 1000) + 5000 // +5s buffer
      }
      groqManager.recordFailure(groqKey, 'rate_limit_exceeded', cooldownMs)
      const maxAttempts = groqManager.keys.length
      if (_attempt < maxAttempts - 1) {
        console.warn(`[GROQ] Rate limited (attempt ${_attempt + 1}/${maxAttempts}). Retrying with next key...`)
        return generateArticle(title, sourceContent, sourceUrl, _attempt + 1)
      }
      console.error(`[GROQ] All ${maxAttempts} keys rate-limited. Giving up on: "${title.slice(0, 50)}"`)
    }
    console.error('Groq API error:', errData || err.message)
    throw err
  }
}

function detectCategory(title, content) {
  const text = (title + ' ' + content).toLowerCase()

  // Priority keywords: checked first — if matched, skip business/others to prevent false positives
  const priorityKeywords = {
    'world': [
      'earthquake', 'tsunami', 'hurricane', 'tornado', 'typhoon', 'cyclone',
      'flood', 'flooding', 'wildfire', 'volcano', 'eruption', 'avalanche',
      'disaster', 'fatality', 'fatalities', 'casualties', 'death toll',
      'magnitude', 'richter', 'seismic', 'tremor', 'aftershock',
      'war', 'conflict', 'invasion', 'bombing', 'airstrike', 'missile',
      'shooting', 'explosion', 'attack', 'massacre', 'famine', 'refugee',
      'humanitarian', 'ceasefire', 'troops', 'military operation'
    ],
    'environment': [
      'climate change', 'global warming', 'carbon', 'emission', 'pollution',
      'deforestation', 'biodiversity', 'extinction', 'glacier', 'sea level'
    ]
  }

  const keywords = {
    'technology': ['technology', 'tech', 'digital', 'ai', 'software', 'app', 'code', 'programming', 'cyber', 'internet', 'data'],
    'business': ['business', 'market', 'trade', 'commerce', 'company', 'corporate', 'economy', 'finance', 'stock', 'investor'],
    'sports': ['sport', 'football', 'soccer', 'game', 'athlete', 'championship', 'match', 'league', 'player', 'team'],
    'health': ['health', 'medical', 'doctor', 'disease', 'hospital', 'vaccine', 'covid', 'pandemic', 'treatment', 'wellness'],
    'entertainment': ['entertainment', 'movie', 'music', 'celebrity', 'actor', 'film', 'show', 'series', 'hollywood', 'drama'],
    'politics': ['politics', 'government', 'election', 'president', 'parliament', 'law', 'vote', 'congress', 'senator', 'minister']
  }

  const categories = []

  // Check priority keywords first
  for (const [cat, words] of Object.entries(priorityKeywords)) {
    if (words.some(w => text.includes(w))) {
      categories.push(cat)
    }
  }

  // If a priority category (world/environment) was matched, skip secondary keywords
  // to prevent unrelated matches (e.g. 'trade' in a disaster article → 'business')
  if (categories.length === 0) {
    for (const [cat, words] of Object.entries(keywords)) {
      if (words.some(w => text.includes(w))) {
        categories.push(cat)
      }
    }
  }

  return categories.length > 0 ? categories : null // Return null to trigger AI classification
}

async function classifyArticleWithAI(title, excerpt) {
  const groqKey = groqManager.getNextKey()
  try {
    const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-20b'

    // More strict prompt that forces output format
    const prompt = `Categorize this news article. Choose 1-3 categories from the preferred list below. Only use a custom category if NONE of the preferred ones fit.
Preferred categories: world, politics, business, technology, health, sports, entertainment, environment, science, education, crime, society

Rules:
- For natural disasters (earthquake, flood, hurricane, etc.) → use: world
- For wars, conflicts, international events → use: world
- For company news, economy, stocks, trade → use: business
- Respond with ONLY category names, lowercase, separated by commas. No other text.

Title: ${title}
Excerpt: ${excerpt}

Example output: world
Your output:`

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: groqModel,
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 30,
        temperature: 0.3
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
    const status = error.response?.status
    const errData = error.response?.data
    const errCode = errData?.error?.code || errData?.error?.type || ''
    if (status === 429 || errCode === 'rate_limit_exceeded') {
      const msg = errData?.error?.message || ''
      let cooldownMs = groqManager.DEFAULT_COOLDOWN_MS
      const retryMatch = msg.match(/try again in (?:(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:([\d.]+)s)?)/i)
      if (retryMatch) {
        const h = parseFloat(retryMatch[1] || 0)
        const m = parseFloat(retryMatch[2] || 0)
        const s = parseFloat(retryMatch[3] || 0)
        cooldownMs = Math.ceil((h * 3600 + m * 60 + s) * 1000) + 5000
      }
      groqManager.recordFailure(groqKey, 'rate_limit_exceeded', cooldownMs)
    }
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
      // Verifikasi 0: Cek source_url sudah pernah di-simpan (paling kuat — mencegah duplikat lintas feed)
      if (article.link) {
        // Normalisasi URL: buang query string tracking agar variasi URL dianggap sama
        let normalizedLink = article.link.trim()
        try {
          const u = new URL(normalizedLink)
            // Hapus parameter tracking umum
            ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
              'ref', 'referrer', 'source', 'via', 'from'].forEach(p => u.searchParams.delete(p))
          normalizedLink = u.origin + u.pathname + (u.search !== '?' ? u.search : '') + u.hash
          normalizedLink = normalizedLink.replace(/\/$/, '') // hapus trailing slash
        } catch { }

        const existingUrl = await pool.query(
          "SELECT id FROM articles WHERE LOWER(TRIM(source_url)) = LOWER(TRIM($1)) LIMIT 1",
          [normalizedLink]
        )
        if (existingUrl.rows.length > 0) {
          console.log(`[DUP-CHECK-0] Skipping already-saved source_url: ${normalizedLink.slice(0, 80)}`)
          continue
        }
        // Simpan back normalized link agar pengecekan berikutnya konsisten
        article.link = normalizedLink
      }

      // Verifikasi 1: Cek judul source sudah pernah di-process (backup check)
      const existingSource = await pool.query(
        "SELECT id FROM articles WHERE LOWER(TRIM(title)) = LOWER(TRIM($1))",
        [article.title]
      )
      if (existingSource.rows.length > 0) {
        console.log(`[DUP-CHECK-1] Skipping duplicate source title: ${article.title.slice(0, 60)}`)
        continue
      }
      console.log(`[PROCESS] Source check passed for ${source.name}: ${article.title}`)


      const generated = await generateArticle(article.title, article.content, article.link)

      // Verifikasi 2: Cek judul artikel yang sudah di-generate
      const existingGenerated = await pool.query(
        "SELECT id FROM articles WHERE LOWER(TRIM(title)) = LOWER(TRIM($1))",
        [generated.title]
      )
      if (existingGenerated.rows.length > 0) {
        console.log(`[DUP-CHECK-2] Skipping duplicate generated title: ${generated.title.slice(0, 60)}`)
        continue
      }
      console.log(`[DUP-CHECK-2] PASS - new generated title`)

      // Verifikasi 3: Cek similarity pada excerpt (similar text check)
      const existingSimilar = await pool.query(
        "SELECT id, excerpt FROM articles WHERE excerpt LIKE $1 LIMIT 1",
        [`%${generated.excerpt.slice(0, 60)}%`]
      )
      if (existingSimilar.rows.length > 0) {
        console.log(`[DUP-CHECK-3] Skipping similar excerpt: ${generated.excerpt.slice(0, 60)}`)
        continue
      }
      console.log(`[DUP-CHECK-3] PASS - unique excerpt`)

      // Auto-categorize with hybrid approach (keyword + AI)
      let categories = detectCategory(generated.title, generated.content) || []

      // Always use AI classification to find more specific categories
      console.log("[AI Classification] Analyzing article for additional categories...")
      const aiCategories = await classifyArticleWithAI(generated.title, generated.excerpt)

      // Merge keyword categories + AI suggestions + forced categories (e.g. 'technology' for tech sources)
      const allCategories = [...new Set([...categories, ...aiCategories, ...forcedCategories])]
      console.log(`[Categorization] Final categories: ${allCategories.join(', ')}`)

      const categoryRows = await ensureCategoriesExist(allCategories)

      // Prefer source/article image first, then fallback to a more contextual Unsplash search
      const featuredImage =
        article.sourceImage ||
        await fetchSourceImage(article.link) ||
        await fetchImageFromUnsplash({
          title: generated.title,
          excerpt: generated.excerpt,
          imageHint: generated.image_hint,
          categories: categoryRows.map(cat => cat.slug || cat.name),
          sourceName: source.name,
        })

      const uniqueFeaturedImage = await ensureUniqueFeaturedImage(featuredImage)

      const saved = await pool.query(
        `INSERT INTO articles 
         (title, content, source_url, source_name, published_at, is_published, ai_model, prompt_tokens, completion_tokens, total_tokens, estimated_cost, excerpt, author, featured_image, language)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
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
          uniqueFeaturedImage,
          'en'
        ]
      )

      for (const cat of categoryRows) {
        try {
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
  return BUILTIN_FEEDS.map((f, i) => ({
    id: f.id || 1000 + i + 1,
    name: f.name,
    type: f.type,
    url: f.url,
  }))
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
