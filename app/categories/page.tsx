"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Navbar from "@/app/components/Navbar"
import Footer from "@/app/components/Footer"

interface Article {
  id: number
  title: string
  content: string
  source_name: string
  featured_image?: string
  created_at: string
  excerpt?: string
  categories?: string
}

interface Category {
  id: number
  name: string
  slug: string
  color?: string
  count?: number
}

function generateSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [categorySearch, setCategorySearch] = useState("")
  const [showAllCategories, setShowAllCategories] = useState(false)

  const ARTICLES_PER_PAGE = 12
  const DEFAULT_VISIBLE_CATEGORIES = 15

  useEffect(() => {
    fetch("/api/articles?limit=100")
      .then((res) => res.json())
      .then((data) => {
        const allCategories = Array.isArray(data.categories) ? data.categories : []
        const allArticles = Array.isArray(data.articles) ? data.articles : []

        // Count articles per category
        const categoryCount: { [key: string]: number } = {}
        allArticles.forEach((article: Article) => {
          if (article.categories) {
            article.categories.split(", ").forEach((cat) => {
              const trimmed = cat.trim()
              categoryCount[trimmed] = (categoryCount[trimmed] || 0) + 1
            })
          }
        })

        // Sort categories by count
        const sorted: Category[] = allCategories
          .map((cat: Category) => ({
            ...cat,
            count: categoryCount[cat.name] || 0,
          }))
          .sort((a: Category, b: Category) => (b.count || 0) - (a.count || 0))

        setCategories(sorted)
        setArticles(allArticles)
        if (sorted.length > 0) {
          setSelectedCategory(sorted[0])
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error("Failed to fetch:", err)
        setLoading(false)
      })
  }, [])

  const articlesInCategory = selectedCategory
    ? articles.filter((a) =>
        a.categories?.toLowerCase().includes(selectedCategory.name.toLowerCase())
      )
    : []

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((category) =>
      category.name.toLowerCase().includes(q)
    )
  }, [categories, categorySearch])

  const visibleCategories = showAllCategories
    ? filteredCategories
    : filteredCategories.slice(0, DEFAULT_VISIBLE_CATEGORIES)

  // Pagination
  const totalPages = Math.ceil(articlesInCategory.length / ARTICLES_PER_PAGE)
  const paginatedArticles = articlesInCategory.slice(
    (currentPage - 1) * ARTICLES_PER_PAGE,
    currentPage * ARTICLES_PER_PAGE
  )

  const paginatedArticlesWithImage = paginatedArticles.filter((article) => article.featured_image)
  const paginatedArticlesWithoutImage = paginatedArticles.filter((article) => !article.featured_image)

  const handleCategoryChange = (category: Category) => {
    setSelectedCategory(category)
    setCurrentPage(1)
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-black"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
      </div>

      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
            Browse by <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">Category</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl">
            Explore articles organized by topic. Select a category to view all related stories.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin">
              <svg className="w-12 h-12 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Categories Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-20 space-y-3">
                <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4">Categories</h2>

                <div className="mb-4">
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => {
                      setCategorySearch(e.target.value)
                      setShowAllCategories(false)
                    }}
                    placeholder="Search category..."
                    className="w-full px-3 py-2 rounded-lg bg-gray-900/70 border border-gray-700/50 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/60"
                  />
                </div>

                {visibleCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryChange(category)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all text-sm font-semibold ${
                      selectedCategory?.id === category.id
                        ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/50"
                        : "bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-700/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{category.name}</span>
                      <span className="text-xs bg-black/50 px-2 py-1 rounded">
                        {category.count || 0}
                      </span>
                    </div>
                  </button>
                ))}

                {filteredCategories.length === 0 && (
                  <div className="text-sm text-gray-500 px-2 py-2">
                    No category found
                  </div>
                )}

                {filteredCategories.length > DEFAULT_VISIBLE_CATEGORIES && (
                  <button
                    onClick={() => setShowAllCategories((prev) => !prev)}
                    className="w-full mt-2 px-4 py-2 rounded-lg border border-cyan-500/30 text-cyan-300 text-sm font-semibold hover:bg-cyan-500/10 transition-all"
                  >
                    {showAllCategories ? "Show Less" : `Show All (${filteredCategories.length})`}
                  </button>
                )}
              </div>
            </div>

            {/* Articles */}
            <div className="lg:col-span-3">
              {selectedCategory && (
                <>
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white mb-2">{selectedCategory.name}</h2>
                    <p className="text-gray-400">
                      {articlesInCategory.length} {articlesInCategory.length === 1 ? "article" : "articles"} found
                    </p>
                  </div>

                  {paginatedArticles.length > 0 ? (
                    <>
                      {paginatedArticlesWithImage.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                          {paginatedArticlesWithImage.map((article) => (
                            <Link
                              key={article.id}
                              href={`/articles/${generateSlug(article.title)}`}
                              className="group relative overflow-hidden rounded-xl border border-cyan-500/20 bg-black/40 backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20 flex flex-col"
                            >
                              <div className="h-40 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-950 overflow-hidden relative">
                                <img
                                  src={article.featured_image}
                                  alt={article.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                              </div>

                              <div className="p-5 flex-1 flex flex-col">
                                <div className="text-xs text-gray-400 mb-2">
                                  {new Date(article.created_at).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </div>
                                <h3 className="text-base font-bold text-white mb-2 line-clamp-2 group-hover:text-cyan-300 transition-colors">
                                  {article.title}
                                </h3>
                                <p className="text-gray-400 text-sm line-clamp-3 flex-1">
                                  {article.excerpt || article.content.slice(0, 100) + "..."}
                                </p>
                                <div className="mt-4 pt-3 border-t border-cyan-500/10">
                                  <span className="text-xs text-cyan-300 font-semibold">Read Article →</span>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}

                      {paginatedArticlesWithoutImage.length > 0 && (
                        <div className="mb-12">
                          <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4">More Stories</h3>
                          <div className="space-y-5">
                            {paginatedArticlesWithoutImage.map((article) => (
                              <Link
                                key={article.id}
                                href={`/articles/${generateSlug(article.title)}`}
                                className="group block border-b border-cyan-500/10 pb-4 hover:text-cyan-300 transition-colors last:border-b-0"
                              >
                                <div className="text-xs text-gray-400 mb-1">
                                  {new Date(article.created_at).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </div>
                                <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 line-clamp-2 leading-snug">
                                  {article.title}
                                </h3>
                                <p className="text-gray-400 text-sm mt-2 line-clamp-2">
                                  {article.excerpt || article.content.slice(0, 100) + "..."}
                                </p>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-2 mt-10">
                          <button
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
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
                              onClick={() => setCurrentPage(page)}
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
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 rounded-lg border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            Next →
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 012 12V7a2 2 0 012-2z" />
                      </svg>
                      <p className="text-gray-400">No articles in this category yet</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
