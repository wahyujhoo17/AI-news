/**
 * worker-id.js — Indonesian Language News Worker
 * Mengambil berita dari sumber Indonesia + internasional (crypto, teknologi, dll.)
 * lalu menulis ulang dalam bahasa Indonesia menggunakan Google Gemini AI.
 * Artikel disimpan dengan language='id'.
 */

require('dotenv').config()
const cron = require('node-cron')
const axios = require('axios')
const Parser = require('rss-parser')
const { pool } = require('./lib/db-worker')

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL_ID || 'openai/gpt-4o-mini'
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

console.log('[ID-WORKER] Starting Indonesian news worker (OpenRouter AI)')
console.log('[ID-WORKER] Model:', OPENROUTER_MODEL)
if (!OPENROUTER_API_KEY) console.error('[ID-WORKER] WARNING: OPENROUTER_API_KEY not set!')

// ============================================
// RSS SOURCES — Indonesia + International
// ============================================
const ID_FEEDS = [
    // ===== INDONESIA =====
    { id: 'id-001', name: 'Detik News', url: 'https://news.detik.com/rss' },
    { id: 'id-002', name: 'Antara News', url: 'https://www.antaranews.com/rss/terkini.rss' },
    { id: 'id-003', name: 'Tempo', url: 'https://rss.tempo.co/nasional' },
    { id: 'id-004', name: 'Kompas', url: 'https://rss.kompas.com/rss/get?x.format=rss&x.query=nasional' },
    { id: 'id-005', name: 'CNN Indonesia', url: 'https://www.cnnindonesia.com/rss' },
    { id: 'id-006', name: 'Republika', url: 'https://www.republika.co.id/rss' },
    { id: 'id-007', name: 'Okezone', url: 'https://news.okezone.com/feed' },
    { id: 'id-008', name: 'Tribun News', url: 'https://www.tribunnews.com/rss' },
    { id: 'id-009', name: 'Google News ID', url: 'https://news.google.com/rss?hl=id&gl=ID&ceid=ID:id' },
    { id: 'id-010', name: 'Jakarta Post', url: 'https://www.thejakartapost.com/feed' },

    // ===== CRYPTO & BLOCKCHAIN =====
    { id: 'cr-001', name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
    { id: 'cr-002', name: 'CoinTelegraph', url: 'https://cointelegraph.com/rss' },
    { id: 'cr-003', name: 'Decrypt', url: 'https://decrypt.co/feed' },
    { id: 'cr-004', name: 'The Block', url: 'https://www.theblock.co/rss.xml' },

    // ===== TEKNOLOGI =====
    { id: 'tc-001', name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
    { id: 'tc-002', name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
    { id: 'tc-003', name: 'Wired', url: 'https://www.wired.com/feed/rss' },
    { id: 'tc-004', name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
    { id: 'tc-005', name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/' },
    { id: 'tc-006', name: 'VentureBeat', url: 'https://venturebeat.com/feed/' },

    // ===== BISNIS & EKONOMI GLOBAL =====
    { id: 'bz-001', name: 'Reuters Business', url: 'https://feeds.reuters.com/reuters/businessNews' },
    { id: 'bz-002', name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },

    // ===== OLAHRAGA & SEPAK BOLA =====
    { id: 'sp-001', name: 'Bola.net', url: 'https://www.bola.net/rss/rss.html' },
    { id: 'sp-002', name: 'Bola.com', url: 'https://www.bola.com/rss' },
    { id: 'sp-003', name: 'Goal Indonesia', url: 'https://www.goal.com/id/news/feed' },
    { id: 'sp-004', name: 'Liputan6 Bola', url: 'https://www.liputan6.com/rss/bola' },
    { id: 'sp-005', name: 'Tribun Sport', url: 'https://www.tribunnews.com/rss/sport' },
    { id: 'sp-006', name: 'ESPN FC', url: 'https://www.espn.com/espn/rss/soccer/news' },
]

const CRAWL_CONFIG = {
    TOTAL_BUDGET: 10,
    MAX_PER_SOURCE: 2,
}

// ============================================
// HELPERS
// ============================================
async function fetchRSS(url) {
    try {
        const parser = new Parser({ timeout: 15000 })
        const feed = await parser.parseURL(url)
        return (feed.items || []).map(item => ({
            title: item.title || 'Untitled',
            content: item.contentSnippet || item.content || item.description || '',
            link: item.link || '',
            pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        }))
    } catch (error) {
        console.error(`[ID-WORKER] RSS fetch error (${url.slice(0, 60)}): ${error.message}`)
        return []
    }
}

async function generateArticleWithOpenRouter(sourceTitle, sourceContent, sourceName) {
    const prompt = `Kamu adalah jurnalis profesional Indonesia untuk portal berita digital qbitznews.com. Sumber berikut mungkin dalam bahasa Inggris — terjemahkan dan kembangkan sepenuhnya dalam bahasa Indonesia.

---
JUDUL SUMBER: ${sourceTitle}
KONTEN SUMBER: ${sourceContent.slice(0, 2500)}
---

FORMAT OUTPUT (ikuti persis, tanpa tambahan apapun):
BARIS 1: Judul artikel SEO-friendly (55-90 karakter)
  - Spesifik: sebut siapa/apa/angka penting
  - Gunakan kata kerja aktif: Luncurkan, Capai, Catat, Umumkan, Lampaui, dll.
  - JANGAN mulai dengan: "The", "A", "An", "Sebuah", "Ini adalah"
  - Contoh BAIK: "Bitcoin Tembus $100.000 Pertama Kalinya dalam Sejarah"
  - Contoh BURUK: "Perkembangan Bitcoin yang Menarik"
BARIS 2: (kosong)
BARIS 3: IMAGE_HINT: 4-6 kata bahasa Inggris untuk foto (contoh: "bitcoin cryptocurrency market chart")
BARIS 4: (kosong)
BARIS 5-dst: Isi artikel (minimal 700 kata) dalam Markdown
  - Gaya: jurnalistik profesional, bahasa formal tapi mudah dipahami
  - Sertakan: konteks, dampak bagi Indonesia, data/angka jika relevan
  - Heading jika topik membutuhkan struktur (## untuk sub-judul)
  - JANGAN heading generik: "Pendahuluan", "Kesimpulan", "Latar Belakang"
  - Akhiri dengan paragraf penutup yang kuat

PENTING untuk IMAGE_HINT:
  - WAJIB dalam bahasa Inggris (digunakan untuk mencari foto di Unsplash)
  - Hindari nama orang/kota spesifik — gunakan konsep visual yang bisa dicari
  - Contoh BAIK: "football stadium crowd match", "bitcoin cryptocurrency chart", "government parliament meeting"
  - Contoh BURUK: "pertandingan sepakbola indonesia", "jakarta berita terkini"

Mulai langsung dari BARIS 1 (judul), tanpa preamble, tanpa penjelasan format.`

    try {
        const response = await axios.post(
            OPENROUTER_ENDPOINT,
            {
                model: OPENROUTER_MODEL,
                messages: [
                    { role: 'system', content: 'Kamu adalah jurnalis profesional Indonesia. Selalu mulai langsung dengan judul. Output hanya Markdown valid. Jangan tambahkan preamble, penjelasan, atau komentar apapun.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 3500,
                temperature: 0.7,
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://qbitznews.com',
                    'X-Title': 'QbitzNews Indonesian Worker',
                },
                timeout: 120000
            }
        )

        const fullContent = response.data?.choices?.[0]?.message?.content || ''
        if (!fullContent) throw new Error('Empty content from OpenRouter')

        // Parse IMAGE_HINT
        let aiImageHint = ''
        const rawLines = fullContent.split('\n')
        for (let i = 0; i < Math.min(rawLines.length, 12); i++) {
            const match = rawLines[i].trim().match(/^image[_\s-]?hint\s*[:\-]\s*(.+)$/i)
            if (match) { aiImageHint = match[1].trim(); rawLines.splice(i, 1); break }
        }

        // Extract title (first non-empty line)
        let title = ''
        let contentStartIndex = 0
        for (let i = 0; i < Math.min(rawLines.length, 8); i++) {
            const line = rawLines[i].trim()
            if (!line) continue
            title = line.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim()
            contentStartIndex = i + 1
            break
        }
        if (!title || title.length < 20) title = sourceTitle.split(' - ')[0].trim().slice(0, 90)
        if (title.length > 95) title = title.slice(0, 92).trim() + '...'

        // Clean body
        const bodyLines = rawLines.slice(contentStartIndex)
        while (bodyLines.length > 0 && !bodyLines[0].trim()) bodyLines.shift()
        let content = bodyLines.join('\n').trim()
        content = content.replace(/^image[_\s-]?hint\s*[:\-][^\n]*/gim, '').replace(/\n{3,}/g, '\n\n').trim()

        // Extract excerpt
        let excerpt = ''
        for (const line of content.split('\n')) {
            const t = line.trim()
            if (!t || t.startsWith('#') || t.startsWith('|') || t.startsWith('-') || t.startsWith('*')) continue
            excerpt = t.replace(/\*\*/g, '').trim()
            break
        }
        if (!excerpt) excerpt = `Baca artikel lengkap tentang ${title}.`
        excerpt = excerpt.split('. ').slice(0, 2).join('. ')
        if (!excerpt.endsWith('.')) excerpt += '.'

        const usage = response.data?.usage || {}
        return {
            title,
            content,
            excerpt,
            image_hint: aiImageHint || title.split(' ').slice(0, 5).join(' '),
            tokens: { prompt: usage.prompt_tokens || 0, completion: usage.completion_tokens || 0, total: usage.total_tokens || 0 },
            cost: (usage.total_tokens || 0) * 0.00000015,
            model: OPENROUTER_MODEL,
        }
    } catch (err) {
        if (err.response?.status === 429) {
            console.warn('[ID-WORKER] OpenRouter rate limit — waiting 30s')
            await new Promise(r => setTimeout(r, 30000))
        }
        console.error(`[ID-WORKER] OpenRouter error (${err.response?.status || 'network'}): ${err.response?.data?.error?.message || err.message}`)
        throw err
    }
}

// ============================================
// IMAGE HELPERS (ported & adapted from worker.js)
// ============================================
const IMAGE_STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'by', 'for', 'from', 'is', 'are', 'was', 'were',
    'be', 'been', 'being', 'with', 'that', 'this', 'these', 'those', 'into', 'onto', 'about', 'after', 'before',
    'during', 'over', 'under', 'between', 'within', 'without', 'their', 'there', 'have', 'has', 'had', 'its',
    'will', 'would', 'could', 'should', 'said', 'says', 'say', 'new', 'latest', 'report', 'reports', 'amid',
    // Indonesian stopwords (to strip if AI slips into Indonesian)
    'yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'ada', 'dengan', 'untuk', 'pada', 'oleh', 'atau',
    'juga', 'tidak', 'bisa', 'akan', 'sudah', 'lebih', 'jika', 'saat', 'para', 'atas', 'bagi', 'serta',
])

function extractMeaningfulTerms(text, limit = 8) {
    if (!text) return []
    const uniqueTerms = []
    const seen = new Set()
    const terms = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .map(t => t.trim())
        .filter(t => t.length > 2 && !IMAGE_STOP_WORDS.has(t) && !/^\d+$/.test(t))
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

async function fetchImageFromUnsplash(context) {
    const key = process.env.UNSPLASH_API_KEY
    if (!key) return null

    const ctx = typeof context === 'string' ? { imageHint: context } : (context || {})
    const imageHintText = sanitizeImageHint(ctx.imageHint || '')
    const imageHintTerms = extractMeaningfulTerms(imageHintText, 6)
    const titleTerms = extractMeaningfulTerms(ctx.title || '', 6)
    const primaryTerms = [...new Set([...imageHintTerms, ...titleTerms])]
    const excerptTerms = extractMeaningfulTerms(ctx.excerpt || '', 8).filter(t => !primaryTerms.includes(t))
    const cats = (ctx.categories || []).join(' ').toLowerCase()

    // Build multi-query strategy (highest to lowest priority)
    const queries = []

    // 1. AI-generated hint (should be English per prompt)
    if (imageHintText.length >= 6) queries.push(imageHintText)

    // 2. Blend hint + title terms
    const blended = [...new Set([...imageHintTerms.slice(0, 3), ...titleTerms.slice(0, 3)])].join(' ').trim()
    if (blended.length >= 4 && blended !== imageHintText) queries.push(blended)

    // 3. Title terms only
    const titleQuery = titleTerms.slice(0, 4).join(' ').trim()
    if (titleQuery.length >= 4) queries.push(titleQuery)

    // 4. Category-based topic fallbacks
    if (cats.includes('olahraga') || cats.includes('bola') || cats.includes('sepak')) {
        queries.push('football soccer match stadium crowd')
    } else if (cats.includes('kripto') || cats.includes('blockchain')) {
        queries.push('cryptocurrency bitcoin blockchain trading')
    } else if (cats.includes('teknologi')) {
        queries.push('technology innovation artificial intelligence')
    } else if (cats.includes('politik')) {
        queries.push('government politics parliament diplomacy')
    } else if (cats.includes('ekonomi') || cats.includes('bisnis')) {
        queries.push('business finance economy market')
    } else if (cats.includes('kesehatan')) {
        queries.push('healthcare medical hospital doctor')
    } else if (cats.includes('hiburan')) {
        queries.push('entertainment concert music performance')
    } else if (cats.includes('lingkungan')) {
        queries.push('nature environment forest climate')
    } else if (cats.includes('hukum') || cats.includes('kriminal')) {
        queries.push('law court justice government')
    } else if (cats.includes('pendidikan')) {
        queries.push('education school university students')
    }

    // 5. Final fallback
    queries.push('indonesia news current events')

    const uniqueQueries = [...new Set(queries.filter(q => q.length >= 4))].slice(0, 5)

    for (const query of uniqueQueries) {
        try {
            const response = await axios.get('https://api.unsplash.com/search/photos', {
                params: { query, per_page: 8, orientation: 'landscape', content_filter: 'high', order_by: 'relevant' },
                headers: { 'Authorization': `Client-ID ${key}` },
                timeout: 10000
            })
            const results = response.data?.results || []
            if (results.length === 0) continue

            // Score each result by semantic match against article context
            const scored = results.map(r => {
                const searchable = [
                    r.alt_description || '',
                    r.description || '',
                    r.slug || '',
                    Array.isArray(r.tags) ? r.tags.map(t => t.title || '').join(' ') : '',
                ].join(' ').toLowerCase()

                let score = 0
                primaryTerms.forEach((term, i) => {
                    if (searchable.includes(term)) score += i < 3 ? 12 : 6
                })
                excerptTerms.forEach(term => {
                    if (searchable.includes(term)) score += 4
                })
                if (r.width > r.height) score += 2
                if (typeof r.likes === 'number') score += Math.min(r.likes / 100, 3)
                return { url: r.urls?.regular, score }
            }).sort((a, b) => b.score - a.score)

            if (scored[0]?.url && scored[0].score >= 0) {
                console.log(`[ID-WORKER] Image: query="${query}" score=${scored[0].score.toFixed(1)}`)
                return scored[0].url
            }
        } catch (err) {
            console.error('[ID-WORKER] Unsplash error:', err.message)
        }
    }
    return null
}

async function saveArticleId(article) {
    const result = await pool.query(
        `INSERT INTO articles
     (title, content, source_url, source_name, published_at, is_published, ai_model,
      prompt_tokens, completion_tokens, total_tokens, estimated_cost,
      featured_image, excerpt, author, views, language)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id`,
        [
            article.title,
            article.content,
            article.source_url || null,
            article.source_name,
            article.published_at || new Date().toISOString(),
            true,
            article.ai_model || null,
            article.tokens?.prompt || null,
            article.tokens?.completion || null,
            article.tokens?.total || null,
            article.cost || null,
            article.featured_image || null,
            article.excerpt || null,
            'AI Redaksi Indonesia',
            0,
            'id',
        ]
    )
    return result.rows[0]
}

async function ensureCategoriesForArticle(articleId, categoryNames) {
    for (const name of categoryNames) {
        if (!name || typeof name !== 'string') continue
        const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        if (!slug || slug.length < 2) continue
        try {
            const cat = await pool.query(
                `INSERT INTO categories (name, slug) VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
                [name.trim(), slug]
            )
            if (cat.rows[0]) {
                await pool.query(
                    `INSERT INTO article_categories (article_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    [articleId, cat.rows[0].id]
                )
            }
        } catch (e) {
            console.error('[ID-WORKER] Category error:', e.message)
        }
    }
}

function detectCategories(title, content) {
    const text = (title + ' ' + content).toLowerCase()
    const map = [
        ['Kripto & Blockchain', ['bitcoin', 'ethereum', 'crypto', 'kripto', 'blockchain', 'defi', 'nft', 'altcoin', 'btc', 'eth', 'binance', 'coinbase', 'token', 'web3', 'solana', 'xrp', 'ripple', 'stablecoin', 'coindesk', 'cointelegraph']],
        ['Teknologi', ['teknologi', 'ai', 'artificial intelligence', 'llm', 'openai', 'google', 'apple', 'microsoft', 'samsung', 'startup', 'software', 'hardware', 'robot', 'smartphone', 'chip', 'semiconductor', 'cloud', 'cybersecurity', 'hack', 'data breach', 'techcrunch', 'verge', 'wired']],
        ['Politik', ['jokowi', 'prabowo', 'presiden', 'dpr', 'pemilu', 'partai', 'kabinet', 'koalisi', 'pilkada', 'menteri', 'pemerintah', 'ri', 'mpr', 'kpk', 'kejaksaan', 'polri']],
        ['Ekonomi', ['ekonomi', 'rupiah', 'inflasi', 'investasi', 'saham', 'bursa', 'bi', 'ojk', 'ekspor', 'impor', 'pdb', 'umkm', 'perdagangan', 'bisnis', 'pasar modal', 'reuters', 'cnbc', 'wall street']],
        ['Olahraga', ['timnas', 'piala', 'liga', 'bola', 'sepak bola', 'sepakbola', 'badminton', 'bulutangkis', 'atlet', 'olimpiade', 'fifa', 'premier league', 'champions league', 'la liga', 'serie a', 'bundesliga', 'pssi', 'persib', 'persija', 'arema', 'bri liga', 'piala dunia', 'euro', 'copa america', 'cl', 'ucl', 'goal', 'transfer', 'gol', 'pertandingan', 'klasemen', 'skuad', 'messi', 'ronaldo', 'mbappe', 'haaland', 'real madrid', 'barcelona', 'manchester', 'juventus', 'inter milan', 'ac milan', 'f1', 'motogp', 'bulu tangkis', 'pbsi']],
        ['Hiburan', ['film', 'musik', 'artis', 'selebriti', 'konser', 'serial', 'netflix', 'drama', 'sinetron', 'k-pop', 'kpop', 'box office']],
        ['Kesehatan', ['kesehatan', 'rumah sakit', 'dokter', 'vaksin', 'penyakit', 'covid', 'bpjs', 'obat', 'pandemi', 'kemenkes', 'gizi', 'kanker', 'virus']],
        ['Pendidikan', ['pendidikan', 'sekolah', 'universitas', 'mahasiswa', 'kemdikbud', 'snbp', 'beasiswa', 'kampus', 'riset', 'penelitian']],
        ['Hukum & Kriminal', ['hukum', 'polisi', 'jaksa', 'pengadilan', 'korupsi', 'kpk', 'mahkamah', 'vonis', 'terdakwa', 'tersangka', 'narkoba']],
        ['Lingkungan', ['iklim', 'banjir', 'gempa', 'bencana', 'emisi', 'karbon', 'hutan', 'kebakaran', 'polusi', 'energi terbarukan', 'solar', 'ev', 'listrik']],
    ]
    const matched = []
    for (const [cat, keywords] of map) {
        if (keywords.some(w => text.includes(w))) matched.push(cat)
        if (matched.length >= 2) break
    }
    return matched.length > 0 ? matched : ['Berita']
}

// ============================================
// MAIN CRAWL FUNCTION
// ============================================
async function crawlIndonesian() {
    console.log('\n[ID-WORKER] ===== Starting Indonesian crawl cycle =====')
    const shuffledFeeds = [...ID_FEEDS].sort(() => Math.random() - 0.5)
    let totalGenerated = 0

    for (const feed of shuffledFeeds) {
        if (totalGenerated >= CRAWL_CONFIG.TOTAL_BUDGET) break

        console.log(`[ID-WORKER] Fetching: ${feed.name}`)
        const items = await fetchRSS(feed.url)

        if (items.length === 0) {
            console.log(`[ID-WORKER] No items from ${feed.name}`)
            continue
        }

        let fromSource = 0
        for (const item of items.slice(0, CRAWL_CONFIG.MAX_PER_SOURCE)) {
            if (totalGenerated >= CRAWL_CONFIG.TOTAL_BUDGET) break
            if (!item.title || item.title.length < 10) continue

            // Dedup: check source URL
            if (item.link) {
                let normalizedLink = item.link.trim()
                try {
                    const u = new URL(normalizedLink)
                        ;['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'source'].forEach(p => u.searchParams.delete(p))
                    normalizedLink = (u.origin + u.pathname + (u.search !== '?' ? u.search : '')).replace(/\/$/, '')
                } catch { }
                const dup = await pool.query("SELECT id FROM articles WHERE LOWER(TRIM(source_url))=LOWER(TRIM($1)) LIMIT 1", [normalizedLink])
                if (dup.rows.length > 0) { console.log(`[ID-WORKER] Skip dup URL: ${normalizedLink.slice(0, 60)}`); item.link = normalizedLink; continue }
                item.link = normalizedLink
            }

            // Dedup: check title
            const dupTitle = await pool.query("SELECT id FROM articles WHERE LOWER(TRIM(title))=LOWER(TRIM($1)) LIMIT 1", [item.title])
            if (dupTitle.rows.length > 0) { console.log(`[ID-WORKER] Skip dup title: ${item.title.slice(0, 50)}`); continue }

            try {
                console.log(`[ID-WORKER] → Generating: "${item.title.slice(0, 60)}"`)
                const generated = await generateArticleWithOpenRouter(item.title, item.content, feed.name)

                // Dedup: check generated title
                const dupGen = await pool.query("SELECT id FROM articles WHERE LOWER(TRIM(title))=LOWER(TRIM($1)) LIMIT 1", [generated.title])
                if (dupGen.rows.length > 0) { console.log(`[ID-WORKER] Skip dup generated: ${generated.title.slice(0, 50)}`); continue }

                // Detect categories early so image search can use them
                const categories = detectCategories(generated.title, generated.content)

                // Fetch image with full context for better relevance
                const imageUrl = await fetchImageFromUnsplash({
                    imageHint: generated.image_hint,
                    title: generated.title,
                    excerpt: generated.excerpt,
                    categories,
                })

                // Save
                const saved = await saveArticleId({
                    title: generated.title,
                    content: generated.content,
                    source_url: item.link,
                    source_name: feed.name,
                    published_at: item.pubDate,
                    ai_model: generated.model,
                    tokens: generated.tokens,
                    cost: generated.cost,
                    featured_image: imageUrl,
                    excerpt: generated.excerpt,
                })

                // Assign categories
                await ensureCategoriesForArticle(saved.id, categories)

                console.log(`[ID-WORKER] ✓ #${saved.id} [${categories.join(', ')}] — ${generated.title.slice(0, 60)}`)
                totalGenerated++
                fromSource++

                // Polite delay
                await new Promise(r => setTimeout(r, 2000))
            } catch (err) {
                console.error(`[ID-WORKER] Failed to process "${item.title.slice(0, 50)}": ${err.message}`)
                await new Promise(r => setTimeout(r, 3000))
            }
        }
        if (fromSource > 0) console.log(`[ID-WORKER] ${fromSource} article(s) from ${feed.name}`)
    }

    console.log(`[ID-WORKER] ===== Cycle done: ${totalGenerated} articles generated =====\n`)
}

// ============================================
// SCHEDULE: every 45 minutes
// ============================================
cron.schedule('*/45 * * * *', () => {
    crawlIndonesian().catch(err => console.error('[ID-WORKER] Crawl error:', err.message))
})

// Run immediately on startup
crawlIndonesian().catch(err => console.error('[ID-WORKER] Initial crawl error:', err.message))

console.log('[ID-WORKER] Scheduled every 45 minutes. Running first crawl now...')
