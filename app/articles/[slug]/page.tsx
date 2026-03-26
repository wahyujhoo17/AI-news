import { notFound } from "next/navigation"
import React from "react"
import Link from "next/link"
import Navbar from "@/app/components/Navbar"
import Footer from "@/app/components/Footer"

interface Article {
  id: number
  title: string
  content: string
  source_name: string
  source_url: string
  published_at: string | null
  created_at: string
  excerpt?: string
  categories?: string
  featured_image?: string
}

async function getArticleBySlug(slug: string): Promise<Article | null> {
  try {
    const normalizedSlug = slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")

    const res = await fetch(
      `http://localhost:3001/api/articles?search=${encodeURIComponent(normalizedSlug)}`,
      {
        cache: "no-store",
      }
    )

    if (!res.ok) return null

    const data = await res.json()
    const articles = Array.isArray(data.articles) ? data.articles : []

    return (
      articles.find((article: Article) => {
        const articleSlug = (article.title || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
        return articleSlug === normalizedSlug
      }) || null
    )
  } catch (error) {
    console.error("Failed to fetch article:", error)
    return null
  }
}

async function getRecommendedArticles(currentArticle: Article, limit: number = 3): Promise<Article[]> {
  try {
    const res = await fetch(`http://localhost:3001/api/articles?limit=50`, {
      cache: "no-store",
    })

    if (!res.ok) return []

    const data = await res.json()
    const allArticles = Array.isArray(data.articles) ? data.articles : []

    // Filter out current article
    const otherArticles = allArticles.filter((a: Article) => a.id !== currentArticle.id)

    // Score articles based on similarity
    const scored = otherArticles.map((article: Article) => {
      let score = 0

      // Same category (+50 points each matching category)
      if (currentArticle.categories && article.categories) {
        const currentCats = currentArticle.categories.split(", ").map((c) => c.toLowerCase())
        const articleCats = article.categories.split(", ").map((c) => c.toLowerCase())
        const commonCats = currentCats.filter((c) => articleCats.includes(c))
        score += commonCats.length * 50
      }

      // Keywords match in title (+30 points per keyword)
      const currentKeywords = currentArticle.title
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4)

      const articleTitle = article.title.toLowerCase()
      currentKeywords.forEach((keyword) => {
        if (articleTitle.includes(keyword)) {
          score += 30
        }
      })

      // Recency bonus (+20 points if published within last 7 days)
      const articleDate = new Date(article.created_at).getTime()
      const currentDate = new Date().getTime()
      const daysDiff = (currentDate - articleDate) / (1000 * 60 * 60 * 24)
      if (daysDiff <= 7) {
        score += 20
      }

      return { article, score }
    })

    // Sort by score and take top results
    return scored
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .slice(0, limit)
      .map((s: { article: Article; score: number }) => s.article)
  } catch (error) {
    console.error("Failed to fetch recommended articles:", error)
    return []
  }
}

function generateSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function getAdaptiveTitleClass(title: string, variant: "page" | "card" = "page"): string {
  const titleLength = title.trim().length

  if (variant === "page") {
    if (titleLength > 140) return "text-2xl md:text-3xl"
    if (titleLength > 90) return "text-3xl md:text-4xl"
    return "text-4xl md:text-5xl"
  }

  if (titleLength > 140) return "text-xs"
  if (titleLength > 100) return "text-sm"
  return "text-base"
}

function renderMarkdownContent(content: string) {
  if (!content) return null

  const lines = content.split("\n")
  const elements: React.ReactElement[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmedLine = line.trim()

    // Skip --- dividers
    if (trimmedLine === "---" || trimmedLine === "***" || trimmedLine === "___") {
      i++
      continue
    }

    if (!trimmedLine) {
      i++
      continue
    }

    // Check for mermaid flowchart
    if (trimmedLine.toLowerCase().startsWith("```mermaid")) {
      const flowchartLines: string[] = []
      i++ // Skip opening ```mermaid

      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        flowchartLines.push(lines[i])
        i++
      }
      i++ // Skip closing ```

      if (flowchartLines.length > 0) {
        const flowchartCode = flowchartLines.join("\n")
        elements.push(
          <div key={`flowchart-${elements.length}`} className="my-8 p-6 bg-gray-900/50 border border-cyan-500/20 rounded-lg overflow-x-auto">
            <div className="text-sm text-gray-400 mb-3">Flowchart</div>
            <pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap break-words">
              {flowchartCode}
            </pre>
            <div className="mt-3 text-xs text-gray-500">
              💡 Mermaid flowchart - Preview requires Mermaid renderer
            </div>
          </div>
        )
      }
      continue
    }

    // Check for markdown tables
    if (trimmedLine.includes("|")) {
      const tableLines: string[] = []
      let j = i

      // Collect table rows
      while (j < lines.length) {
        const currentLine = lines[j].trim()
        if (!currentLine.includes("|") || !currentLine.startsWith("|")) break
        tableLines.push(currentLine)
        j++
      }

      // Check if it's a valid table (needs header and separator)
      if (tableLines.length >= 2 && tableLines[1].includes("-")) {
        // Parse header
        const headerCells = tableLines[0]
          .split("|")
          .map((cell) => cell.trim())
          .filter((cell) => cell.length > 0)

        // Parse body rows
        const bodyRows = tableLines.slice(2).map((row) =>
          row
            .split("|")
            .map((cell) => cell.trim())
            .filter((cell) => cell.length > 0)
        )

        elements.push(
          <div key={`table-${elements.length}`} className="my-8 overflow-x-auto">
            <table className="w-full border-collapse border border-cyan-500/30">
              <thead>
                <tr className="bg-cyan-500/10">
                  {headerCells.map((cell, idx) => (
                    <th
                      key={idx}
                      className="border border-cyan-500/20 px-4 py-3 text-left font-bold text-cyan-300 text-sm"
                    >
                      {renderInlineMarkdown(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className={rowIdx % 2 === 0 ? "bg-gray-900/30" : "bg-gray-900/10"}>
                    {row.map((cell, cellIdx) => (
                      <td
                        key={cellIdx}
                        className="border border-cyan-500/20 px-4 py-3 text-gray-300 text-sm"
                      >
                        {renderInlineMarkdown(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )

        i = j
        continue
      }
    }

    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2].trim()
      const headingClass =
        level === 1
          ? "text-3xl"
          : level === 2
            ? "text-2xl"
            : level === 3
              ? "text-xl"
              : "text-lg"

      elements.push(
        <h2 key={`heading-${i}`} className={`${headingClass} font-bold text-cyan-300 my-6 mt-8`}>
          {text}
        </h2>
      )
      i++
      continue
    }

    if (trimmedLine.match(/^[-•*]\s+/) || trimmedLine.match(/^\d+\.\s+/)) {
      const listItems: string[] = []
      const isOrdered = trimmedLine.match(/^\d+\./)

      while (i < lines.length) {
        const currentLine = lines[i].trim()
        if (!currentLine) break

        if (isOrdered) {
          if (!currentLine.match(/^\d+\.\s+/)) break
          listItems.push(currentLine.replace(/^\d+\.\s+/, "").trim())
        } else {
          if (!currentLine.match(/^[-•*]\s+/)) break
          listItems.push(currentLine.replace(/^[-•*]\s+/, "").trim())
        }
        i++
      }

      elements.push(
        <ul
          key={`list-${elements.length}`}
          className={isOrdered ? "list-decimal list-inside my-4 space-y-2" : "list-disc list-inside my-4 space-y-2"}
        >
          {listItems.map((item, idx) => (
            <li key={idx} className="text-gray-300 ml-4">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      )
      continue
    }

    const paragraphLines: string[] = []
    while (i < lines.length) {
      const currentLine = lines[i].trim()
      if (!currentLine || currentLine.match(/^(#{1,6})\s/) || currentLine.match(/^[-•*\d+\.]\s/)) break
      paragraphLines.push(currentLine)
      i++
    }

    if (paragraphLines.length > 0) {
      const paragraphText = paragraphLines.join(" ")
      elements.push(
        <p key={`para-${elements.length}`} className="text-gray-300 mb-5 leading-relaxed text-base">
          {renderInlineMarkdown(paragraphText)}
        </p>
      )
    }
  }

  return elements
}

function renderInlineMarkdown(text: string): React.ReactElement | string {
  const parts: (string | React.ReactElement)[] = []
  let lastIndex = 0
  let elementKey = 0

  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|__(.+?)__|_(.+?)_/g
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }

    if (match[1]) {
      parts.push(
        <strong key={`bold-${elementKey}`} className="font-bold text-white">
          {match[1]}
        </strong>
      )
    } else if (match[2]) {
      parts.push(
        <em key={`italic-${elementKey}`} className="italic text-gray-200">
          {match[2]}
        </em>
      )
    } else if (match[3]) {
      parts.push(
        <strong key={`bold-${elementKey}`} className="font-bold text-white">
          {match[3]}
        </strong>
      )
    } else if (match[4]) {
      parts.push(
        <em key={`italic-${elementKey}`} className="italic text-gray-200">
          {match[4]}
        </em>
      )
    }

    lastIndex = regex.lastIndex
    elementKey++
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  if (parts.length === 0) {
    return text
  }

  if (parts.length === 1 && typeof parts[0] === "string") {
    return parts[0]
  }

  return <>{parts}</>
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await getArticleBySlug(slug)

  if (!article) {
    return {
      title: "Article Not Found",
    }
  }

  return {
    title: `${article.title} | Qbitz`,
    description: article.excerpt || article.content.slice(0, 160),
  }
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await getArticleBySlug(slug)

  if (!article) {
    notFound()
  }

  const recommendedArticles = await getRecommendedArticles(article, 3)

  const published = new Date(article.published_at || article.created_at)
  const formattedDate = published.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-black"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
      </div>

      <Navbar />

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <article>
          {/* Featured Image */}
          {article.featured_image && (
            <div className="relative h-80 w-full overflow-hidden rounded-2xl mb-10 border border-cyan-500/20 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-950">
              <img
                src={article.featured_image}
                alt={article.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            </div>
          )}

          {/* Header Info */}
          <div className="mb-8">
            {/* Title */}
            <h1 className={`${getAdaptiveTitleClass(article.title)} font-black text-white mb-4 leading-tight break-words`}>
              {article.title}
            </h1>

            {/* Meta Info */}
            <div className="flex items-center gap-4 text-sm text-gray-400 mb-6">
              <time className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 2a1 1 0 00-1 1v2H4a2 2 0 00-2 2v2h20V7a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v2H7V3a1 1 0 00-1-1zm0 5H4v9a2 2 0 002 2h12a2 2 0 002-2V7h-2v2a1 1 0 11-2 0V7H8v2a1 1 0 11-2 0V7z" />
                </svg>
                {formattedDate}
              </time>
            </div>

            {/* Excerpt */}
            {article.excerpt && (
              <p className="text-lg text-gray-300 font-medium italic border-l-4 border-cyan-500/50 pl-4 py-2">
                "{article.excerpt}"
              </p>
            )}
          </div>

          {/* Body Content */}
          <div className="prose prose-invert max-w-none mb-8">
            {renderMarkdownContent(article.content)}
          </div>

          {/* Read Also + Categories Section */}
          {(recommendedArticles.length > 0 || article.categories) && (
            <div className="mb-8 p-4 border-l-4 border-cyan-500/60 bg-cyan-500/5 rounded-r space-y-4">
              {recommendedArticles.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-cyan-300 mb-3 uppercase tracking-wider">Read also:</h3>
                  <div className="space-y-2">
                    {recommendedArticles.slice(0, 2).map((relatedArticle) => (
                      <Link
                        key={relatedArticle.id}
                        href={`/articles/${generateSlug(relatedArticle.title)}`}
                        className="block text-sm text-cyan-400 hover:text-cyan-300 transition-colors hover:underline break-words"
                      >
                        {relatedArticle.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {article.categories && (
                <div className="flex flex-wrap gap-2">
                  {article.categories.split(", ").map((cat, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-cyan-500/20 text-cyan-300 text-xs font-semibold rounded-full border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

        </article>

        {/* Recommended Reading Section - Grid Below */}
        {recommendedArticles.length > 0 && (
          <div className="mt-10 pt-12 border-t border-cyan-500/20">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                <svg className="w-8 h-8 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 7a3 3 0 11-6 0 3 3 0 016 0zM7 15a3 3 0 11-6 0 3 3 0 016 0zM16 15a3 3 0 11-6 0 3 3 0 016 0zM16 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Recommended Reading
              </h2>
              <div className="w-80 h-1 bg-gradient-to-r from-cyan-500 to-transparent rounded-full mb-8"></div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recommendedArticles.map((recArticle) => (
                <Link
                  key={recArticle.id}
                  href={`/articles/${generateSlug(recArticle.title)}`}
                  className="group relative overflow-hidden rounded-xl border border-cyan-500/20 bg-black/40 backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20 flex flex-col h-full"
                >
                  {/* Image */}
                  <div className="h-40 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-950 flex items-center justify-center overflow-hidden relative">
                    {recArticle.featured_image ? (
                      <img
                        src={recArticle.featured_image}
                        alt={recArticle.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500/10 to-blue-500/10">
                        <svg className="w-12 h-12 text-cyan-400/30" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>

                  {/* Content */}
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-gray-400 text-xs">
                        {new Date(recArticle.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    <h3
                      className={`${getAdaptiveTitleClass(recArticle.title, "card")} font-bold text-white mb-2 leading-snug group-hover:text-cyan-300 transition-colors flex-grow break-words`}
                    >
                      {recArticle.title}
                    </h3>

                    <p className="text-gray-400 text-xs line-clamp-2">
                      {recArticle.excerpt || recArticle.content.slice(0, 80) + "..."}
                    </p>
                  </div>

                  {/* Footer */}
                  {recArticle.categories && (
                    <div className="px-4 pb-4 pt-2 border-t border-cyan-500/10">
                      <span className="text-xs text-cyan-300 font-semibold">
                        {recArticle.categories.split(",")[0].trim()}
                      </span>
                    </div>
                  )}
                </Link>
              ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
