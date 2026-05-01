/**
 * worker-id.js — Indonesian Language News Worker
 * Mengambil berita dari sumber Indonesia + internasional (crypto, teknologi, dll.)
 * lalu menulis ulang dalam bahasa Indonesia menggunakan Google Gemini AI.
 * Artikel disimpan dengan language='id'.
 */

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

async function notifyBingIndexing(url) {
    const apiKey = process.env.BING_WEBMASTER_API_KEY
    if (!apiKey) return
    try {
        const res = await axios.post(
            `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch?apikey=${apiKey}`,
            { siteUrl: 'https://qbitznews.com', urlList: [url] },
            { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
        )
        console.log(`[ID-BING] Notified: ${url.slice(0, 70)} → ${res.data?.d || 'OK'}`)
    } catch (err) {
        console.error(`[ID-BING] Failed for ${url.slice(0, 70)}: ${err.message}`)
    }
}
// ─────────────────────────────────────────────────────────────────────────────

const Parser = require('rss-parser')
const cheerio = require('cheerio')
const { pool } = require('./lib/db-worker')

const HTML_FETCH_MAX_BYTES = 700 * 1024
const FULL_CONTENT_TARGET_CHARS = 2600

function collectParagraphText($root, $, maxChars = FULL_CONTENT_TARGET_CHARS) {
    if (!$root || !$root.length) return ''
    let text = ''
    $root.find('p').each((_, paragraph) => {
        if (text.length >= maxChars) return false
        const chunk = $(paragraph).text().replace(/\s+/g, ' ').trim()
        if (!chunk) return
        text += (text ? ' ' : '') + chunk
        if (text.length >= maxChars) return false
    })
    return text.slice(0, maxChars).trim()
}

const GROQ_API_KEY_LIST = process.env.GROQ_API_KEY_ID || process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
const GROQ_MODEL_FALLBACKS = [
    GROQ_MODEL,
    'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile',
]

class GroqKeyManager {
    constructor(keysEnv) {
        const keys = keysEnv.split(',').map(k => k.trim()).filter(k => k.length > 0)
        if (keys.length === 0) throw new Error('GROQ API key list kosong')

        this.keys = keys
        this.currentIndex = 0
        this.cooldownTimes = {}
        this.DEFAULT_COOLDOWN_MS = 10 * 60 * 1000 // 10 menit

        this.keys.forEach(key => {
            this.cooldownTimes[key] = 0
        })
    }

    getNextKey() {
        const availableKeys = this.keys.filter(key => this.cooldownTimes[key] <= Date.now())
        if (availableKeys.length === 0) {
            console.warn('[ID-WORKER] Semua GROQ key sedang cooldown, memilih key berikutnya')
            this.currentIndex = (this.currentIndex + 1) % this.keys.length
            return this.keys[this.currentIndex]
        }

        this.currentIndex = (this.currentIndex + 1) % this.keys.length
        const candidate = this.keys[this.currentIndex]
        if (this.cooldownTimes[candidate] <= Date.now()) return candidate

        const fallback = availableKeys[0]
        this.currentIndex = this.keys.indexOf(fallback)
        return fallback
    }

    recordSuccess(key) {
        if (key && this.cooldownTimes[key] !== undefined) {
            this.cooldownTimes[key] = 0
        }
    }

    recordFailure(key, errorType, cooldownMs) {
        if (!key || this.cooldownTimes[key] === undefined) return
        if (errorType === 'rate_limit_exceeded') {
            const cd = cooldownMs || this.DEFAULT_COOLDOWN_MS
            this.cooldownTimes[key] = Date.now() + cd
            console.warn(`[ID-WORKER] GROQ key ...${key.slice(-6)} rate-limited, cooldown ${Math.round(cd / 1000)}s`)
        }
    }
}

let groqKeyManager = null
if (GROQ_API_KEY_LIST) {
    try {
        groqKeyManager = new GroqKeyManager(GROQ_API_KEY_LIST)
        console.log(`[ID-WORKER] GROQ key manager inisialisasi dengan ${groqKeyManager.keys.length} key(s)`)
    } catch (err) {
        console.error('[ID-WORKER] Gagal membuat GROQ key manager:', err.message)
        groqKeyManager = null
    }
}

console.log('[ID-WORKER] Starting Indonesian news worker (Groq AI)')
console.log('[ID-WORKER] Groq model primary:', GROQ_MODEL, '| fallbacks:', GROQ_MODEL_FALLBACKS.length)

// ============================================
// RSS SOURCES — Indonesia + International
// ============================================
const ID_FEEDS = [
    // ===== INDONESIA (noSourceImage=true: gambar lokal berisi watermark) =====
    { id: 'id-001', name: 'Detik News', url: 'https://news.detik.com/rss', noSourceImage: false },
    { id: 'id-002', name: 'Antara News', url: 'https://www.antaranews.com/rss', noSourceImage: false },
    { id: 'id-003', name: 'Tempo', url: 'https://rss.tempo.co/nasional', noSourceImage: false },
    { id: 'id-004', name: 'Kompas', url: 'https://rss.kompas.com/rss', noSourceImage: false },
    { id: 'id-005', name: 'CNN Indonesia', url: 'https://www.cnnindonesia.com/rss', noSourceImage: false },
    { id: 'id-006', name: 'Republika', url: 'https://www.republika.co.id/rss', noSourceImage: true },
    { id: 'id-007', name: 'Liputan6', url: 'https://www.liputan6.com/feed', noSourceImage: false },
    { id: 'id-008', name: 'Tribun News', url: 'https://www.tribunnews.com/rss', noSourceImage: true },
    { id: 'id-009', name: 'Google News ID', url: 'https://news.google.com/rss?hl=id&gl=ID&ceid=ID:id', noSourceImage: false },
    { id: 'id-010', name: 'Jakarta Post', url: 'https://www.thejakartapost.com/rss', noSourceImage: false },
    { id: 'id-011', name: 'Merdeka', url: 'https://www.merdeka.com/rss', noSourceImage: false },
    { id: 'id-012', name: 'Suara', url: 'https://www.suara.com/feed', noSourceImage: false },

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
    { id: 'bz-001', name: 'Reuters', url: 'https://www.bbc.com/news/rss.xml' },
    { id: 'bz-002', name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },

    // ===== OLAHRAGA — SEPAK BOLA (internasional, tanpa watermark) =====
    { id: 'sp-001', name: 'Liga Olahraga', url: 'https://www.ligaolahraga.com/feed', noSourceImage: true },
    { id: 'sp-002', name: 'Detik Sport', url: 'https://sport.detik.com/rss.xml', noSourceImage: false },
    { id: 'sp-003', name: 'Tribun Sport', url: 'https://www.tribunnews.com/rss', noSourceImage: true },
    { id: 'sp-004', name: 'ESPN FC', url: 'https://www.espn.com/espn/rss/soccer/news' },
    { id: 'sp-005', name: 'BBC Sport Football', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' },
    { id: 'sp-006', name: 'Sky Sports Football', url: 'https://www.skysports.com/rss/12040' },
    { id: 'sp-007', name: 'BBC Premier League', url: 'https://feeds.bbci.co.uk/sport/football/premier-league/rss.xml' },
    { id: 'sp-008', name: '90min Football', url: 'https://www.90min.com/posts.rss' },
    { id: 'sp-009', name: 'CNN Indonesia Sport', url: 'https://www.cnnindonesia.com/olahraga/rss' },
    { id: 'sp-010', name: 'BBC Football Champions League', url: 'https://feeds.bbci.co.uk/sport/football/european/rss.xml' },

    // ===== OLAHRAGA — MULTI SPORT =====
    { id: 'ms-001', name: 'ESPN Top Sports', url: 'https://www.espn.com/espn/rss/news' },
    { id: 'ms-002', name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml' },
    { id: 'ms-003', name: 'Sky Sports', url: 'https://www.skysports.com/rss/12433' },
    { id: 'ms-004', name: 'BWF Badminton', url: 'https://bwfbadminton.com/feed/' },
    { id: 'ms-005', name: 'Republika Sport', url: 'https://www.republika.co.id/rss/sport' },
    { id: 'ms-006', name: 'NBA', url: 'https://www.nba.com/news/rss' },
    { id: 'ms-007', name: 'ESPN Motorsport', url: 'https://www.espn.com/espn/rss/f1/news' },
]

const CRAWL_CONFIG = {
    TOTAL_BUDGET: 6,        // total artikel target per siklus
    MAX_PER_SOURCE: 2,      // maks artikel per sumber
    SPORTS_RATIO: 0.20,     // ~20% konten olahraga
    LOCAL_RATIO: 0.20,      // ~20% berita lokal Indonesia
    TECH_RATIO: 0.20,       // ~20% teknologi
    CRYPTO_RATIO: 0.20,     // ~20% crypto
    // sisanya ~20% untuk berita bisnis / kategori lainnya
}

// ============================================
// HELPERS
// ============================================
function safeParsePubDate(pubDate) {
    if (!pubDate) return new Date().toISOString()
    try {
        const d = new Date(pubDate)
        if (isNaN(d.getTime())) return new Date().toISOString()
        return d.toISOString()
    } catch {
        return new Date().toISOString()
    }
}

async function fetchRSS(url) {
    try {
        const parser = new Parser({ timeout: 15000 })
        const feed = await parser.parseURL(url)
        return (feed.items || []).map(item => ({
            title: item.title || 'Untitled',
            content: item.contentSnippet || item.content || item.description || '',
            link: item.link || '',
            pubDate: safeParsePubDate(item.pubDate || item.isoDate),
            sourceImage: extractImageFromFeedItem(item),
        }))
    } catch (error) {
        console.error(`[ID-WORKER] RSS fetch error (${url.slice(0, 60)}): ${error.message}`)
        return []
    }
}

async function fetchFullArticleContent(url) {
    if (!url) return ''

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
            },
            timeout: 15000,
            maxContentLength: HTML_FETCH_MAX_BYTES,
            maxBodyLength: HTML_FETCH_MAX_BYTES,
        })
        const html = String(response.data || '').slice(0, HTML_FETCH_MAX_BYTES)
        const $ = cheerio.load(html)

        const selectors = [
            'article',
            '.post-content',
            '.entry-content',
            '.story-content',
            '.article-content',
            '.content',
            'main',
            '[role="main"]',
        ]

        let content = ''
        for (const selector of selectors) {
            const element = $(selector).first()
            if (!element.length) continue

            content = collectParagraphText(element, $, FULL_CONTENT_TARGET_CHARS)
            if (content.length > 300) break
        }

        if (content.length < 300) {
            const fallbackContent = collectParagraphText($('body'), $, FULL_CONTENT_TARGET_CHARS)
            if (fallbackContent.length > content.length) {
                content = fallbackContent
            }
        }

        return content.slice(0, FULL_CONTENT_TARGET_CHARS)
    } catch (error) {
        console.log(`[ID-WORKER] Full article fetch failed: ${error.message}`)
        return ''
    }
}

const ENGLISH_HEADLINE_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'by', 'for', 'from', 'with', 'to', 'into', 'over',
    'new', 'latest', 'update', 'live', 'top', 'best', 'how', 'why', 'what', 'when', 'where', 'who',
    'boosts', 'boost', 'launches', 'launch', 'reveals', 'reveal', 'reports', 'report', 'says', 'say',
    'claims', 'claim', 'warns', 'warn', 'adds', 'add', 'unveils', 'unveil', 'confirms', 'confirm',
    'denies', 'deny', 'beats', 'beat', 'wins', 'win', 'loses', 'lose', 'plans', 'plan', 'shifts', 'shift',
    'exits', 'exit', 'grows', 'grow', 'falls', 'fall', 'rises', 'rise', 'slips', 'slip', 'drops', 'drop',
    'cuts', 'cut', 'aims', 'aim', 'joins', 'join', 'names', 'name', 'takes', 'take', 'faces', 'face',
    'pushes', 'push', 'introduces', 'introduce', 'partners', 'partner', 'signs', 'sign', 'approves', 'approve',
    'blocks', 'block', 'bans', 'ban', 'eyes', 'eye', 'could', 'would', 'should', 'will', 'after', 'before', 'amid',
    'deal', 'team', 'game', 'users', 'market', 'stocks', 'shares', 'watch', 'inside', 'today', 'breaking',
])

const INDONESIAN_HEADLINE_WORDS = new Set([
    'yang', 'dan', 'untuk', 'dengan', 'soal', 'karena', 'akan', 'usai', 'resmi', 'baru', 'naik', 'turun',
    'ungkap', 'meluncurkan', 'menang', 'pecat', 'gagal', 'guncang', 'bocor', 'ditangkap', 'dilarang',
    'lolos', 'kalahkan', 'perbarui', 'serukan', 'desak', 'akui', 'bantah', 'investasi', 'ekspansi', 'rugi',
])

function normalizeHeadlineText(text = '') {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .replace(/^[\s"'“”`•\-]+|[\s"'“”`•\-]+$/g, '')
        .trim()
}

function stripHeadlineLabel(text = '') {
    return normalizeHeadlineText(text)
        .replace(/^(judul|title|headline|heading)\s*[:\-]\s*/i, '')
        .replace(/^\[(judul|title|headline|heading)\]\s*/i, '')
        .trim()
}

function headlineTokens(text = '') {
    return normalizeHeadlineText(text)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .map(token => token.trim())
        .filter(Boolean)
}

function extractHeadlineFromModel(text = '') {
    const firstLine = String(text || '')
        .split('\n')
        .map(line => line.trim())
        .find(Boolean) || ''

    return stripHeadlineLabel(
        firstLine
            .replace(/^["'“”`]+|["'“”`]+$/g, '')
    )
}

function titleNeedsRewrite(title = '') {
    const clean = normalizeHeadlineText(title)
    if (!clean || clean.length < 15) return true

    const tokens = headlineTokens(clean)
    const englishHits = tokens.filter(token => ENGLISH_HEADLINE_WORDS.has(token)).length
    const indonesianHits = tokens.filter(token => INDONESIAN_HEADLINE_WORDS.has(token)).length
    const englishSurface = /\b(the|a|an|new|latest|update|boosts|launches|reveals|reports|says|claims|how|why|what|when|where|who|live|breaking)\b/i.test(clean)
    const genericSurface = /^(situasi terkini|berita terkini|update terbaru|apa yang terjadi|yang perlu diketahui|inilah|ini dia|fakta mengejutkan)$/i.test(clean)

    return genericSurface || englishSurface || (englishHits >= 1 && englishHits >= indonesianHits && tokens.length <= 14)
}

async function refineIndonesianHeadline({ title, sourceTitle, sourceContent, excerpt, content, categories, runModel }) {
    const cleanTitle = stripHeadlineLabel(title)
    if (!titleNeedsRewrite(cleanTitle)) return cleanTitle

    if (typeof runModel !== 'function') return cleanTitle

    const contextText = [
        `Judul sumber: ${sourceTitle || ''}`,
        `Judul saat ini: ${cleanTitle || ''}`,
        `Kategori: ${(categories || []).join(', ') || 'Berita'}`,
        `Ringkasan: ${(excerpt || content || '').slice(0, 600)}`,
        `Konteks sumber: ${(sourceContent || '').slice(0, 1200)}`,
    ].join('\n')

    const rewriteMessages = [
        {
            role: 'system',
            content: 'Kamu adalah editor judul berita Indonesia. Tulis hanya satu judul final dalam bahasa Indonesia yang natural, tajam, dan SEO-friendly. Jangan memakai bahasa Inggris kecuali nama diri, merek, atau produk.',
        },
        {
            role: 'user',
            content: `Buat ulang judul berikut agar benar-benar dalam bahasa Indonesia, lebih menarik, dan tetap akurat.

Syarat wajib:
- Output hanya satu baris judul
- Tidak boleh ada penjelasan tambahan, tanda kutip, atau label
- Panjang ideal 55-90 karakter
- Gunakan struktur headline media Indonesia yang natural, bukan terjemahan harfiah
- Hindari kata-kata Inggris seperti update, latest, reveals, launches, boosts, reports, says, live
- Jika ada angka atau dampak penting, tampilkan secara jelas

${contextText}`,
        },
    ]

    try {
        const rewriteResponse = await runModel(rewriteMessages, { maxTokens: 160, temperature: 0.2 })
        const candidate = extractHeadlineFromModel(rewriteResponse)
        if (candidate && !titleNeedsRewrite(candidate)) return candidate
    } catch (error) {
        console.warn(`[ID-WORKER] Headline rewrite failed: ${error.message}`)
    }

    return cleanTitle
}

async function generateArticleWithOpenRouter(sourceTitle, sourceContent, sourceName) {
    const prompt = `Kamu adalah jurnalis profesional Indonesia untuk portal berita digital qbitznews.com.
Sumber berita mungkin dalam bahasa Inggris — WAJIB terjemahkan dan tulis SELURUH artikel dalam bahasa Indonesia.

---
JUDUL SUMBER: ${sourceTitle}
    KONTEN SUMBER: ${sourceContent.slice(0, 500)}
---

Tulis output PERSIS dalam format berikut:

JUDUL: Tulis judul artikel di sini dalam BAHASA INDONESIA, SEO-friendly, 55-90 karakter

IMAGE_HINT: 4-6 kata BAHASA INGGRIS untuk foto Unsplash

EXCERPT: 1-2 kalimat teaser dalam BAHASA INDONESIA, 120-155 karakter

CATEGORY: 1-2 kategori dari daftar: Kripto & Blockchain | Teknologi | Politik | Ekonomi | Olahraga | Sepakbola | Hiburan | Kesehatan | Pendidikan | Hukum & Kriminal | Lingkungan | Berita

ARTIKEL:
Isi artikel 350-400 kata dalam BAHASA INDONESIA menggunakan Markdown

ATURAN WAJIB:
- SELURUH judul, excerpt, dan isi artikel HARUS dalam bahasa Indonesia — DILARANG menulis dalam bahasa Inggris
- Hanya IMAGE_HINT yang boleh dalam bahasa Inggris
- Terjemahkan semua istilah teknis ke padanan Indonesia atau beri penjelasan

ATURAN JUDUL (wajib CTR tinggi, bahasa alami):
- Spesifik: sebut siapa/apa/angka penting jika tersedia di artikel
- Jika sumber berita berbahasa Inggris, JANGAN terjemahkan secara harfiah; ubah jadi headline berita Indonesia yang natural
- Gunakan kata kerja yang LAZIM dipakai media berita Indonesia, sesuai konteks:
  * Olahraga: Tumbang, Takluk, Menang, Kalahkan, Hancurkan, Hantam, Susul, Geser, Cedera, Absen, Comeback, Kunci, Lolos, Tersingkir, Raih
  * Politik/Hukum: Ditetapkan, Ditangkap, Dicopot, Mundur, Lantik, Sahkan, Tolak, Gugat, Vonis, Pecat
  * Bisnis/Ekonomi: Akuisisi, Rugi, Untung, Bangkrut, PHK, Ekspansi, Investasi, Merger, Naik, Turun
  * Teknologi: Luncurkan, Rilis, Blokir, Bajak, Bocor, Perbarui, Tutup, Akuisisi
  * Umum: Ungkap, Konfirmasi, Bantah, Akui, Peringatkan, Desak, Serukan
- HINDARI kata kerja yang janggal/tidak natural: "Tersandung Kalah", "Terhenti Menang", "Lampaui Kalahkan"
- JANGAN mulai dengan: The, A, An, Sebuah, Ini adalah
- JANGAN sertakan tanggal, sumber, atau label apapun dalam judul
- GUNAKAN TEKNIK HIGH-CTR (pilih yang paling sesuai):
  * Sertakan angka/data jika ada: "73% Pengguna...", "5 Negara yang...", "Rp 2 Triliun..."
  * Curiosity gap: "Alasan Sebenarnya...", "Apa yang Benar-Benar Terjadi Saat...", "Cara X Berhasil..."
  * Power words: "Akhirnya Terungkap", "Diam-Diam", "Mengejutkan", "Membuktikan"
  * Tunjukkan dampak: "...dan Ini Bisa Ubah Segalanya", "...yang Mengancam Jutaan Orang"
  * Konflik/ketegangan: "Menolak", "Menentang", "Membongkar", "Menggugat"
- Contoh BAIK — alami dan CTR tinggi:
  * "Bitcoin Tembus $100.000 Pertama Kali, Analis Ungkap Faktor Pemicunya"
  * "Doncic Cedera Hamstring, Lakers Tumbang di Kandang Thunder"
  * "Chelsea Pecat Fernandez Usai Insiden Panas yang Guncang Internal Klub"
  * "Ilmuwan Akhirnya Ungkap Alasan 1 dari 3 Terapi Kanker Berhenti Bekerja"
  * "Cara Meta Diam-Diam Bangun AI yang Kalahkan GPT-4 di Semua Benchmark"
- Contoh BURUK: "Lakers Tersandung Kalah di Kandang", "Kunjungan Kehormatan", "Situasi Terkini", "Meta Boosts Code Review""

ATURAN IMAGE_HINT:
- WAJIB bahasa Inggris (untuk pencarian foto Unsplash)
- Gunakan benda/tempat/aktivitas yang TERLIHAT secara visual, BUKAN konsep abstrak
- Contoh BAIK: "government building official ceremony", "courtroom judge gavel", "football stadium match crowd", "bitcoin cryptocurrency trading screen", "hospital doctor patient examination"
- Contoh BURUK: "remote office teamwork", "peaceful reconciliation", "national issue", "leadership challenge"
- Sesuaikan dengan topik artikel: korupsi → "courtroom justice gavel", olahraga → jenis olahraga spesifik, teknologi → perangkat spesifik

ATURAN EXCERPT (wajib compelling):
- WAJIB bahasa Indonesia
- 1-2 kalimat yang bikin pembaca penasaran/tertarik klik
- Jangan ulangi judul — tambahkan info baru atau bangun ketegangan
- Highlight sudut paling mengejutkan atau paling berdampak dari berita
- JANGAN mulai dengan: "Artikel ini membahas", "Dalam artikel ini", "Simak informasi"
- Contoh BAIK:
  * "Dokumen internal bocor ungkap pengujian dilakukan berbulan-bulan sebelum publik tahu — dan hasilnya mengejutkan para pembuatnya sendiri."
  * "Keputusan diambil setelah rapat tertutup enam jam yang berakhir dengan ketegangan tinggi di antara petinggi klub."
  * "Para ahli memperingatkan putusan ini bisa berdampak pada jutaan pengguna di lebih dari 40 negara."
- Contoh BURUK: "Baca artikel ini untuk mengetahui lebih lanjut.", "Chelsea memecat pemain mereka."

ATURAN ARTIKEL:
- Gaya jurnalistik profesional, bahasa formal tapi mudah dipahami.
- TULIS SEPERTI MANUSIA: Gunakan variasi panjang kalimat (kalimat pendek untuk penegasan, kalimat panjang untuk penjelasan).
- HINDARI frasa klise AI yang sering terdeteksi sebagai spam (contoh: "Di era digital ini", "Penting untuk diingat bahwa", "Kesimpulannya", "Tidak dapat dipungkiri").
- Sertakan konteks lokal, opini analitis, atau dampak nyata dari kejadian tersebut agar tidak sekadar menjadi tulisan ulang (rewrite).
- Gunakan ## untuk sub-judul jika topik membutuhkan struktur.
- JANGAN heading generik: Pendahuluan, Kesimpulan, Latar Belakang.
- Akhiri dengan paragraf penutup yang tajam tanpa merangkum ulang isi berita.`

    const orMessages = [
        { role: 'system', content: 'Kamu adalah jurnalis profesional Indonesia. WAJIB menulis SELURUH output dalam bahasa Indonesia, kecuali IMAGE_HINT. JANGAN gunakan tanda kurung siku [] dalam output. Ikuti format yang diberikan dengan tepat. Jangan tambahkan preamble, penjelasan, atau komentar apapun.' },
        { role: 'user', content: prompt }
    ]
    let groqKey = groqKeyManager ? groqKeyManager.getNextKey() : (process.env.GROQ_API_KEY_ID || process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY)

    async function callGroqModel(messages, { model = GROQ_MODEL, maxTokens = 1200, temperature = 0.7 } = {}) {
        if (!groqKey) return null

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            { model, messages, max_tokens: maxTokens, temperature },
            { headers: { 'Authorization': 'Bearer ' + groqKey, 'Content-Type': 'application/json' }, timeout: 120000 }
        )
        if (groqKeyManager) groqKeyManager.recordSuccess(groqKey)
        return response.data
    }

    async function runModel(messages, { maxTokens = 1200, temperature = 0.7 } = {}) {
        const groqKeysToTry = groqKeyManager?.keys?.length
            ? groqKeyManager.keys
            : (groqKey ? [groqKey] : [])
        let lastErr = null

        for (const candidateKey of groqKeysToTry) {
            groqKey = candidateKey
            const modelsToTry = [...new Set(GROQ_MODEL_FALLBACKS)]

            for (const model of modelsToTry) {
                try {
                    const tunedMaxTokens = model === 'llama-3.1-8b-instant'
                        ? Math.min(maxTokens, 650)
                        : maxTokens
                    return await callGroqModel(messages, { model, maxTokens: tunedMaxTokens, temperature })
                } catch (err) {
                    lastErr = err
                    const status = err.response?.status
                    const shouldContinueModel = status === 429 || status === 500 || status === 503 || !err.response

                    if (shouldContinueModel) {
                        console.warn(`[ID-WORKER] Groq model ${model} on key ...${String(candidateKey).slice(-6)} failed (${status || 'network'}), trying next model...`)
                        continue
                    }

                    throw err
                }
            }

            const keyStatus = lastErr?.response?.status
            if (keyStatus === 429 && groqKeyManager) {
                groqKeyManager.recordFailure(candidateKey, 'rate_limit_exceeded')
            }
            console.warn(`[ID-WORKER] Groq key ...${String(candidateKey).slice(-6)} exhausted, trying next key...`)
        }

        throw lastErr || new Error('All Groq keys failed')
    }

    try {
        const responseData = await runModel(orMessages, { maxTokens: 1300, temperature: 0.7 })
        const fullContent = responseData?.choices?.[0]?.message?.content || ''
        if (!fullContent) throw new Error('Empty content from Groq')

        // === PARSE SEMUA METADATA FIELDS SEKALIGUS ===
        const VALID_CATEGORIES = new Set(['Kripto & Blockchain', 'Teknologi', 'Politik', 'Ekonomi', 'Olahraga', 'Sepakbola', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Hukum & Kriminal', 'Lingkungan', 'Berita'])
        const allLines = fullContent.split('\n')

        // Scan SEMUA baris untuk cari metadata fields (IMAGE_HINT, EXCERPT, CATEGORY)
        // Hapus dari rawLines supaya tidak masuk ke body/title
        let aiImageHint = ''
        let aiCategories = []
        let aiExcerpt = ''
        const metadataLineIndices = new Set()

        let aiTitleFromField = ''
        const metadataLabelPatterns = [
            { name: 'title', regex: /^judul(?:\s*[:\-]|\s+)\s*(.*)$/i },
            { name: 'image_hint', regex: /^image[_\s-]?hint(?:\s*[:\-]|\s+)\s*(.*)$/i },
            { name: 'category', regex: /^category(?:\s*[:\-]|\s+)\s*(.*)$/i },
            { name: 'excerpt', regex: /^excerpt(?:\s*[:\-]|\s+)\s*(.*)$/i },
        ]
        let pendingMetaField = null

        for (let i = 0; i < allLines.length; i++) {
            const line = allLines[i].trim()
            if (/^artikel(?:\s*[:\-]?\s*)$/i.test(line)) {
                metadataLineIndices.add(i)
                pendingMetaField = null
                continue
            }

            let matchedMeta = false
            for (const pattern of metadataLabelPatterns) {
                const match = line.match(pattern.regex)
                if (!match) continue
                matchedMeta = true
                metadataLineIndices.add(i)
                const value = match[1].trim()
                if (value) {
                    if (pattern.name === 'title' && value.length > 10) {
                        aiTitleFromField = value.replace(/^\[|\]$/g, '').trim()
                    }
                    if (pattern.name === 'image_hint') aiImageHint = value
                    if (pattern.name === 'category') aiCategories = value.split(',').map(c => c.trim()).filter(c => VALID_CATEGORIES.has(c))
                    if (pattern.name === 'excerpt' && value.length > 20) aiExcerpt = value
                    pendingMetaField = null
                } else {
                    pendingMetaField = pattern.name
                }
                break
            }
            if (matchedMeta) continue

            if (pendingMetaField && line) {
                metadataLineIndices.add(i)
                if (pendingMetaField === 'title' && line.length > 10) {
                    aiTitleFromField = line.replace(/^\[|\]$/g, '').trim()
                }
                if (pendingMetaField === 'image_hint') aiImageHint = line
                if (pendingMetaField === 'category') aiCategories = line.split(',').map(c => c.trim()).filter(c => VALID_CATEGORIES.has(c))
                if (pendingMetaField === 'excerpt' && line.length > 20) aiExcerpt = line
                pendingMetaField = null
                continue
            }
        }

        // Buat rawLines tanpa baris metadata
        const rawLines = allLines.filter((_, i) => !metadataLineIndices.has(i))

        // Extract title: prioritas dari field JUDUL:, fallback ke baris pertama
        let title = ''
        let contentStartIndex = 0
        let content = ''

        if (aiTitleFromField && aiTitleFromField.length >= 15) {
            title = aiTitleFromField
            contentStartIndex = 0
        } else {
            const skipLinePattern = /^(judul|image[_\s-]?hint|category|excerpt|artikel|source|sumber|tanggal|date|by\s|author|baris\s*\d|\d{1,2}\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)|january|february|march|april|may|june|july|august|september|october|november|december)/i
            const dateOnlyPattern = /^\d{1,2}[\s\/\-]+(\d{1,2}[\s\/\-]+)?\d{2,4}$/
            for (let i = 0; i < Math.min(rawLines.length, 12); i++) {
                const line = rawLines[i].trim()
                if (!line) continue
                if (skipLinePattern.test(line) || dateOnlyPattern.test(line)) continue
                title = line
                    .replace(/^#+\s*/, '')
                    .replace(/^baris\s*\d+\s*:?\s*/i, '')
                    .replace(/^\*\*(.+)\*\*$/, '$1')
                    .replace(/\*\*/g, '')
                    .trim()
                contentStartIndex = i + 1
                break
            }
        }

        // Safety net: strip bracket yang ikut tertulis oleh AI (e.g. [Judul artikel...])
        title = stripHeadlineLabel(title.replace(/^\[(.+)\]$/, '$1'))

        title = await refineIndonesianHeadline({
            title,
            sourceTitle,
            sourceContent,
            excerpt: aiExcerpt,
            content,
            categories: aiCategories,
            runModel,
        })

        title = stripHeadlineLabel(title)

        if (!title || title.length < 15) title = sourceTitle.split(' - ')[0].trim().slice(0, 90)
        if (title.length > 120) title = title.slice(0, 117).trim() + '...'

        // Clean body — ambil dari setelah judul, tanpa baris metadata
        const bodyLines = rawLines.slice(contentStartIndex)
        while (bodyLines.length > 0 && !bodyLines[0].trim()) bodyLines.shift()
        content = bodyLines.join('\n').trim()

        // Bersihkan sisa metadata yang mungkin masih masuk ke body (safety net)
        content = content
            .replace(/^judul(?:\s*[:\-]|\s+)[^\n]*/gim, '')
            .replace(/^artikel(?:\s*[:\-]?\s*)/gim, '')
            .replace(/^image[_\s-]?hint(?:\s*[:\-]|\s+)[^\n]*/gim, '')
            .replace(/^excerpt(?:\s*[:\-]|\s+)[^\n]*/gim, '')
            .replace(/^category(?:\s*[:\-]|\s+)[^\n]*/gim, '')
            .replace(/^baris\s*\d+\s*[:\-]?\s*/gim, '')
            .replace(/^source(?:\s*[:\-]|\s+)[^\n]*/gim, '')
            .replace(/^sumber(?:\s*[:\-]|\s+)[^\n]*/gim, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim()

        // Excerpt: prioritas AI-generated, fallback dari paragraf pertama
        let excerpt = ''
        if (aiExcerpt) {
            excerpt = aiExcerpt
            console.log(`[EXCERPT] Menggunakan AI-generated excerpt (${excerpt.length} chars)`)
        } else {
            for (const line of content.split('\n')) {
                const t = line.trim()
                if (!t || t.startsWith('#') || t.startsWith('|') || t.startsWith('-') || t.startsWith('*')) continue
                excerpt = t.replace(/\*\*/g, '').trim()
                break
            }
            if (!excerpt) excerpt = `Baca artikel lengkap tentang ${title}.`
            excerpt = excerpt.split('. ').slice(0, 2).join('. ')
            if (!excerpt.endsWith('.')) excerpt += '.'
            console.log(`[EXCERPT] Menggunakan fallback paragraph excerpt`)
        }
        // Potong excerpt di batas kalimat atau batas kata, max 155 chars
        if (excerpt.length > 155) {
            // Coba potong di akhir kalimat (. ! ?)
            const sentenceEnd = excerpt.slice(0, 155).search(/[.!?][^.!?]*$/)
            if (sentenceEnd > 80) {
                excerpt = excerpt.slice(0, sentenceEnd + 1).trim()
            } else {
                // Fallback: potong di akhir kata terakhir, tambah ...
                excerpt = excerpt.slice(0, 152).replace(/\s+\S*$/, '').trimEnd() + '...'
            }
        }

        // Fallback excerpt: ambil dari paragraf pertama konten bersih
        if (!excerpt) {
            for (const line of content.split('\n')) {
                const t = line.trim()
                if (!t || t.startsWith('#') || t.startsWith('|') || t.startsWith('-') || t.startsWith('*')) continue
                excerpt = t.replace(/\*\*/g, '').trim()
                break
            }
            if (!excerpt) excerpt = `Baca artikel lengkap tentang ${title}.`
            excerpt = excerpt.split('. ').slice(0, 2).join('. ')
            if (!excerpt.endsWith('.')) excerpt += '.'
            console.log(`[EXCERPT] Menggunakan fallback paragraph excerpt`)
        }
        // Trim to max 155 chars
        // Potong excerpt di batas kalimat atau batas kata, max 155 chars
        if (excerpt.length > 155) {
            // Coba potong di akhir kalimat (. ! ?)
            const sentenceEnd = excerpt.slice(0, 155).search(/[.!?][^.!?]*$/)
            if (sentenceEnd > 80) {
                excerpt = excerpt.slice(0, sentenceEnd + 1).trim()
            } else {
                // Fallback: potong di akhir kata terakhir, tambah ...
                excerpt = excerpt.slice(0, 152).replace(/\s+\S*$/, '').trimEnd() + '...'
            }
        }

        const usage = responseData?.usage || {}
        const finishReason = responseData?.choices?.[0]?.finish_reason || ''

        // ── Validasi kelengkapan artikel ────────────────────────────────────
        // 1. Konten terlalu pendek — AI gagal/terpotong
        const wordCount = content.split(/\s+/).filter(Boolean).length
        if (wordCount < 120) {
            throw new Error(`Konten terlalu pendek (${wordCount} kata, min 120) — tidak disimpan: "${title.slice(0, 60)}"`)
        }

        // 2. Jika terpotong karena limit token, izinkan selama masih cukup panjang
        if (finishReason === 'length' && wordCount < 160) {
            throw new Error(`Artikel terpotong (finish_reason=length, ${wordCount} kata) — tidak disimpan: "${title.slice(0, 60)}"`)
        }

        // 3. Kalimat terakhir terpotong — hanya throw jika benar-benar terpotong di tengah kata
        const trimmedContent = content.trimEnd()
        const lastChar = trimmedContent.slice(-1)
        // Karakter valid penutup: tanda baca, huruf, angka, tanda kutip, kurung tutup
        const incompleteEnding = !/[.!?"'\)\]»\*\-a-zA-Z0-9]/.test(lastChar)
        // Cek baris terakhir: terpotong hanya kalau diakhiri koma atau kata sambung
        const lastLine = trimmedContent.split('\n').pop()?.trim() || ''
        const endsWithConjunction = /,\s*$|\b(and|or|but|the|a|an|in|on|at|to|for|of|with|yang|dan|atau|di|ke|dari|untuk|dengan|pada|oleh|sebagai|karena|jika|saat|agar|bahwa)\s*$/i.test(lastLine)
        if (incompleteEnding || endsWithConjunction) {
            throw new Error(`Konten tidak selesai (kalimat terpotong) — tidak disimpan: "${title.slice(0, 60)}"`)
        }

        // 4. Judul tidak valid
        if (!title || title.length < 15) {
            throw new Error(`Judul terlalu pendek atau kosong — tidak disimpan`)
        }

        return {
            title,
            content,
            excerpt,
            image_hint: aiImageHint || title.split(' ').slice(0, 5).join(' '),
            categories: aiCategories,
            tokens: { prompt: usage.prompt_tokens || 0, completion: usage.completion_tokens || 0, total: usage.total_tokens || 0 },
            cost: (usage.total_tokens || 0) * 0.00000015,
            model: GROQ_MODEL,
        }
    } catch (err) {
        console.error(`[ID-WORKER] Structured generation failed: ${err.message}`)
        throw err
    }
}

// ============================================
// IMAGE HELPERS (ported & adapted from worker.js)
// ============================================

// ── Source image extraction ──────────────────────────────────────────────────

function normalizeImageUrl(url, baseUrl = '') {
    if (!url || typeof url !== 'string') return null
    if (url.startsWith('data:')) return null
    try { return new URL(url, baseUrl).href } catch { return null }
}

const BLOCKED_IMAGE_HOSTS = new Set(['news.google.com', 'www.gstatic.com'])
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
    const htmlSources = [item.content, item['content:encoded'], item.summary].filter(Boolean).join(' ')
    const imgMatch = htmlSources.match(/<img[^>]+src=["']([^"']+)["']/i)
    if (!imgMatch) return null
    const normalized = normalizeImageUrl(imgMatch[1])
    return isLikelyUsableImage(normalized) ? normalized : null
}

async function fetchSourceImage(sourceUrl) {
    if (!sourceUrl) return null
    try {
        const response = await axios.get(sourceUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
            },
            timeout: 10000,
            maxRedirects: 5,
            maxContentLength: HTML_FETCH_MAX_BYTES,
            maxBodyLength: HTML_FETCH_MAX_BYTES,
        })
        const html = String(response.data || '').slice(0, HTML_FETCH_MAX_BYTES)
        const $ = cheerio.load(html)
        const candidates = [
            $('meta[property="og:image:secure_url"]').attr('content'),
            $('meta[property="og:image"]').attr('content'),
            $('meta[name="twitter:image:src"]').attr('content'),
            $('meta[name="twitter:image"]').attr('content'),
            $('article img').first().attr('src'),
            $('main img').first().attr('src'),
        ]
        for (const candidate of candidates) {
            const normalized = normalizeImageUrl(candidate, sourceUrl)
            if (isLikelyUsableImage(normalized)) {
                console.log(`[ID-WORKER] Source page image: ${normalized.slice(0, 80)}`)
                return normalized
            }
        }
    } catch (err) {
        console.log(`[ID-WORKER] Source image lookup failed: ${err.message}`)
    }
    return null
}


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
      featured_image, excerpt, author, views, language, category)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
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
            (article.categories || []).join(', ') || null,
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
    const titleLower = (title || '').toLowerCase()
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

    const sportsBudget = Math.round(CRAWL_CONFIG.TOTAL_BUDGET * CRAWL_CONFIG.SPORTS_RATIO)
    const localBudget = Math.round(CRAWL_CONFIG.TOTAL_BUDGET * CRAWL_CONFIG.LOCAL_RATIO)
    const techBudget = Math.round(CRAWL_CONFIG.TOTAL_BUDGET * CRAWL_CONFIG.TECH_RATIO)
    const cryptoBudget = Math.round(CRAWL_CONFIG.TOTAL_BUDGET * CRAWL_CONFIG.CRYPTO_RATIO)
    const otherBudget = Math.max(0, CRAWL_CONFIG.TOTAL_BUDGET - sportsBudget - localBudget - techBudget - cryptoBudget)
    console.log(`[ID-WORKER] Budget: ${CRAWL_CONFIG.TOTAL_BUDGET} | Olahraga: ${sportsBudget} | Lokal: ${localBudget} | Tech: ${techBudget} | Crypto: ${cryptoBudget} | Lainnya: ${otherBudget}`)

    const sportsFeedIds = new Set(['sp-001', 'sp-002', 'sp-003', 'sp-004', 'sp-005', 'sp-006', 'sp-007', 'sp-008', 'sp-009', 'sp-010', 'ms-001', 'ms-002', 'ms-003', 'ms-004', 'ms-005', 'ms-006', 'ms-007'])
    const localFeedIds = new Set(['id-001', 'id-002', 'id-003', 'id-004', 'id-005', 'id-006', 'id-007', 'id-008', 'id-009', 'id-010', 'id-011', 'id-012'])
    const techFeedIds = new Set(['tc-001', 'tc-002', 'tc-003', 'tc-004', 'tc-005', 'tc-006'])
    const cryptoFeedIds = new Set(['cr-001', 'cr-002', 'cr-003', 'cr-004'])

    const sportsFeeds = ID_FEEDS.filter(f => sportsFeedIds.has(f.id)).sort(() => Math.random() - 0.5)
    const localFeeds = ID_FEEDS.filter(f => localFeedIds.has(f.id)).sort(() => Math.random() - 0.5)
    const techFeeds = ID_FEEDS.filter(f => techFeedIds.has(f.id)).sort(() => Math.random() - 0.5)
    const cryptoFeeds = ID_FEEDS.filter(f => cryptoFeedIds.has(f.id)).sort(() => Math.random() - 0.5)
    const otherFeeds = ID_FEEDS.filter(f => !sportsFeedIds.has(f.id) && !localFeedIds.has(f.id) && !techFeedIds.has(f.id) && !cryptoFeedIds.has(f.id)).sort(() => Math.random() - 0.5)

    let totalGenerated = 0
    let sportsGenerated = 0
    let localGenerated = 0
    let techGenerated = 0
    let cryptoGenerated = 0

    // Helper: process one feed up to a given remaining budget
    async function processFeed(feed, remaining) {
        if (remaining <= 0) return 0
        console.log(`[ID-WORKER] Fetching: ${feed.name}`)
        const items = await fetchRSS(feed.url)
        if (items.length === 0) { console.log(`[ID-WORKER] No items from ${feed.name}`); return 0 }

        let fromSource = 0
        for (const item of items.slice(0, CRAWL_CONFIG.MAX_PER_SOURCE)) {
            if (fromSource >= remaining) break
            if (!item.title || item.title.length < 10) continue

            // Dedup: check source URL
            if (item.link) {
                let normalizedLink = item.link.trim()
                try {
                    const u = new URL(normalizedLink)
                        ;['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'source'].forEach(p => u.searchParams.delete(p))
                    normalizedLink = (u.origin + u.pathname + (u.search !== '?' ? u.search : '')).replace(/\/$/, '')
                } catch { }
                // Cek duplikat hanya untuk bahasa ID — URL yang sama boleh dibuat versi EN dan ID
                const dup = await pool.query("SELECT id FROM articles WHERE LOWER(TRIM(source_url))=LOWER(TRIM($1)) AND language='id' LIMIT 1", [normalizedLink])
                if (dup.rows.length > 0) { console.log(`[ID-WORKER] Skip dup URL (id): ${normalizedLink.slice(0, 60)}`); item.link = normalizedLink; continue }
                item.link = normalizedLink
            }

            // Dedup: check title (hanya dalam bahasa ID)
            const dupTitle = await pool.query("SELECT id FROM articles WHERE LOWER(TRIM(title))=LOWER(TRIM($1)) AND language='id' LIMIT 1", [item.title])
            if (dupTitle.rows.length > 0) { console.log(`[ID-WORKER] Skip dup title (id): ${item.title.slice(0, 50)}`); continue }

            // Filter promosi — cek source title SEBELUM panggil AI (hemat token)
            let sourceContent = item.content || item.summary || ''
            if (item.link && sourceContent.trim().length < 250) {
                const fullContent = await fetchFullArticleContent(item.link)
                if (fullContent && fullContent.trim().length > sourceContent.trim().length) {
                    sourceContent = fullContent
                    console.log(`[ID-WORKER] Using full article content (${sourceContent.length} chars)`)
                }
            }

            const prePromo = detectPromotionalContent(item.title, sourceContent)
            if (prePromo.isPromo) {
                console.log(`[ID-WORKER] Skip promosi (pre-AI): ${prePromo.reason}`)
                continue
            }

            try {
                console.log(`[ID-WORKER] → Generating: "${item.title.slice(0, 60)}"`)
                const generated = await generateArticleWithOpenRouter(item.title, sourceContent, feed.name)

                // Dedup: check generated title (hanya dalam bahasa ID)
                const dupGen = await pool.query("SELECT id FROM articles WHERE LOWER(TRIM(title))=LOWER(TRIM($1)) AND language='id' LIMIT 1", [generated.title])
                if (dupGen.rows.length > 0) { console.log(`[ID-WORKER] Skip dup generated (id): ${generated.title.slice(0, 50)}`); continue }

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

                // Fetch image:
                // - Media lokal Indonesia (noSourceImage=true): langsung Unsplash (hindari watermark)
                // - Media internasional: RSS/og:image dulu, fallback Unsplash
                const imageUrl = feed.noSourceImage
                    ? await fetchImageFromUnsplash({
                        imageHint: generated.image_hint,
                        title: generated.title,
                        excerpt: generated.excerpt,
                        categories,
                    })
                    : (
                        item.sourceImage ||
                        await fetchSourceImage(item.link) ||
                        await fetchImageFromUnsplash({
                            imageHint: generated.image_hint,
                            title: generated.title,
                            excerpt: generated.excerpt,
                            categories,
                        })
                    )

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
                // Notify Google Indexing API
                const artId = saved.id
                const artTitleSlug = (generated.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
                const artUrl = artTitleSlug
                    ? `https://qbitznews.com/id/articles/${artId}-${artTitleSlug}`
                    : `https://qbitznews.com/id/articles/${artId}`
                // notifyGoogleIndexing(artUrl).catch(() => { }) // Dinonaktifkan: Google Indexing API untuk berita menyebabkan penalti SEO
                notifyBingIndexing(artUrl).catch(() => { })

                // Polite delay
                await new Promise(r => setTimeout(r, 2000))
            } catch (err) {
                console.error(`[ID-WORKER] Failed to process "${item.title.slice(0, 50)}": ${err.message}`)
                await new Promise(r => setTimeout(r, 3000))
            }
        }
        if (fromSource > 0) console.log(`[ID-WORKER] ${fromSource} article(s) from ${feed.name}`)
        return fromSource
    }

    // ── 1. Sports feeds (target: ~40%) ──────────────────────────────────────
    for (const feed of sportsFeeds) {
        if (sportsGenerated >= sportsBudget) break
        const n = await processFeed(feed, sportsBudget - sportsGenerated)
        sportsGenerated += n
    }
    console.log(`[ID-WORKER] Olahraga: ${sportsGenerated}/${sportsBudget}`)

    // ── 2. Local Indonesian feeds (target: ~30%) ──────────────────────────
    for (const feed of localFeeds) {
        if (localGenerated >= localBudget || totalGenerated >= CRAWL_CONFIG.TOTAL_BUDGET) break
        const n = await processFeed(feed, Math.min(localBudget - localGenerated, CRAWL_CONFIG.TOTAL_BUDGET - totalGenerated))
        localGenerated += n
    }
    console.log(`[ID-WORKER] Lokal: ${localGenerated}/${localBudget}`)

    // ── 3. Tech (target: ~20%) ──────────────────────────
    for (const feed of techFeeds) {
        if (techGenerated >= techBudget || totalGenerated >= CRAWL_CONFIG.TOTAL_BUDGET) break
        const n = await processFeed(feed, Math.min(techBudget - techGenerated, CRAWL_CONFIG.TOTAL_BUDGET - totalGenerated))
        techGenerated += n
    }
    console.log(`[ID-WORKER] Tech: ${techGenerated}/${techBudget}`)

    // ── 4. Crypto (target: ~20%) ──────────────────────────
    for (const feed of cryptoFeeds) {
        if (cryptoGenerated >= cryptoBudget || totalGenerated >= CRAWL_CONFIG.TOTAL_BUDGET) break
        const n = await processFeed(feed, Math.min(cryptoBudget - cryptoGenerated, CRAWL_CONFIG.TOTAL_BUDGET - totalGenerated))
        cryptoGenerated += n
    }
    console.log(`[ID-WORKER] Crypto: ${cryptoGenerated}/${cryptoBudget}`)

    // ── 5. Others (business, misc) fill remaining budget ──────────
    for (const feed of otherFeeds) {
        if (totalGenerated >= CRAWL_CONFIG.TOTAL_BUDGET) break
        const n = await processFeed(feed, CRAWL_CONFIG.TOTAL_BUDGET - totalGenerated)
        totalGenerated += n
    }

    console.log(`[ID-WORKER] ===== Cycle done: ${totalGenerated} articles generated =====\n`)
}

// ============================================
// SCHEDULE: every 45 minutes
// ============================================
cron.schedule('*/90 * * * *', () => {
    crawlIndonesian().catch(err => console.error('[ID-WORKER] Crawl error:', err.message))
})

// Run immediately on startup
crawlIndonesian().catch(err => console.error('[ID-WORKER] Initial crawl error:', err.message))

console.log('[ID-WORKER] Scheduled every 90 minutes. Running first crawl now...')
