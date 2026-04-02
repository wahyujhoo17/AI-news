"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Navbar from "./components/Navbar"
import Footer from "./components/Footer"
import { buildArticlePath } from "@/lib/article-slug"

interface Article {
  id: number
  title: string
  content: string
  source_name: string
  source_url: string
  published_at: string | null
  created_at: string
  excerpt?: string
  author?: string
  views?: number
  categories?: string
  featured_image?: string
}

interface Category {
  id: number
  name: string
  slug: string
  color?: string
  article_count?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return ""
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function catColor(article: Article, categories: Category[]): string {
  if (!article.categories) return "#06B6D4"
  const name = article.categories.split(",")[0].trim()
  return categories.find((c) => c.name === name)?.color || "#06B6D4"
}

// ── Trending Ticker ───────────────────────────────────────────────────────────

function TrendingTicker({ articles, prefix }: { articles: Article[]; prefix: string }) {
  if (!articles.length) return null
  return (
    <div className="bg-black/70 border-b border-red-500/20 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-10 gap-4 overflow-hidden">
        <span className="flex-shrink-0 px-3 py-1 bg-red-600 text-white text-xs font-black uppercase tracking-wider rounded">
          🔥 Trending
        </span>
        <div className="flex gap-8 overflow-x-auto whitespace-nowrap flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {articles.map((a, i) => (
            <Link
              key={a.id}
              href={prefix + buildArticlePath(a.id, a.title)}
              className="text-sm text-gray-300 hover:text-cyan-300 transition-colors flex-shrink-0"
            >
              <span className="text-red-400 font-bold mr-1.5">{i + 1}.</span>
              {a.title.length > 72 ? a.title.slice(0, 72) + "\u2026" : a.title}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Hero Section ──────────────────────────────────────────────────────────────

function HeroSection({
  featured,
  secondary,
  categories,
  prefix,
}: {
  featured: Article
  secondary: Article[]
  categories: Category[]
  prefix: string
}) {
  const color = catColor(featured, categories)
  return (
    <section className="mb-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Big featured card */}
        <Link
          href={prefix + buildArticlePath(featured.id, featured.title)}
          className="lg:col-span-2 group relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-black/40 hover:border-cyan-400/50 transition-all duration-300 min-h-[300px] lg:min-h-[420px] flex"
        >
          {featured.featured_image ? (
            <img
              src={featured.featured_image}
              alt={featured.title}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-950" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="relative flex flex-col justify-end p-6 lg:p-8 w-full">
            {featured.categories && (
              <span
                className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white mb-3 self-start"
                style={{ background: color }}
              >
                {featured.categories.split(",")[0].trim()}
              </span>
            )}
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-widest">Featured</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-black text-white group-hover:text-cyan-200 transition-colors leading-tight line-clamp-3 mb-3">
              {featured.title}
            </h2>
            <p className="text-gray-300 text-sm line-clamp-2 mb-3 hidden md:block">
              {featured.excerpt || featured.content?.slice(0, 130) + "\u2026"}
            </p>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>{timeAgo(featured.published_at || featured.created_at)}</span>
            </div>
          </div>
        </Link>

        {/* Stacked secondary articles */}
        <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 lg:h-[420px]">
          {secondary.slice(0, 4).map((article) => (
            <Link
              key={article.id}
              href={prefix + buildArticlePath(article.id, article.title)}
              className="group flex-shrink-0 w-72 lg:w-auto flex gap-3 p-3 rounded-xl border border-cyan-500/20 bg-black/40 hover:border-cyan-400/50 hover:bg-black/60 transition-all duration-200 lg:flex-1"
            >
              {article.featured_image && (
                <img
                  src={article.featured_image}
                  alt={article.title}
                  className="w-20 h-16 lg:w-16 lg:h-14 object-cover rounded-lg flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-2 leading-snug">
                  {article.title}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <span>{timeAgo(article.published_at || article.created_at)}</span>
                  {article.categories && (
                    <>
                      <span>•</span>
                      <span style={{ color: catColor(article, categories) + "cc" }}>
                        {article.categories.split(",")[0].trim()}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Article Card ──────────────────────────────────────────────────────────────

function ArticleCard({ article, categories, prefix }: { article: Article; categories: Category[]; prefix: string }) {
  const color = catColor(article, categories)
  return (
    <Link
      href={prefix + buildArticlePath(article.id, article.title)}
      className="group flex flex-col rounded-xl border border-cyan-500/20 bg-black/40 backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10 overflow-hidden"
    >
      <div className="relative h-44 bg-gradient-to-br from-slate-900 via-blue-900/40 to-slate-950 overflow-hidden flex-shrink-0">
        {article.featured_image ? (
          <img
            src={article.featured_image}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <svg className="w-12 h-12 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
        {article.categories && (
          <div className="absolute top-3 left-3">
            <span
              className="px-2 py-1 rounded-full text-xs font-bold text-white shadow-lg"
              style={{ background: color + "dd" }}
            >
              {article.categories.split(",")[0].trim()}
            </span>
          </div>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="text-sm font-bold text-white mb-2 line-clamp-2 group-hover:text-cyan-300 transition-colors leading-snug">
          {article.title}
        </h3>
        <p className="text-xs text-gray-400 line-clamp-2 flex-1 mb-3">
          {article.excerpt || article.content?.slice(0, 100) + "\u2026"}
        </p>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{timeAgo(article.published_at || article.created_at)}</span>
          {article.views ? (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              {article.views.toLocaleString()}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

// ── Trending Sidebar ──────────────────────────────────────────────────────────

function TrendingSidebar({ articles, prefix }: { articles: Article[]; prefix: string }) {
  if (!articles.length) return null
  return (
    <div className="rounded-xl border border-orange-500/30 bg-black/40 backdrop-blur-sm overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-orange-500/20 to-red-500/10 border-b border-orange-500/20 flex items-center gap-2">
        <span className="text-orange-400">🔥</span>
        <h3 className="text-sm font-black text-orange-300 uppercase tracking-wider">Trending Now</h3>
      </div>
      <div className="divide-y divide-cyan-500/10">
        {articles.map((article, i) => (
          <Link
            key={article.id}
            href={prefix + buildArticlePath(article.id, article.title)}
            className="group flex gap-3 p-3 hover:bg-white/5 transition-colors"
          >
            <span className="text-2xl font-black text-gray-700 group-hover:text-orange-400 transition-colors w-7 flex-shrink-0 leading-tight mt-0.5">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-200 group-hover:text-cyan-300 transition-colors line-clamp-2 leading-snug">
                {article.title}
              </p>
              <span className="text-xs text-gray-500 mt-1 block">
                {timeAgo(article.published_at || article.created_at)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Categories Sidebar ────────────────────────────────────────────────────────

function CategoriesSidebar({ categories, prefix }: { categories: Category[]; prefix: string }) {
  if (!categories.length) return null
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-black/40 backdrop-blur-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-cyan-500/20 flex items-center gap-2">
        <span className="text-cyan-400 text-base">◈</span>
        <h3 className="text-sm font-black text-cyan-300 uppercase tracking-wider">Browse Topics</h3>
      </div>
      <div className="p-4 flex flex-wrap gap-2">
        {categories.slice(0, 14).map((cat) => (
          <Link
            key={cat.id}
            href={prefix + "/?category=" + cat.slug}
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-700/50 bg-gray-800/50 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all duration-200"
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: cat.color || "#06B6D4" }}
            />
            <span className="text-xs font-medium text-gray-300 group-hover:text-cyan-300 transition-colors">
              {cat.name}
            </span>
            {cat.article_count !== undefined && cat.article_count > 0 && (
              <span className="text-xs text-gray-600 group-hover:text-cyan-500/70">
                ({cat.article_count})
              </span>
            )}
          </Link>
        ))}
        <Link
          href={prefix + "/categories"}
          className="px-3 py-1.5 rounded-full border border-cyan-500/30 text-xs text-cyan-400 hover:bg-cyan-500/10 transition-all"
        >
          View all →
        </Link>
      </div>
    </div>
  )
}

// ── Load More Button ──────────────────────────────────────────────────────────

function LoadMoreButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-center">
      <button
        onClick={onClick}
        disabled={loading}
        className="group px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 text-cyan-300 hover:from-cyan-500/20 hover:to-blue-500/20 hover:border-cyan-400/50 transition-all font-semibold text-sm disabled:opacity-50 flex items-center gap-2"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            Loading…
          </>
        ) : (
          <>
            Load More Articles
            <span className="group-hover:translate-y-0.5 transition-transform inline-block">↓</span>
          </>
        )}
      </button>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function HomeSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
        <div className="lg:col-span-2 min-h-[300px] lg:min-h-[420px] rounded-2xl bg-slate-900 border border-cyan-500/20" />
        <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-visible">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-72 lg:w-auto h-20 rounded-xl bg-slate-900/60 border border-cyan-500/10" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-cyan-500/20 bg-black/40 overflow-hidden">
                <div className="h-44 bg-slate-900" />
                <div className="p-4 space-y-3">
                  <div className="h-3 bg-gray-800 rounded w-1/3" />
                  <div className="h-4 bg-gray-800 rounded w-full" />
                  <div className="h-3 bg-gray-800 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-72 rounded-xl bg-slate-900/60 border border-orange-500/20" />
          <div className="h-48 rounded-xl bg-slate-900/60 border border-cyan-500/20" />
        </div>
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ search }: { search?: string }) {
  return (
    <div className="text-center py-20">
      <div className="w-24 h-24 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <svg className="w-12 h-12 text-cyan-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 21l-4.35-4.35m0 0A7.5 7.5 0 103 10.5a7.5 7.5 0 0013.65 6.15z"
          />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">No Articles Found</h2>
      <p className="text-gray-400 max-w-md mx-auto">
        {search
          ? "No results for \"" + search + "\". Try different keywords."
          : "No articles match your current filters."}
      </p>
    </div>
  )
}

// ── Home Content ──────────────────────────────────────────────────────────────

interface InitialData {
  initialArticles?: Article[]
  initialCategories?: Category[]
  initialTrending?: Article[]
  initialHasMore?: boolean
  initialTotal?: number
}

function HomeContent({
  language = "en",
  prefix = "",
  initialArticles = [],
  initialCategories = [],
  initialTrending = [],
  initialHasMore = false,
  initialTotal = 0,
}: { language?: string; prefix?: string } & InitialData) {
  const router = useRouter()

  const hasSSRData = initialArticles.length > 0
  // Skip the first client-side fetch when we have SSR data (category filter applied after mount)
  const skipFirstFetch = useRef(hasSSRData)

  const [articles, setArticles] = useState<Article[]>(initialArticles)
  const [trendingArticles, setTrendingArticles] = useState<Article[]>(initialTrending)
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [loading, setLoading] = useState(!hasSSRData)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [total, setTotal] = useState(initialTotal)

  // Read ?category from URL on client mount (avoids useSearchParams Suspense deferral)
  useEffect(() => {
    const cat = new URLSearchParams(window.location.search).get("category") || ""
    if (cat) setSelectedCategory(cat)
  }, [])
  const searchInputRef = useRef<HTMLInputElement>(null)
  const isSearchMode = debouncedSearch.trim().length > 0

  // Sync category from URL on popstate (browser back/forward)
  useEffect(() => {
    const handler = () => {
      const cat = new URLSearchParams(window.location.search).get("category") || ""
      setSelectedCategory((prev) => (prev === cat ? prev : cat))
    }
    window.addEventListener("popstate", handler)
    return () => window.removeEventListener("popstate", handler)
  }, [])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch trending once on mount — skip if SSR already provided it
  useEffect(() => {
    if (initialTrending.length > 0) return
    fetch("/api/articles/trending?limit=6&language=" + language)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.articles)) setTrendingArticles(d.articles) })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch main articles when filters change
  useEffect(() => {
    // First render with SSR data — skip client fetch
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false
      return
    }
    setLoading(true)
    setPage(1)
    const params = new URLSearchParams({ page: "1", limit: "20", language })
    if (selectedCategory && !isSearchMode) params.append("category", selectedCategory)
    if (debouncedSearch.trim()) params.append("search", debouncedSearch.trim())

    fetch("/api/articles?" + params.toString())
      .then((r) => r.json())
      .then((data) => {
        setArticles(Array.isArray(data.articles) ? data.articles : [])
        setCategories(Array.isArray(data.categories) ? data.categories : [])
        if (data.pagination) {
          setHasMore(data.pagination.hasMore)
          setTotal(data.pagination.total)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [selectedCategory, debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const nextPage = page + 1
    const params = new URLSearchParams({ page: String(nextPage), limit: "20", language })
    if (selectedCategory && !isSearchMode) params.append("category", selectedCategory)
    if (debouncedSearch.trim()) params.append("search", debouncedSearch.trim())

    fetch("/api/articles?" + params.toString())
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.articles)) setArticles((prev) => [...prev, ...data.articles])
        if (data.pagination) { setHasMore(data.pagination.hasMore); setPage(nextPage) }
        setLoadingMore(false)
      })
      .catch(() => setLoadingMore(false))
  }

  const handleCategoryChange = (slug: string) => {
    setSelectedCategory(slug)
    setSearch("")
    setDebouncedSearch("")
    router.push(slug ? prefix + "/?category=" + slug : prefix + "/")
  }

  // Layout slicing — featured card only shows articles that have an image
  const articlesWithImage = articles.filter((a) => a.featured_image)
  const featured = !isSearchMode ? (articlesWithImage[0] ?? null) : null
  const heroSecondary = featured ? articles.filter((a) => a.id !== featured.id).slice(0, 4) : []
  const usedIds = new Set<number | undefined>([featured?.id, ...heroSecondary.map((a) => a.id)])
  const gridArticles = articles.filter((a) => !usedIds.has(a.id) && !!a.featured_image)

  return (
    <>
      <TrendingTicker articles={trendingArticles} prefix={prefix} />

      {/* Category filter bar */}
      <div className="relative z-40 backdrop-blur-sm bg-black/30 border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="relative mb-3 lg:hidden">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search articles…"
              className="w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-cyan-500/30 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 transition-all text-sm"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setDebouncedSearch("") }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2 overflow-x-auto whitespace-nowrap flex-1 pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <button
                onClick={() => handleCategoryChange("")}
                className={"flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 " + (!selectedCategory ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white ring-2 ring-cyan-500/50" : "bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:text-white border border-gray-700/50")}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat.slug)}
                  className={"flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 " + (selectedCategory === cat.slug ? "text-white shadow-lg" : "bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-700/50")}
                  style={selectedCategory === cat.slug ? { background: "linear-gradient(135deg, " + (cat.color || "#06B6D4") + ", " + (cat.color || "#06B6D4") + ")", boxShadow: "0 0 20px " + (cat.color || "#06B6D4") + "40" } : {}}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            <div className="relative hidden lg:block flex-shrink-0 w-56">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search articles…"
                className="w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-cyan-500/30 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 transition-all text-sm"
              />
              {search && (
                <button
                  onClick={() => { setSearch(""); setDebouncedSearch("") }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="sr-only">Qbitz – AI-Powered News: Latest World, Technology &amp; Sports Headlines</h1>
        {loading ? (
          <HomeSkeleton />
        ) : articles.length === 0 ? (
          <EmptyState search={debouncedSearch} />
        ) : isSearchMode ? (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-bold text-white">
                Search results for <span className="text-cyan-400">"{debouncedSearch}"</span>
              </h2>
              <p className="text-sm text-gray-400 mt-1">{total} article{total !== 1 ? "s" : ""} found</p>
            </div>
            <div className="space-y-4 mb-8">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={prefix + buildArticlePath(article.id, article.title)}
                  className="group flex gap-4 rounded-xl border border-cyan-500/20 bg-black/40 backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-300 p-4"
                >
                  {article.featured_image && (
                    <img src={article.featured_image} alt={article.title} className="w-20 h-20 object-cover rounded-lg flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-2 mb-1">{article.title}</h3>
                    <p className="text-gray-400 text-sm line-clamp-2">{article.excerpt || article.content?.slice(0, 120) + "\u2026"}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      <span>{timeAgo(article.published_at || article.created_at)}</span>
                      {article.categories && (<><span>•</span><span className="text-cyan-400">{article.categories.split(",")[0].trim()}</span></>)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {hasMore && <LoadMoreButton loading={loadingMore} onClick={loadMore} />}
          </>
        ) : (
          <>
            {featured && <HeroSection featured={featured} secondary={heroSecondary} categories={categories} prefix={prefix} />}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="flex items-center gap-2 text-sm font-black text-cyan-400 uppercase tracking-widest">
                    <span className="w-1 h-4 bg-cyan-400 rounded-full" />
                    Latest News
                  </h2>
                  {total > 0 && <span className="text-xs text-gray-500">{total.toLocaleString()} articles</span>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {gridArticles.map((article) => (
                    <ArticleCard key={article.id} article={article} categories={categories} prefix={prefix} />
                  ))}
                </div>

                {loadingMore && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5 animate-pulse">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="rounded-xl border border-cyan-500/20 bg-black/40 overflow-hidden">
                        <div className="h-44 bg-slate-900" />
                        <div className="p-4 space-y-3">
                          <div className="h-3 bg-gray-800 rounded w-1/3" />
                          <div className="h-4 bg-gray-800 rounded w-full" />
                          <div className="h-3 bg-gray-800 rounded w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {hasMore && !loadingMore && (
                  <div className="mt-8 space-y-8">
                    <LoadMoreButton loading={loadingMore} onClick={loadMore} />
                  </div>
                )}
              </div>

              <div className="lg:col-span-1">
                <div className="sticky top-4 space-y-6">
                  <TrendingSidebar articles={trendingArticles} prefix={prefix} />

                  <CategoriesSidebar categories={categories} prefix={prefix} />
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  )
}

// ── Root Export ───────────────────────────────────────────────────────────────

export default function HomePageClient({
  language = "en",
  prefix = "",
  initialArticles = [],
  initialCategories = [],
  initialTrending = [],
  initialHasMore = false,
  initialTotal = 0,
}: { language?: string; prefix?: string } & InitialData) {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-black" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>
      <Navbar />
      <HomeContent
        language={language}
        prefix={prefix}
        initialArticles={initialArticles}
        initialCategories={initialCategories}
        initialTrending={initialTrending}
        initialHasMore={initialHasMore}
        initialTotal={initialTotal}
      />
      <Footer />
    </div>
  )
}
