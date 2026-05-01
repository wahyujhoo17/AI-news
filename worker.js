require('dotenv').config()
const cron = require('node-cron')
const axios = require('axios')

// ── Google Indexing API ───────────────────────────────────────────────────────
const { GoogleAuth } = require('google-auth-library')
let _googleAuthClient = null

async function getGoogleAuthClient() {
  if (_googleAuthClient) return _googleAuthClient
  try {
    const auth = new GoogleAuth({
      keyFile: '/var/www/ai-news/google-indexing-key.json',
      scopes: ['https://www.googleapis.com/auth/indexing'],
    })
    _googleAuthClient = await auth.getClient()
    return _googleAuthClient
  } catch (err) {
    console.error('[INDEXING] Failed to init Google Auth:', err.message)
    return null
  }
}

async function notifyBingIndexing(url) {
  const apiKey = process.env.BING_WEBMASTER_API_KEY
  if (!apiKey) return
  try {
    const res = await axios.post(
      `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch?apikey=${apiKey}`,
      { siteUrl: 'https://qbitznews.com', urlList: [url] },
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
    )
    console.log(`[BING] Notified: ${url.slice(0, 70)} → ${res.data?.d || 'OK'}`)
  } catch (err) {
    console.error(`[BING] Failed for ${url.slice(0, 70)}: ${err.message}`)
  }
}

async function notifyGoogleIndexing(url) {
  try {
    const client = await getGoogleAuthClient()
    if (!client) return
    const res = await client.request({
      url: 'https://indexing.googleapis.com/v3/urlNotifications:publish',
      method: 'POST',
      data: { url, type: 'URL_UPDATED' },
    })
    console.log(`[INDEXING] Notified Google: ${url.slice(0, 70)} → ${res.data?.urlNotificationMetadata?.url ? 'OK' : JSON.stringify(res.data)}`)
  } catch (err) {
    console.error(`[INDEXING] Failed for ${url.slice(0, 70)}: ${err.message}`)
  }
}
// ─────────────────────────────────────────────────────────────────────────────

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
  { name: 'BBC World', type: 'rss', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', noSourceImage: true },
  { name: 'Reuters Top News', type: 'rss', url: 'https://www.reutersagency.com/feed/?post_type=best&post_type_best_topics=top-news&output=rss' },
  { name: 'France 24', type: 'rss', url: 'https://www.france24.com/en/rss' },
  { name: 'CBS News', type: 'rss', url: 'https://www.cbsnews.com/latest/rss/main' },
  { name: 'NPR News', type: 'rss', url: 'https://feeds.npr.org/1001/rss.xml' },
  { name: 'The Guardian International', type: 'rss', url: 'https://www.theguardian.com/world/rss' },
  { name: 'Sky News', type: 'rss', url: 'https://news.sky.com/tools/rss', noSourceImage: true },
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

// AI-specific feeds
const AI_FEEDS = [
  { id: 921, name: 'VentureBeat AI', type: 'rss', url: 'https://venturebeat.com/category/ai/feed/', isAI: true },
  { id: 922, name: 'AI News', type: 'rss', url: 'https://www.artificialintelligence-news.com/feed/', isAI: true },
  { id: 923, name: 'The Decoder', type: 'rss', url: 'https://the-decoder.com/feed/', isAI: true },
  { id: 924, name: 'AI Business', type: 'rss', url: 'https://aibusiness.com/rss.xml', isAI: true },
  { id: 925, name: 'MIT AI News', type: 'rss', url: 'https://news.mit.edu/topic/mitartificial-intelligence2-rss.xml', isAI: true },
]

// Blockchain/Crypto-specific feeds
const CRYPTO_FEEDS = [
  { id: 931, name: 'CoinDesk', type: 'rss', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', isCrypto: true },
  { id: 932, name: 'Decrypt', type: 'rss', url: 'https://decrypt.co/feed', isCrypto: true },
  { id: 933, name: 'CoinTelegraph', type: 'rss', url: 'https://cointelegraph.com/rss', isCrypto: true },
  { id: 934, name: 'Bitcoin Magazine', type: 'rss', url: 'https://bitcoinmagazine.com/feed', isCrypto: true },
  { id: 935, name: 'The Block', type: 'rss', url: 'https://www.theblock.co/rss.xml', isCrypto: true },
]

// Football-specific feeds
const FOOTBALL_FEEDS = [
  { id: 911, name: 'BBC Football', type: 'rss', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', isFootball: true, noSourceImage: true },
  { id: 912, name: 'Sky Sports Football', type: 'rss', url: 'https://www.skysports.com/rss/12040', isFootball: true },
  { id: 913, name: 'ESPN FC', type: 'rss', url: 'https://www.espn.com/espn/rss/soccer/news', isFootball: true },
  { id: 914, name: 'BBC Premier League', type: 'rss', url: 'https://feeds.bbci.co.uk/sport/football/premier-league/rss.xml', isFootball: true, noSourceImage: true },
  { id: 915, name: '90min Football', type: 'rss', url: 'https://www.90min.com/posts.rss', isFootball: true },
  { id: 916, name: 'Football London', type: 'rss', url: 'https://www.football.london/?widget_name=football_london_rss_feed', isFootball: true },
]

// Konfigurasi rasio artikel per siklus crawl
const CRAWL_CONFIG = {
  TOTAL_BUDGET: 12,        // total artikel target per siklus (naik dari 10)
  TECH_RATIO: 0.20,        // 20% technology
  AI_RATIO: 0.20,          // 20% AI
  CRYPTO_RATIO: 0.15,      // 15% blockchain/crypto
  FOOTBALL_RATIO: 0.10,    // 10% football
  // General = sisa = 35%
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
    .filter(line => {
      // Strip ** dulu sebelum cek, supaya **EXCERPT:** juga tertangkap
      const t = line.trim().replace(/\*\*/g, '')
      return !/^\s*image[_\s-]?hint\s*[:\-]/i.test(t)
        && !/^\s*excerpt\s*[:\-]/i.test(t)
        && !/^\s*category\s*[:\-]/i.test(t)
    })
    .join('\n')
    // Handle inline kombinasi dalam satu baris, termasuk bold format
    .replace(/\*?\*?image[_\s-]?hint\*?\*?\s*[:\-]\s*[^\n]*/gi, '')
    .replace(/\*?\*?excerpt\*?\*?\s*[:\-]\s*[^\n]*/gi, '')
    .replace(/\*?\*?category\*?\*?\s*[:\-]\s*[^\n]*/gi, '')
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

async function fetchFullArticleContent(url) {
  try {
    const response = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 15000,
      maxContentLength: 700 * 1024,
      maxBodyLength: 700 * 1024,
    });
    const $ = cheerio.load(response.data);
    
    // Selector prioritas untuk konten artikel
    const selectors = [
      "article", 
      ".post-content", 
      ".entry-content", 
      ".story-content",
      ".article-content", 
      ".content", 
      "main",
      "[role=\"main\"]"
    ];
    
    let content = "";
    for (const sel of selectors) {
      const el = $(sel).first();
      if (el.length) {
        // Ambil semua paragraf dalam elemen tersebut
        const paragraphs = el.find("p").map((i, p) => $(p).text().trim()).get();
        content = paragraphs.join(" ").replace(/\s+/g, " ").trim();
        if (content.length > 300) {
          console.log(`[FULL-CONTENT] Found content with selector "${sel}", length: ${content.length} chars`);
          break;
        }
      }
    }
    
    // Fallback: ambil semua paragraf di body jika selector di atas tidak menghasilkan cukup teks
    if (content.length < 300) {
      const allParagraphs = $("body p").map((i, p) => $(p).text().trim()).get();
      content = allParagraphs.join(" ").replace(/\s+/g, " ").trim();
      console.log(`[FULL-CONTENT] Fallback to body paragraphs, length: ${content.length} chars`);
    }
    
    // Potong jika terlalu panjang (max 10000 chars untuk efisiensi)
    if (content.length > 10000) {
      content = content.substring(0, 10000) + "...";
    }
    
    return content;
  } catch (error) {
    console.error("[FULL-CONTENT] Error fetching full article:", error.message);
    return "";
  }
}

async function generateArticle(title, sourceContent, sourceUrl, _attempt = 0) {
  // Groq-only (no fallback)
  const groqKey = groqManager.getNextKey()
  const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-20b'

  const prompt = `You are a professional news journalist. Write a comprehensive news article based on the source below.

Source Title: ${title}
Source Content: ${sourceContent.slice(0, 2000)}

OUTPUT FORMAT — respond with exactly these labeled sections, nothing else:

HEADLINE: Write SEO headline here — plain text, no asterisks, no markdown (55-80 chars)
IMAGE_HINT: 4-8 English keywords for Unsplash (concrete visuals only, no names/orgs)
EXCERPT: Compelling 1-2 sentence teaser — plain text, no asterisks (120-155 chars)
CATEGORY: One of: Technology | Business | Sports | Football | Health | Entertainment | Politics | Environment | Education | Crime | Crypto | General | Music | Science | AI (choose the best fit, or General if unsure)
ARTICLE:
Article body in Markdown starts here (minimum 500 words)

HEADLINE RULES:
- Subject + Verb + Object, starts with proper noun/org/country (NOT "The", "A", "An")
- Power words: Reveals, Warns, Slams, Exposes, Confirms, Surges, Collapses, Breaks
- Numbers/data when available: "Study Finds 73% of...", "5 Countries That..."
- Must prioritize Entities over Concepts (e.g., "Nvidia Market Cap Surges" is better than "AI Stock Market Surges")
- NO asterisks (**), NO bold formatting, plain text only
- GOOD: "Chelsea Drops Fernandez After Heated Exchange Shocks Club Insiders"
- BAD: "**U.S. Labor Market Surges**", "Breaking News", "The Courtesy Visit"

EXCERPT RULES:
- Add new angle/tension — do NOT repeat the headline
- NO asterisks, NO markdown, plain text only
- Do NOT start with: "This article", "In this piece", "Learn about", "Read"

ARTICLE RULES:
- Journalistic flow, minimum 500 words.
- WRITE LIKE A HUMAN: Vary sentence structures and lengths. Avoid robotic transitions.
- AVOID AI CLICHÉS: Never use phrases like "In today's digital age," "It is important to note," "In conclusion," or "A testament to."
- Add unique analytical value, industry context, or implications instead of just rewriting the source.
- Headings OPTIONAL (max 2), NEVER: Introduction, Background, Conclusion, Summary.
- Tables/diagrams only for structured data.
- Bold (**text**) sparingly, only when it adds clarity.
- Lede: The first paragraph must answer Who, What, Where, When, and Why in under 35 words.
- Global Context: Provide 1-2 paragraphs explaining how this news affects the global market or international community.

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

    // === NEW STRUCTURED PARSER: baca field HEADLINE:/IMAGE_HINT:/EXCERPT:/CATEGORY:/ARTICLE: ===
    let aiImageHint = ''
    let aiHeadlineField = ''
    let aiExcerptField = ''
    let aiCategoryField = ''
    let aiArticleBody = ''

    // Coba parse format terstruktur baru
    const headlineMatch = fullContent.match(/^HEADLINE:\s*(.+)$/im)
    const imageHintMatch = fullContent.match(/^IMAGE_HINT:\s*(.+)$/im)
    const excerptMatch = fullContent.match(/^EXCERPT:\s*(.+)$/im)
    const categoryMatch = fullContent.match(/^CATEGORY:\s*(.+)$/im)
    const articleMatch = fullContent.match(/^ARTICLE:\s*\n([\s\S]+)/im)

    const isStructured = !!(headlineMatch && articleMatch)

    if (isStructured) {
      aiHeadlineField = headlineMatch[1].trim().replace(/\*\*/g, '').replace(/\*/g, '').trim()
      aiImageHint = imageHintMatch ? sanitizeImageHint(imageHintMatch[1]) : ''
      aiExcerptField = excerptMatch ? excerptMatch[1].trim() : ''
      aiCategoryField = categoryMatch ? categoryMatch[1].trim() : ''
      aiArticleBody = articleMatch[1].trim()
      console.log('[PARSE] Structured format detected')
    } else {
      // Fallback: legacy parsing
      console.log('[PARSE] Fallback to legacy parsing')
    }

    let rawLines = (isStructured ? aiArticleBody : fullContent).split('\n')

    if (!isStructured) {
      // Legacy: scan IMAGE_HINT dari rawLines
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

    // Kalau structured format, langsung pakai HEADLINE: field
    if (isStructured && aiHeadlineField && aiHeadlineField.length >= 20) {
      seoHeadline = aiHeadlineField
      console.log(`[HEADLINE] Using structured HEADLINE field: ${seoHeadline.slice(0, 70)}`)
    }

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

    // Strip markdown bold/italic dari judul
    seoHeadline = seoHeadline.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/, '').trim()
    console.log(`[HEADLINE] Extracted SEO headline (${seoHeadline.length} chars): ${seoHeadline.slice(0, 70)}`)

    // === EXTRACT EXCERPT: prioritas dari structured field ===
    let excerpt = ''
    if (isStructured && aiExcerptField && aiExcerptField.length > 30) {
      excerpt = aiExcerptField.replace(/\*\*/g, '').trim()
      console.log(`[EXCERPT] Using structured EXCERPT field (${excerpt.length} chars)`)
    } else {
      const excerptFieldMatch = rawContent.match(/^EXCERPT:\s*(.+)$/m)
      if (excerptFieldMatch && excerptFieldMatch[1].trim().length > 30) {
        excerpt = excerptFieldMatch[1].trim().replace(/\*\*/g, '').trim()
        console.log(`[EXCERPT] Using AI-generated excerpt (${excerpt.length} chars)`)
      } else {
        // Fallback: ambil dari paragraf pertama konten bersih
        const excerptLines = cleanContent.split('\n').filter(l => l.trim())
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
        console.log(`[EXCERPT] Using fallback paragraph excerpt`)
      }
    } // end else (non-structured excerpt)
    // Trim to max 155 chars for meta description
    // Potong excerpt di batas kalimat atau batas kata, max 155 chars
    if (excerpt.length > 155) {
      const sentenceEnd = excerpt.slice(0, 155).search(/[.!?][^.!?]*$/)
      if (sentenceEnd > 80) {
        excerpt = excerpt.slice(0, sentenceEnd + 1).trim()
      } else {
        excerpt = excerpt.slice(0, 152).replace(/\s+\S*$/, '').trimEnd() + '...'
      }
    }

    const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    const finishReason = data.choices?.[0]?.finish_reason || ''
    const finalImageHint = buildContextualImageHint(aiImageHint, seoHeadline, excerpt)

    // ── Validasi kelengkapan artikel ──────────────────────────────────────
    // 1. API melaporkan output terpotong karena token habis
    if (finishReason === 'length') {
      throw new Error(`Article truncated (finish_reason=length) — not saved: "${seoHeadline.slice(0, 60)}"`)
    }

    // 2. Konten terlalu pendek — AI gagal/terpotong
    const wordCount = cleanContent.split(/\s+/).filter(Boolean).length
    if (wordCount < 200) {
      throw new Error(`Content too short (${wordCount} words, min 200) — not saved: "${seoHeadline.slice(0, 60)}"`)
    }

    // 3. Kalimat terakhir terpotong
    const trimmedClean = cleanContent.trimEnd()
    const lastChar = trimmedClean.slice(-1)
    const lastLine = trimmedClean.split('\n').pop()?.trim() || ''
    const incompleteEnding = !/[.!?"'\)\]»\*\-a-zA-Z0-9]/.test(lastChar)
    const endsWithConjunction = /,\s*$|\b(and|or|but|the|a|an|in|on|at|to|for|of|with)\s*$/i.test(lastLine)
    if (incompleteEnding || endsWithConjunction) {
      throw new Error(`Content incomplete (truncated sentence) — not saved: "${seoHeadline.slice(0, 60)}"`)
    }

    groqManager.recordSuccess(groqKey)
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
      // Fallback ke OpenRouter jika tersedia
      if (process.env.OPENROUTER_API_KEY_GLOBAL) {
        console.log('[GROQ→OR] Falling back to OpenRouter...')
        return generateArticleOpenRouter(title, sourceContent, sourceUrl)
      }
    }
    console.error('Groq API error:', errData || err.message)
    throw err
  }
}

// Fallback: OpenRouter untuk saat Groq TPD habis
async function generateArticleOpenRouter(title, sourceContent, sourceUrl) {
  const OPENROUTER_FALLBACK_MODELS = [
    'z-ai/glm-4.5-air:free',
    'stepfun/step-3.5-flash:free',
    'meta-llama/llama-3.3-8b-instruct:free',
    'mistralai/mistral-7b-instruct:free',
    'google/gemma-3-4b-it:free',
    'qwen/qwen3-8b:free',
    'microsoft/phi-4-reasoning-plus:free',
  ]
  // Rotate through all models until one succeeds
  let lastErr = null
  for (const model of OPENROUTER_FALLBACK_MODELS) {
    // Same structured format as main generateArticle
    const prompt = `You are a professional news journalist. Write a comprehensive news article based on the source below.



Source Title: ${title}
Source Content: ${sourceContent.slice(0, 2000)}

OUTPUT FORMAT — respond with exactly these labeled sections, nothing else:

HEADLINE: Write SEO headline here — plain text, no asterisks, no markdown (55-80 chars)
IMAGE_HINT: 4-8 English keywords for Unsplash (concrete visuals only, no names/orgs)
EXCERPT: Compelling 1-2 sentence teaser — plain text, no asterisks (120-155 chars)
CATEGORY: One of: Technology | Business | Sports | Football | Health | Entertainment | Politics | Environment | Education | Crime | Crypto | General
ARTICLE:
Article body in Markdown starts here (minimum 500 words)

HEADLINE RULES:
- Subject + Verb + Object, starts with proper noun/org/country (NOT "The", "A", "An")
- NO asterisks (**), NO bold formatting, plain text only
- GOOD: "US F-15E Fighter Jet Downed Over Iran as Tehran Releases Wreckage"
- BAD: "**US F-15E Jet Shot Down**", "Breaking News"

EXCERPT RULES:
- Plain text only — NO asterisks, NO markdown
- Do NOT start with "This article", "Learn about", "Read"

ARTICLE RULES:
- Minimum 500 words, journalistic tone
- Do NOT include HEADLINE/EXCERPT/IMAGE_HINT/CATEGORY labels inside the article body

Begin:`

    try {
      const res = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        { model, messages: [{ role: 'user', content: prompt }], max_tokens: 4096, temperature: 0.7 },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY_GLOBAL}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://qbitznews.com',
            'X-Title': 'QbitzNews Global Worker Fallback',
          },
          timeout: 120000
        }
      )
      const text = res.data?.choices?.[0]?.message?.content || ''
      if (!text) throw new Error('Empty OpenRouter response')
      console.log(`[OR-FALLBACK] Generated via ${model}: ${title.slice(0, 50)}`)
      // Structured parser — sama dengan generateArticle
      const orHeadlineMatch = text.match(/^HEADLINE:\s*(.+)$/im)
      const orImageHintMatch = text.match(/^IMAGE_HINT:\s*(.+)$/im)
      const orExcerptMatch = text.match(/^EXCERPT:\s*(.+)$/im)
      const orCategoryMatch = text.match(/^CATEGORY:\s*(.+)$/im)
      const orArticleMatch = text.match(/^ARTICLE:\s*\n([\s\S]+)/im)

      let orHeadline = orHeadlineMatch ? orHeadlineMatch[1].trim().replace(/\*\*/g, '').replace(/\*/g, '').trim() : ''
      let orExcerpt = orExcerptMatch ? orExcerptMatch[1].trim().replace(/\*\*/g, '').trim() : ''
      let orImageHint = orImageHintMatch ? orImageHintMatch[1].trim().replace(/\*\*/g, '').trim() : ''
      let orCategory = orCategoryMatch ? orCategoryMatch[1].trim() : ''
      let orBody = orArticleMatch ? orArticleMatch[1].trim() : ''

      // Fallback kalau model tidak ikuti format terstruktur
      if (!orHeadline || !orBody) {
        console.warn('[OR-FALLBACK] Model did not follow structured format, using legacy parse')
        const orLines = text.split('\n')
        let orBodyStart = 0
        for (let i = 0; i < Math.min(orLines.length, 15); i++) {
          const ln = orLines[i].trim().replace(/\*\*/g, '')
          if (!ln) continue
          if (/^excerpt\s*[:\-]/i.test(ln)) { orExcerpt = orExcerpt || ln.replace(/^\*?\*?excerpt\*?\*?\s*[:\-]\s*/i, '').trim(); continue }
          if (/^image[_\s-]?hint\s*[:\-]/i.test(ln)) { orImageHint = orImageHint || ln.replace(/^\*?\*?image[_\s-]?hint\*?\*?\s*[:\-]\s*/i, '').trim(); continue }
          if (/^category\s*[:\-]/i.test(ln)) { orCategory = orCategory || ln.replace(/^\*?\*?category\*?\*?\s*[:\-]\s*/i, '').trim(); continue }
          if (/^headline\s*[:\-]/i.test(ln)) { orHeadline = orHeadline || ln.replace(/^\*?\*?headline\*?\*?\s*[:\-]\s*/i, '').trim(); continue }
          if (!orHeadline && ln.length > 15) { orHeadline = ln.replace(/^#+\s*/, '').trim(); orBodyStart = i + 1; continue }
        }
        if (!orBody) {
          orBody = orLines.slice(orBodyStart).join('\n')
        }
      }

      // Final cleanup body dari sisa metadata
      orBody = stripImageHintArtifacts(orBody)
      if (!orHeadline) orHeadline = title
      return {
        title: orHeadline,
        content: orBody,
        excerpt: orExcerpt || orBody.split('\n').find(l => l.trim().length > 50) || '',
        image_hint: orImageHint || title.split(' ').slice(0, 4).join(' '),
        author: 'AI News Editor',
        tokens: { prompt: 0, completion: 0, total: 0 },
        cost: 0,
        model: model,
        format: 'markdown',
      }
    } catch (err) {
      lastErr = err
      const status = err?.response?.status
      if (status === 429 || status === 503 || status === 500 || !err.response) {
        console.warn(`[OR-FALLBACK] Model ${model} failed (${status || err.message}), trying next...`)
        continue
      }
      // Non-rate-limit error, stop immediately
      console.error(`[OR-FALLBACK] Fatal on ${model}: ${err.message}`)
      throw err
    }
  } // end for loop
  // All models exhausted
  console.error(`[OR-FALLBACK] All ${OPENROUTER_FALLBACK_MODELS.length} models exhausted for: "${title.slice(0, 60)}"`)
  throw lastErr || new Error('All OpenRouter fallback models exhausted')
}

function detectCategory(title, content) {
  const text = (title + ' ' + content).toLowerCase()

  // Priority keywords: checked first — if matched, restricts which secondary keywords can add
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
      'climate change', 'global warming', 'carbon emission', 'pollution',
      'deforestation', 'biodiversity', 'extinction', 'glacier', 'sea level',
      'renewable energy', 'solar panel', 'wind turbine', 'carbon footprint'
    ],
    'sports': [
      'sport', 'athlete', 'olympic', 'medal', 'championship', 'tournament',
      'league', 'match', 'fixture', 'squad', 'standings', 'season', 'club',
      'player', 'team', 'stadium', 'coach', 'referee', 'penalty', 'offside',
      'football', 'soccer', 'striker', 'midfielder', 'goalkeeper', 'defender',
      'winger', 'transfer window', 'signing', 'relegated', 'promotion', 'manager',
      'premier league', 'bundesliga', 'la liga', 'serie a', 'champions league',
      'europa league', 'world cup', 'euro', 'copa america', 'fa cup',
      'basketball', 'tennis', 'cricket', 'rugby', 'golf', 'boxing', 'swimming',
      'cycling', 'grand slam', 'wimbledon', 'super bowl', 'nfl', 'nba', 'mlb',
      'nhl', 'motogp', 'formula 1'
    ],
    'religion': [
      'easter', 'christmas', 'ramadan', 'eid', 'diwali', 'hanukkah', 'passover',
      'sermon', 'pope', 'vatican', 'bishop', 'cardinal', 'archbishop', 'priest',
      'mosque', 'church', 'temple', 'synagogue', 'cathedral', 'holy', 'prayer',
      'pilgrimage', 'baptism', 'mass', 'liturgy', 'scripture', 'gospel',
      'imam', 'rabbi', 'monk', 'nun', 'faith', 'worship', 'congregation',
      'theology', 'denomination', 'protestant', 'catholic', 'muslim', 'jewish',
      'buddhist', 'hindu', 'christian'
    ]
  }

  const keywords = {
    'technology': [
      'technology', 'software', 'hardware', 'programming', 'cybersecurity',
      'internet', 'smartphone', 'laptop', 'processor', 'semiconductor',
      'cloud computing', 'machine learning', 'neural network', 'deep learning',
      'robotics', 'automation', 'virtual reality', 'augmented reality',
      'quantum computing', 'open source', 'developer', 'startup tech',
      'artificial intelligence', 'chatbot', 'large language model', 'llm',
      'generative ai', 'computer vision', 'algorithm', 'data science'
    ],
    'crypto': [
      'bitcoin', 'ethereum', 'blockchain', 'cryptocurrency', 'crypto',
      'defi', 'nft', 'web3', 'token', 'wallet', 'exchange', 'binance',
      'coinbase', 'altcoin', 'stablecoin', 'mining', 'staking', 'dao',
      'smart contract', 'metaverse', 'solana', 'ripple', 'dogecoin'
    ],
    'business': [
      'business', 'market', 'trade', 'commerce', 'company', 'corporate',
      'economy', 'finance', 'stock', 'investor', 'startup', 'revenue',
      'profit', 'earnings', 'acquisition', 'merger', 'ipo', 'valuation',
      'gdp', 'inflation', 'interest rate', 'federal reserve', 'wall street'
    ],
    'health': [
      'health', 'medical', 'doctor', 'disease', 'hospital', 'vaccine',
      'covid', 'pandemic', 'treatment', 'wellness', 'surgery', 'cancer',
      'diabetes', 'mental health', 'nutrition', 'drug', 'clinical trial',
      'fda', 'who', 'epidemic', 'virus', 'bacteria', 'pharmacy'
    ],
    'entertainment': [
      'entertainment', 'movie', 'music', 'celebrity', 'actor', 'film',
      'show', 'series', 'hollywood', 'drama', 'concert', 'album', 'award',
      'oscar', 'grammy', 'netflix', 'streaming', 'box office', 'director',
      'singer', 'band', 'tour', 'trailer', 'premiere', 'comic'
    ],
    'politics': [
      'politics', 'government', 'election', 'president', 'parliament',
      'law', 'vote', 'congress', 'senator', 'minister', 'democrat',
      'republican', 'white house', 'kremlin', 'nato', 'un', 'sanction',
      'treaty', 'diplomacy', 'foreign policy', 'tariff', 'legislation',
      'supreme court', 'governor', 'mayor', 'campaign', 'ballot'
    ],
    'science': [
      'science', 'research', 'study', 'discovery', 'experiment', 'nasa',
      'space', 'astronomy', 'physics', 'chemistry', 'biology', 'genetics',
      'genome', 'fossil', 'species', 'marine', 'ocean', 'planet', 'asteroid',
      'telescope', 'laboratory', 'scientist', 'professor', 'university'
    ]
  }

  const categories = []

  // Check priority keywords first (whole-word matching for short terms)
  for (const [cat, words] of Object.entries(priorityKeywords)) {
    if (words.some(w => {
      // Use word boundary for short words (< 5 chars) to avoid false matches
      if (w.length < 5) {
        const regex = new RegExp(`\\b${w}\\b`, 'i')
        return regex.test(text)
      }
      return text.includes(w)
    })) {
      categories.push(cat)
    }
  }

  const hasPriority = categories.length > 0

  if (!hasPriority) {
    // No priority match: check all secondary keywords
    for (const [cat, words] of Object.entries(keywords)) {
      if (words.some(w => {
        if (w.length < 4) {
          const regex = new RegExp(`\\b${w}\\b`, 'i')
          return regex.test(text)
        }
        return text.includes(w)
      })) categories.push(cat)
    }
  } else {
    // Priority matched: only allow technology/politics/health/crypto/science as additions
    for (const cat of ['technology', 'politics', 'health', 'crypto', 'science']) {
      if (keywords[cat]?.some(w => {
        if (w.length < 4) {
          const regex = new RegExp(`\\b${w}\\b`, 'i')
          return regex.test(text)
        }
        return text.includes(w)
      })) categories.push(cat)
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
Preferred categories: world, politics, business, technology, health, sports, entertainment, environment, science, education, crime, society, religion, crypto

Rules:
- For natural disasters (earthquake, flood, hurricane, etc.) → use: world
- For wars, conflicts, international events → use: world
- For company news, economy, stocks, trade → use: business
- For religious events, sermons, pope, church, mosque, faith → use: religion
- For bitcoin, ethereum, blockchain, crypto, defi, nft → use: crypto
- For AI, machine learning, neural networks, chatbots → use: technology
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
  
  // Filter artikel usang: abaikan artikel yang lebih tua dari 7 hari
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const freshArticles = [];
  for (const article of articles) {
    const pubDate = article.pubDate ? new Date(article.pubDate) : new Date();
    if (pubDate >= sevenDaysAgo) {
      freshArticles.push(article);
    }
  }
  articles = freshArticles;

  if (articles.length === 0) {
    console.log("No articles found for", source.name)
    if (source.id < 900) await logCrawl(source.id, "completed", undefined, 0)
    return 0
  }

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


      // Fallback scraping: jika konten RSS terlalu pendek, coba ambil konten lengkap dari URL artikel
      let sourceContent = article.content;
      if (sourceContent.length < 500 && article.link && article.link.startsWith("http")) {
        console.log("[FALLBACK] RSS content too short (" + sourceContent.length + " chars), fetching full article from " + article.link.slice(0,80) + "...");
        const fullContent = await fetchFullArticleContent(article.link);
        if (fullContent && fullContent.length > sourceContent.length) {
          console.log("[FALLBACK] Using full content (" + fullContent.length + " chars, +" + (fullContent.length - sourceContent.length) + " more)");
          sourceContent = fullContent;
        } else {
          console.log("[FALLBACK] Full content fetch failed or not longer, using original RSS content");
        }
      }

      console.log(`[CONTENT-LENGTH] Source content length: ${sourceContent.length} chars`);
      if (sourceContent.length < 300) {
        console.log(`[SKIP] Source content too short (${sourceContent.length} chars), skipping`);
        continue;
      }

            const generated = await generateArticle(article.title, sourceContent, article.link)

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

      // Filter AI suggestions to prevent false positives:
      // - If sports was keyword-detected, don't let AI add business/entertainment
      // - If world/environment was keyword-detected, don't let AI add business
      let filteredAiCategories = aiCategories
      if (categories.includes('sports')) {
        filteredAiCategories = filteredAiCategories.filter(c => !['business', 'entertainment'].includes(c))
      }
      if (categories.includes('world') || categories.includes('environment')) {
        filteredAiCategories = filteredAiCategories.filter(c => c !== 'business')
      }

      // Merge keyword categories + AI suggestions + forced categories (e.g. 'technology' for tech sources)
      const allCategories = [...new Set([...categories, ...filteredAiCategories, ...forcedCategories])]
      console.log(`[Categorization] Final categories: ${allCategories.join(', ')}`)

      const categoryRows = await ensureCategoriesExist(allCategories)

      // Prefer source/article image first, unless noSourceImage=true (avoid watermarked images from BBC, Sky, etc)
      // then fallback to a more contextual Unsplash search
      const featuredImage = source.noSourceImage
        ? await fetchImageFromUnsplash({
          title: generated.title,
          excerpt: generated.excerpt,
          imageHint: generated.image_hint,
          categories: categoryRows.map(cat => cat.slug || cat.name),
          sourceName: source.name,
        })
        : (
          article.sourceImage ||
          await fetchSourceImage(article.link) ||
          await fetchImageFromUnsplash({
            title: generated.title,
            excerpt: generated.excerpt,
            imageHint: generated.image_hint,
            categories: categoryRows.map(cat => cat.slug || cat.name),
            sourceName: source.name,
          })
        )

      const uniqueFeaturedImage = await ensureUniqueFeaturedImage(featuredImage)

      // Final sanity check: jangan simpan kalau title masih ada metadata leak
      const titleHasLeak = /^\*{1,2}(EXCERPT|IMAGE_HINT|CATEGORY|HEADLINE)\*{0,2}[:\-]/i.test(generated.title) || /^(EXCERPT|IMAGE_HINT|CATEGORY)\s*[:\-]/i.test(generated.title)
      if (titleHasLeak) {
        console.error(`[SANITY] Skipping article with metadata in title: "${generated.title.slice(0, 60)}"`)
        continue
      }
      const contentHasHeaderLeak = /^(HEADLINE|EXCERPT|IMAGE_HINT|CATEGORY|ARTICLE)\s*[:\-]/im.test(generated.content)
      if (contentHasHeaderLeak) {
        generated.content = generated.content
          .replace(/^\*?\*?(HEADLINE|EXCERPT|IMAGE_HINT|CATEGORY)\*?\*?\s*[:\-][^\n]*/gim, '')
          .replace(/^\*?\*?ARTICLE\*?\*?\s*:?\s*\n/gim, '')
          .replace(/\n{3,}/g, '\n\n').trim()
        console.warn(`[SANITY] Cleaned residual metadata from content of: "${generated.title.slice(0, 60)}"`)
      }

      const saved = await pool.query(
        `INSERT INTO articles 
         (title, content, source_url, source_name, published_at, is_published, ai_model, prompt_tokens, completion_tokens, total_tokens, estimated_cost, excerpt, author, featured_image, language, category)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
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
          'en',
          categoryRows.map(c => c.name).join(', ')
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
      // Notify Google Indexing API
      // Build full slug URL (same as frontend buildArticlePath) to avoid 308 redirect
      const articleId = saved.rows[0].id
      const articleTitle = saved.rows[0].title || ''
      const titleSlug = articleTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const articleUrl = titleSlug
        ? `https://qbitznews.com/articles/${articleId}-${titleSlug}`
        : `https://qbitznews.com/articles/${articleId}`
      // notifyGoogleIndexing(articleUrl).catch(() => { }) // Dinonaktifkan: Google Indexing API untuk berita menyebabkan penalti SEO
      notifyBingIndexing(articleUrl).catch(() => { })
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
  const aiBudget = probabilisticBudget(CRAWL_CONFIG.TOTAL_BUDGET, CRAWL_CONFIG.AI_RATIO)
  const cryptoBudget = probabilisticBudget(CRAWL_CONFIG.TOTAL_BUDGET, CRAWL_CONFIG.CRYPTO_RATIO)
  const footballBudget = probabilisticBudget(CRAWL_CONFIG.TOTAL_BUDGET, CRAWL_CONFIG.FOOTBALL_RATIO)
  const generalBudget = Math.max(0, CRAWL_CONFIG.TOTAL_BUDGET - techBudget - aiBudget - cryptoBudget - footballBudget)

  console.log(`[BUDGET] Cycle target: ${CRAWL_CONFIG.TOTAL_BUDGET} | Tech: ${techBudget} (20%) | AI: ${aiBudget} (20%) | Crypto: ${cryptoBudget} (15%) | Football: ${footballBudget} (10%) | General: ${generalBudget} (35%)`)

  try {
    // ── 20% TECH SOURCES ──────────────────────────────────────────
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

    // ── 20% AI SOURCES ────────────────────────────────────────────
    let aiGenerated = 0
    const shuffledAI = [...AI_FEEDS].sort(() => Math.random() - 0.5)

    for (const source of shuffledAI) {
      if (aiGenerated >= aiBudget) break
      const remaining = aiBudget - aiGenerated
      const count = await processSource(source, {
        maxArticles: Math.min(remaining, CRAWL_CONFIG.MAX_PER_SOURCE),
        forcedCategories: ['technology', 'ai']
      })
      aiGenerated += count
    }
    console.log(`[BUDGET] AI selesai: ${aiGenerated}/${aiBudget} artikel`)

    // ── 15% CRYPTO SOURCES ────────────────────────────────────────
    let cryptoGenerated = 0
    const shuffledCrypto = [...CRYPTO_FEEDS].sort(() => Math.random() - 0.5)

    for (const source of shuffledCrypto) {
      if (cryptoGenerated >= cryptoBudget) break
      const remaining = cryptoBudget - cryptoGenerated
      const count = await processSource(source, {
        maxArticles: Math.min(remaining, CRAWL_CONFIG.MAX_PER_SOURCE),
        forcedCategories: ['crypto', 'blockchain']
      })
      cryptoGenerated += count
    }
    console.log(`[BUDGET] Crypto selesai: ${cryptoGenerated}/${cryptoBudget} artikel`)

    // ── 10% FOOTBALL SOURCES ──────────────────────────────────────
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

    // ── 35% GENERAL SOURCES ───────────────────────────────────────
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

    const totalGenerated = techGenerated + aiGenerated + cryptoGenerated + footballGenerated + generalGenerated
    console.log(`[BUDGET] Total siklus ini: ${totalGenerated} artikel (tech: ${techGenerated}, ai: ${aiGenerated}, crypto: ${cryptoGenerated}, football: ${footballGenerated}, general: ${generalGenerated})`)
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
