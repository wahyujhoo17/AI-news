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
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL_ID || 'openrouter/free'
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
    { id: 'id-002', name: 'Antara News', url: 'https://www.antaranews.com/rss/terkini.rss' },       // was 404 — keep, may recover
    { id: 'id-003', name: 'Tempo', url: 'https://rss.tempo.co/nasional' },
    { id: 'id-004', name: 'Kompas', url: 'https://rss.kompas.com/rss/berita/nasional' },            // fixed URL
    { id: 'id-005', name: 'CNN Indonesia', url: 'https://www.cnnindonesia.com/rss' },
    { id: 'id-006', name: 'Republika', url: 'https://www.republika.co.id/rss' },
    { id: 'id-007', name: 'Liputan6', url: 'https://www.liputan6.com/rss/news' },                   // replaced Okezone (XML error)
    { id: 'id-008', name: 'Tribun News', url: 'https://www.tribunnews.com/rss/nasional' },          // was 403 on /rss, try /rss/nasional
    { id: 'id-009', name: 'Google News ID', url: 'https://news.google.com/rss?hl=id&gl=ID&ceid=ID:id' },
    { id: 'id-010', name: 'Jakarta Post', url: 'https://www.thejakartapost.com/feed' },
    { id: 'id-011', name: 'Merdeka', url: 'https://www.merdeka.com/feed/' },
    { id: 'id-012', name: 'Suara', url: 'https://www.suara.com/rss' },

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
    { id: 'bz-001', name: 'Reuters', url: 'https://feeds.reuters.com/reuters/topNews' },            // replaced dead businessNews endpoint
    { id: 'bz-002', name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },

    // ===== OLAHRAGA & SEPAK BOLA =====
    { id: 'sp-001', name: 'Bola.net', url: 'https://www.bola.net/rss/rss.html' },
    { id: 'sp-002', name: 'Bola.com', url: 'https://www.bola.com/rss' },
    { id: 'sp-003', name: 'Tribun Sport', url: 'https://www.tribunnews.com/rss/sport' },
    { id: 'sp-004', name: 'ESPN FC', url: 'https://www.espn.com/espn/rss/soccer/news' },
    { id: 'sp-005', name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' },
    { id: 'sp-006', name: 'Sky Sports Football', url: 'https://www.skysports.com/rss/12040' },
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
    const prompt = `Kamu adalah jurnalis profesional Indonesia untuk portal berita digital qbitznews.com.
Sumber berita mungkin dalam bahasa Inggris — WAJIB terjemahkan dan tulis SELURUH artikel dalam bahasa Indonesia.

---
JUDUL SUMBER: ${sourceTitle}
KONTEN SUMBER: ${sourceContent.slice(0, 1800)}
---

Tulis output PERSIS dalam format berikut (ganti teks dalam kurung siku, jangan tulis kurung sikunya):

[Judul artikel dalam BAHASA INDONESIA, SEO-friendly, 55-90 karakter]

IMAGE_HINT: [4-6 kata BAHASA INGGRIS untuk foto Unsplash]

CATEGORY: [1-2 kategori dari daftar: Kripto & Blockchain | Teknologi | Politik | Ekonomi | Olahraga | Hiburan | Kesehatan | Pendidikan | Hukum & Kriminal | Lingkungan | Berita]

[Isi artikel minimal 700 kata dalam BAHASA INDONESIA menggunakan Markdown]

ATURAN WAJIB:
- SELURUH judul dan isi artikel HARUS dalam bahasa Indonesia — DILARANG menulis dalam bahasa Inggris
- Hanya IMAGE_HINT yang boleh dalam bahasa Inggris
- Terjemahkan semua istilah teknis ke padanan Indonesia atau beri penjelasan

ATURAN JUDUL:
- Spesifik: sebut siapa/apa/angka penting
- Kata kerja aktif: Tembus, Luncurkan, Capai, Catat, Umumkan, Lampaui, Terhenti, Kalahkan
- JANGAN mulai dengan: The, A, An, Sebuah, Ini adalah
- JANGAN sertakan tanggal, sumber, atau label apapun dalam judul
- Contoh BAIK: "Bitcoin Tembus $100.000 Pertama Kalinya dalam Sejarah"
- Contoh BURUK: "Meta Boosts Code Review Accuracy to 93%"

ATURAN IMAGE_HINT:
- WAJIB bahasa Inggris (untuk pencarian foto Unsplash)
- Gunakan benda/tempat/aktivitas yang TERLIHAT secara visual, BUKAN konsep abstrak
- Contoh BAIK: "government building official ceremony", "courtroom judge gavel", "football stadium match crowd", "bitcoin cryptocurrency trading screen", "hospital doctor patient examination"
- Contoh BURUK: "remote office teamwork", "peaceful reconciliation", "national issue", "leadership challenge"
- Sesuaikan dengan topik artikel: korupsi → "courtroom justice gavel", olahraga → jenis olahraga spesifik, teknologi → perangkat spesifik

ATURAN ARTIKEL:
- Gaya jurnalistik profesional, bahasa formal tapi mudah dipahami
- Sertakan konteks, dampak bagi Indonesia, data/angka jika relevan
- Gunakan ## untuk sub-judul jika topik membutuhkan struktur
- JANGAN heading generik: Pendahuluan, Kesimpulan, Latar Belakang
- Akhiri dengan paragraf penutup yang kuat`

    try {
        const response = await axios.post(
            OPENROUTER_ENDPOINT,
            {
                model: OPENROUTER_MODEL,
                messages: [
                    { role: 'system', content: 'Kamu adalah jurnalis profesional Indonesia. WAJIB menulis SELURUH output dalam bahasa Indonesia, kecuali IMAGE_HINT yang harus dalam bahasa Inggris. Mulai langsung dengan judul bahasa Indonesia. Jangan tambahkan preamble, penjelasan, atau komentar apapun.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 4096,
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

        // Parse IMAGE_HINT and CATEGORY
        let aiImageHint = ''
        let aiCategories = []
        const VALID_CATEGORIES = new Set(['Kripto & Blockchain', 'Teknologi', 'Politik', 'Ekonomi', 'Olahraga', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Hukum & Kriminal', 'Lingkungan', 'Berita'])
        const rawLines = fullContent.split('\n')
        for (let i = rawLines.length - 1; i >= 0; i--) {
            const line = rawLines[i].trim()
            const imgMatch = line.match(/^image[_\s-]?hint\s*[:\-]\s*(.+)$/i)
            if (imgMatch) { aiImageHint = imgMatch[1].trim(); rawLines.splice(i, 1); continue }
            const catMatch = line.match(/^category\s*[:\-]\s*(.+)$/i)
            if (catMatch) {
                aiCategories = catMatch[1].split(',').map(c => c.trim()).filter(c => VALID_CATEGORIES.has(c))
                rawLines.splice(i, 1)
            }
        }

        // Extract title (first non-empty, non-metadata line)
        let title = ''
        let contentStartIndex = 0
        // Patterns that indicate a line is NOT a title
        const skipLinePattern = /^(image[_\s-]?hint|category|source|sumber|tanggal|date|by\s|author|baris\s*\d|\d{1,2}\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)|january|february|march|april|may|june|july|august|september|october|november|december)/i
        const dateOnlyPattern = /^\d{1,2}[\s\/\-]+(\d{1,2}[\s\/\-]+)?\d{2,4}$/
        for (let i = 0; i < Math.min(rawLines.length, 12); i++) {
            const line = rawLines[i].trim()
            if (!line) continue
            if (skipLinePattern.test(line) || dateOnlyPattern.test(line)) { rawLines.splice(i, 1); i--; continue }
            // Clean any leaked prompt artifacts from title
            title = line
                .replace(/^#+\s*/, '')           // markdown heading
                .replace(/^baris\s*\d+\s*:?\s*/i, '') // BARIS 1: prefix
                .replace(/^\*\*(.+)\*\*$/, '$1') // **bold**
                .replace(/\*\*/g, '')             // remaining asterisks
                .trim()
            contentStartIndex = i + 1
            break
        }
        if (!title || title.length < 20) title = sourceTitle.split(' - ')[0].trim().slice(0, 90)
        if (title.length > 95) title = title.slice(0, 92).trim() + '...'

        // Clean body
        const bodyLines = rawLines.slice(contentStartIndex)
        while (bodyLines.length > 0 && !bodyLines[0].trim()) bodyLines.shift()
        let content = bodyLines.join('\n').trim()
        content = content
            .replace(/^image[_\s-]?hint\s*[:\-][^\n]*/gim, '')
            .replace(/^category\s*[:\-][^\n]*/gim, '')
            .replace(/^baris\s*\d+\s*[:\-]?\s*/gim, '')
            .replace(/^source\s*[:\-][^\n]*/gim, '')
            .replace(/^sumber\s*[:\-][^\n]*/gim, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim()

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
            categories: aiCategories,
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

            // Only accept result if score is high enough to indicate relevance
            const MIN_SCORE = 8
            if (scored[0]?.url && scored[0].score >= MIN_SCORE) {
                console.log(`[ID-WORKER] Image: query="${query}" score=${scored[0].score.toFixed(1)}`)
                return scored[0].url
            } else if (scored[0]?.url) {
                console.log(`[ID-WORKER] Image score too low (${scored[0].score.toFixed(1)}) for query="${query}" — trying next query`)
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

// ============================================
// PROMOTIONAL CONTENT FILTER
// ============================================

const PROMO_BRANDS = new Set([
    'bca', 'bank central asia', 'bri', 'bank rakyat', 'bni', 'bank negara', 'mandiri', 'bank mandiri',
    'cimb niaga', 'danamon', 'ocbc', 'panin', 'btpn', 'bank mega', 'maybank', 'permata',
    'bsi', 'bank syariah', 'btn', 'bank tabungan', 'bjb',
    'telkom', 'telkomsel', 'indosat', 'xl axiata', 'smartfren', 'tri indonesia',
    'pertamina', 'pln', 'garuda indonesia', 'pos indonesia', 'krakatau steel', 'semen indonesia',
    'pupuk indonesia', 'hutama karya', 'waskita', 'adhi karya', 'wijaya karya',
    'indomaret', 'alfamart', 'transmart', 'hypermart',
    'indofood', 'unilever', 'wings', 'sido muncul', 'kalbe farma', 'kimia farma',
    'gojek', 'tokopedia', 'shopee', 'lazada', 'bukalapak', 'traveloka',
    'ovo', 'dana', 'gopay', 'linkaja', 'jenius',
    'astra', 'toyota astra', 'honda prospect', 'suzuki indomobil',
    'sinar mas', 'ciputra', 'summarecon', 'bumi serpong', 'pakuwon',
    'sampoerna', 'gudang garam', 'djarum', 'bentoel',
    'prudential', 'axa', 'allianz', 'jiwasraya', 'jasindo',
])

const PROMO_TITLE_PATTERNS = [
    /\b(luncurkan|meluncurkan|hadirkan|menghadirkan|perkenalkan)\s+(program|produk|layanan|fitur|aplikasi|solusi)\b/i,
    /\bprogram\s+\w+\s+(berbakti|peduli|berdaya|bersama|untuk negeri|untuk indonesia)\b/i,
    /\b(sponsori|dukung|gandeng)\b.{0,50}\b(event|festival|turnamen|konser|program)\b/i,
    /\b(raih|sabet)\s+penghargaan.{0,40}(terbaik|terpercaya|nomor\s*1|no\.?\s*1)\b/i,
    /\b(tanda\s*tangani|sepakati)\s+(mou|pks|nota\s*kesepahaman)\b/i,
    /\bgelar\s+\w+\s+(festival|expo|pameran|roadshow|bazar)\b/i,
    /\bhut\s+ke-?\d+\b/i,
    /\banniversary\s+ke-?\d+\b/i,
]

/**
 * Mengembalikan { isPromo: boolean, reason: string }
 */
function detectPromotionalContent(title, content = '') {
    const titleLower = title.toLowerCase()
    const textLower = (title + ' ' + content).toLowerCase()

    // Brand ada di judul + pola promosi di judul → langsung tolak
    for (const brand of PROMO_BRANDS) {
        if (titleLower.includes(brand)) {
            for (const pat of PROMO_TITLE_PATTERNS) {
                if (pat.test(title)) return { isPromo: true, reason: `Brand "${brand}" + pola promosi di judul` }
            }
            // CSR / program sosial langsung
            if (/\b(csr|berbakti|desa binaan|komunitas binaan|program binaan|beasiswa)\b/i.test(title)) {
                return { isPromo: true, reason: `Brand "${brand}" + CSR/beasiswa di judul` }
            }
        }
    }

    // Pola promosi kuat di judul (tanpa perlu cek brand)
    for (const pat of PROMO_TITLE_PATTERNS) {
        if (pat.test(title)) return { isPromo: true, reason: `Pola promosi di judul: "${title.slice(0, 60)}"` }
    }

    // Cek body — skor kumulatif
    if (content.length > 100) {
        let score = 0
        for (const brand of PROMO_BRANDS) { if (textLower.includes(brand)) score += 3 }
        const promoKw = ['csr', 'corporate social responsibility', 'advertorial', 'sponsored', 'desa wisata binaan',
            'desa binaan', 'program binaan', 'hari ulang tahun ke-', 'produk unggulan', 'layanan terbaik kami', 'hubungi kami']
        promoKw.forEach(kw => { if (textLower.includes(kw)) score += 2 })
        for (const pat of PROMO_TITLE_PATTERNS) { if (pat.test(textLower)) score += 4 }
        if (score >= 8) return { isPromo: true, reason: `Skor promosi tinggi (${score}) di body` }
    }

    return { isPromo: false, reason: '' }
}

// Fallback keyword-based — dipakai jika AI tidak mengembalikan kategori valid
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

            // Filter promosi — cek source title SEBELUM panggil AI (hemat token)
            const prePromo = detectPromotionalContent(item.title, item.content)
            if (prePromo.isPromo) {
                console.log(`[ID-WORKER] Skip promosi (pre-AI): ${prePromo.reason}`)
                continue
            }

            try {
                console.log(`[ID-WORKER] → Generating: "${item.title.slice(0, 60)}"`)
                const generated = await generateArticleWithOpenRouter(item.title, item.content, feed.name)

                // Dedup: check generated title
                const dupGen = await pool.query("SELECT id FROM articles WHERE LOWER(TRIM(title))=LOWER(TRIM($1)) LIMIT 1", [generated.title])
                if (dupGen.rows.length > 0) { console.log(`[ID-WORKER] Skip dup generated: ${generated.title.slice(0, 50)}`); continue }

                // Filter promosi — cek hasil AI (AI bisa mengubah framing)
                const postPromo = detectPromotionalContent(generated.title, generated.content)
                if (postPromo.isPromo) {
                    console.log(`[ID-WORKER] Skip promosi (post-AI): ${postPromo.reason}`)
                    continue
                }

                // Kategori dari AI, fallback ke keyword-based jika AI tidak mengembalikan valid
                const categories = generated.categories && generated.categories.length > 0
                    ? generated.categories
                    : detectCategories(generated.title, generated.content)
                console.log(`[ID-WORKER] Kategori: [${categories.join(', ')}] (${generated.categories?.length > 0 ? 'AI' : 'fallback'})`)

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
