"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
}

interface PaginationData {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

interface ApiResponse {
  articles: Article[]
  categories: Category[]
  pagination?: PaginationData
}

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get("category") || ""
  const pageParam = parseInt(searchParams.get("page") || "1")

  const [articles, setArticles] = useState<Article[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState(categoryParam)
  const [currentPage, setCurrentPage] = useState(pageParam)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const isSearchMode = debouncedSearch.trim().length > 0
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const nextCategory = searchParams.get("category") || ""
    const rawPage = parseInt(searchParams.get("page") || "1")
    const nextPage = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1

    setSelectedCategory((prev) => (prev === nextCategory ? prev : nextCategory))
    setCurrentPage((prev) => (prev === nextPage ? prev : nextPage))
  }, [searchParams])

  // Debounce search input: wait 350ms before firing API request
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setLoading(true)
    const queryParams = new URLSearchParams({
      page: currentPage.toString(),
      limit: "12",
    })
    if (selectedCategory && !isSearchMode) {
      queryParams.append("category", selectedCategory)
    }
    if (debouncedSearch.trim()) {
      queryParams.append("search", debouncedSearch.trim())
    }

    fetch(`/api/articles?${queryParams}`)
      .then((res) => res.json())
      .then((data: ApiResponse) => {
        setArticles(Array.isArray(data.articles) ? data.articles : [])

        const allCategories = Array.isArray(data.categories) ? data.categories : []

        const categoryCount: { [key: string]: number } = {}
        ;(Array.isArray(data.articles) ? data.articles : []).forEach((article: Article) => {
          if (article.categories) {
            article.categories.split(", ").forEach((cat) => {
              const trimmed = cat.trim()
              categoryCount[trimmed] = (categoryCount[trimmed] || 0) + 1
            })
          }
        })

        const sortedCategories = allCategories
          .map((cat: Category) => ({
            ...cat,
            count: categoryCount[cat.name] || 0,
          }))
          .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
          .slice(0, 8)

        setCategories(sortedCategories)

        if (data.pagination) {
          if (data.pagination.page !== currentPage) {
            setCurrentPage(data.pagination.page)
          }
          setTotalPages(data.pagination.totalPages)
          setTotal(data.pagination.total)
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error("Failed to fetch:", err)
        setLoading(false)
      })
  }, [currentPage, selectedCategory, debouncedSearch])

  const articlesWithImage = articles.filter((a) => a.featured_image)
  const articlesWithoutImage = articles.filter((a) => !a.featured_image)
  const featured = isSearchMode ? [] : articlesWithImage.slice(0, 1)

  const featuredIds = new Set(featured.map((article) => article.id))
  const remainingWithImage = articlesWithImage.filter((article) => !featuredIds.has(article.id))
  const remainingWithoutImage = articlesWithoutImage.filter((article) => !featuredIds.has(article.id))

  const mainFromImage = remainingWithImage.slice(0, 6)
  const mainIds = new Set(mainFromImage.map((article) => article.id))
  const mainFallback = remainingWithoutImage
    .filter((article) => !mainIds.has(article.id))
    .slice(0, Math.max(0, 6 - mainFromImage.length))
  const mainArticles = [...mainFromImage, ...mainFallback]

  const usedInCards = new Set(mainArticles.map((article) => article.id))
  const sidebarPoolNoImage = remainingWithoutImage.filter((article) => !usedInCards.has(article.id))
  const sidebarPoolWithImage = remainingWithImage.filter((article) => !usedInCards.has(article.id))
  const sidebarArticles = [...sidebarPoolNoImage, ...sidebarPoolWithImage].slice(0, 4)

  const handleCategoryChange = (slug: string) => {
    setSelectedCategory(slug)
    setCurrentPage(1)
    setSearch("")
    setDebouncedSearch("")
    router.push(slug ? `/?category=${slug}` : "/")
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: "smooth" })
    if (!isSearchMode) {
      router.push(`/?page=${page}${selectedCategory ? `&category=${selectedCategory}` : ""}`)
    }
  }

  return (
    <>
      <div className="relative z-40 backdrop-blur-sm bg-black/30 border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          {/* Desktop: categories left, search right */}
          <div className="flex items-center gap-4">
          <div className="flex gap-2 overflow-x-auto whitespace-nowrap flex-1">
            <button
              onClick={() => handleCategoryChange("")}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                !selectedCategory
                  ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/50"
                  : "bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:text-white border border-gray-700/50"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.slug)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                  selectedCategory === cat.slug
                    ? "text-white shadow-lg"
                    : "bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-700/50"
                }`}
                style={
                  selectedCategory === cat.slug
                    ? {
                        background: `linear-gradient(135deg, ${cat.color || "#06B6D4"}, ${cat.color || "#06B6D4"})`,
                        boxShadow: `0 0 20px ${cat.color || "#06B6D4"}40`,
                      }
                    : {}
                }
              >
                {cat.name}
              </button>
            ))}
          </div>
            {/* Search — right side, desktop only */}
            <div className="relative hidden lg:block flex-shrink-0 w-56">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search articles..."
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

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {loading ? (
          <ArticleSkeleton />
        ) : articles.length === 0 ? (
          <EmptyState search={debouncedSearch} />
        ) : isSearchMode ? (
          /* ── SEARCH RESULTS MODE ── */
          <>
            <div className="mb-6">
              <h2 className="text-lg font-bold text-white">
                Search results for <span className="text-cyan-400">"{debouncedSearch}"</span>
              </h2>
              <p className="text-sm text-gray-400 mt-1">{total} article{total !== 1 ? "s" : ""} found</p>
            </div>
            <div className="space-y-4 mb-10">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={buildArticlePath(article.id, article.title)}
                  className="group flex gap-4 rounded-xl border border-cyan-500/20 bg-black/40 backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-300 p-4"
                >
                  {article.featured_image && (
                    <img
                      src={article.featured_image}
                      alt={article.title}
                      className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-2 mb-1">
                      {article.title}
                    </h3>
                    <p className="text-gray-400 text-sm line-clamp-2">
                      {article.excerpt || article.content.slice(0, 120) + "..."}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      <span>{new Date(article.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      {article.categories && (
                        <>
                          <span>•</span>
                          <span className="text-cyan-400">{article.categories.split(",")[0].trim()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2">
                <button
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  ← Previous
                </button>
                <span className="text-sm text-gray-400">Page {currentPage} of {totalPages}</span>
                <button
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-lg border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {featured.length > 0 && (
              <div className="mb-12">
                <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4">Featured</h2>
                <Link
                  href={buildArticlePath(featured[0].id, featured[0].title)}
                  className="group relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-black/40 backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-300 flex flex-col md:flex-row h-96"
                >
                  <div className="h-full md:w-2/3 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-950 overflow-hidden relative">
                    {featured[0].featured_image && (
                      <img
                        src={featured[0].featured_image}
                        alt={featured[0].title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  </div>

                  <div className="p-8 md:w-1/3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                        <span className="text-xs font-semibold text-cyan-400 tracking-widest">FEATURED</span>
                      </div>
                      <h3 className="text-2xl font-black text-white mb-3 group-hover:text-cyan-300 transition-colors line-clamp-3">
                        {featured[0].title}
                      </h3>
                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                        {featured[0].excerpt || featured[0].content.slice(0, 100) + "..."}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{new Date(featured[0].created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      {featured[0].categories && (
                        <>
                          <span className="text-gray-600">•</span>
                          <span className="text-cyan-300 font-semibold">{featured[0].categories.split(",")[0].trim()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
              <div className="lg:col-span-2">
                <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4">Latest News</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {mainArticles.map((article) => (
                    <Link
                      key={article.id}
                      href={buildArticlePath(article.id, article.title)}
                      className="group relative overflow-hidden rounded-xl border border-cyan-500/20 bg-black/40 backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20 flex flex-col"
                    >
                      <div className="h-40 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-950 overflow-hidden relative">
                        {article.featured_image && (
                          <img
                            src={article.featured_image}
                            alt={article.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </div>

                      <div className="p-4 flex-1 flex flex-col">
                        <div className="text-xs text-gray-400 mb-2">
                          {new Date(article.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                        <h3 className="text-base font-bold text-white mb-2 line-clamp-2 group-hover:text-cyan-300 transition-colors">
                          {article.title}
                        </h3>
                        <p className="text-gray-400 text-sm line-clamp-2 flex-1">
                          {article.excerpt || article.content.slice(0, 80) + "..."}
                        </p>
                        {article.categories && (
                          <div className="mt-3 text-xs text-cyan-300 font-semibold">
                            {article.categories.split(",")[0].trim()}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {sidebarArticles.length > 0 && (
                <div className="lg:col-span-1">
                  <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4">More Stories</h2>
                  <div className="space-y-5">
                    {sidebarArticles.map((article) => (
                      <Link
                        key={article.id}
                        href={buildArticlePath(article.id, article.title)}
                        className="group block border-b border-cyan-500/10 pb-4 hover:text-cyan-300 transition-colors last:border-b-0"
                      >
                        <div className="text-xs text-gray-400 mb-1">
                          {new Date(article.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                        <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 line-clamp-2 leading-snug">
                          {article.title}
                        </h3>
                        {article.categories && (
                          <div className="text-xs text-cyan-300/70 mt-2">
                            {article.categories.split(",")[0].trim()}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div>
                <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-6">All Articles</h2>
                <div className="text-sm text-gray-400 mb-6">
                  Showing page {currentPage} of {totalPages} ({total} articles)
                </div>

                <div className="flex justify-center items-center gap-2 mb-12">
                  <button
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-lg border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    ← Previous
                  </button>

                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let page
                    if (totalPages <= 5) {
                      page = i + 1
                    } else if (currentPage <= 3) {
                      page = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i
                    } else {
                      page = currentPage - 2 + i
                    }
                    return page
                  }).map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-2 rounded-lg transition-all ${
                        currentPage === page
                          ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
                          : "border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-lg border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}

function EmptyState({ search }: { search?: string }) {
  return (
    <div className="text-center py-20">
      <div className="w-24 h-24 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <svg className="w-12 h-12 text-cyan-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 21l-4.35-4.35m0 0A7.5 7.5 0 103 10.5a7.5 7.5 0 0113.65 6.15z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">No Articles Found</h2>
      <p className="text-gray-400 max-w-md mx-auto">
        {search
          ? `No results for "${search}". Try different keywords.`
          : "No articles match your current filters."}
      </p>
    </div>
  )
}

export default function HomePageClient() {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-black"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
      </div>

      <Navbar />

      <Suspense fallback={<div className="h-screen"></div>}>
        <HomeContent />
      </Suspense>

      <Footer />
    </div>
  )
}

function ArticleSkeleton() {
  return (
    <>
      <div className="mb-12">
        <div className="h-4 w-24 bg-gray-800 rounded mb-4 animate-pulse"></div>
        <div className="rounded-2xl border border-cyan-500/30 bg-black/40 overflow-hidden flex flex-col md:flex-row h-96 animate-pulse">
          <div className="h-full md:w-2/3 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-950"></div>
          <div className="p-8 md:w-1/3 space-y-4">
            <div className="h-6 bg-gray-800 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-800 rounded w-full"></div>
              <div className="h-4 bg-gray-800 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2">
          <div className="h-4 w-32 bg-gray-800 rounded mb-4 animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-cyan-500/20 bg-black/40 overflow-hidden animate-pulse">
                <div className="h-40 bg-gradient-to-br from-slate-900 to-slate-950"></div>
                <div className="p-4 space-y-3">
                  <div className="h-3 bg-gray-800 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-800 rounded w-full"></div>
                  <div className="h-3 bg-gray-800 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="h-4 w-32 bg-gray-800 rounded mb-4 animate-pulse"></div>
          <div className="space-y-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border-b border-cyan-500/10 pb-4 last:border-b-0">
                <div className="h-3 bg-gray-800 rounded w-1/4 mb-2"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-800 rounded w-full"></div>
                  <div className="h-4 bg-gray-800 rounded w-5/6"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
