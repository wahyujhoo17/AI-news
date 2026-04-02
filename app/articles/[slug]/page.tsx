import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import React from "react"
import Link from "next/link"
import Navbar from "@/app/components/Navbar"
import Footer from "@/app/components/Footer"
import GoogleAd from "@/app/components/GoogleAd"
import {
  buildArticlePath,
  buildArticleRouteParam,
  extractArticleRouteParts,
  normalizeArticleSlug,
} from "@/lib/article-slug"

interface Article {
  id: number
  title: string
  content: string
  source_name: string
  source_url: string | null
  published_at: string | null
  created_at: string
  excerpt?: string
  categories?: string
  featured_image?: string
  language?: string
}

async function getArticleBySlug(slug: string): Promise<Article | null> {
  try {
    const { articleId, slug: normalizedSlug } = extractArticleRouteParts(slug)
    const lookupParam = articleId !== null ? String(articleId) : normalizedSlug

    if (!lookupParam) {
      return null
    }

    const res = await fetch(`http://localhost:3001/api/articles/${encodeURIComponent(lookupParam)}`, {
      cache: "no-store",
    })

    if (!res.ok) return null

    const data = await res.json()
    return data.article || null
  } catch (error) {
    console.error("Failed to fetch article:", error)
    return null
  }
}

async function getRecommendedArticles(currentArticle: Article, limit: number = 3): Promise<Article[]> {
  try {
    const lang = currentArticle.language || 'en'
    const res = await fetch(`http://localhost:3001/api/articles?limit=50&language=${lang}`, {
      cache: "no-store",
    })

    if (!res.ok) return []

    const data = await res.json()
    const allArticles = Array.isArray(data.articles) ? data.articles : []
    const otherArticles = allArticles.filter((article: Article) => article.id !== currentArticle.id)

    const scored = otherArticles.map((article: Article) => {
      let score = 0

      if (currentArticle.categories && article.categories) {
        const currentCats = currentArticle.categories.split(", ").map((category) => category.toLowerCase())
        const articleCats = article.categories.split(", ").map((category) => category.toLowerCase())
        const commonCats = currentCats.filter((category) => articleCats.includes(category))
        score += commonCats.length * 50
      }

      const currentKeywords = currentArticle.title
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 4)

      const articleTitle = article.title.toLowerCase()
      currentKeywords.forEach((keyword) => {
        if (articleTitle.includes(keyword)) {
          score += 30
        }
      })

      const articleDate = new Date(article.created_at).getTime()
      const currentDate = new Date().getTime()
      const daysDiff = (currentDate - articleDate) / (1000 * 60 * 60 * 24)
      if (daysDiff <= 7) {
        score += 20
      }

      return { article, score }
    })

    return scored
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .slice(0, limit)
      .map((item: { article: Article; score: number }) => item.article)
  } catch (error) {
    console.error("Failed to fetch recommended articles:", error)
    return []
  }
}

const KNOWN_IMAGE_SOURCES: Record<string, { label: string; href: string }> = {
  "images.unsplash.com": { label: "Unsplash", href: "https://unsplash.com" },
  "unsplash.com": { label: "Unsplash", href: "https://unsplash.com" },
  "i.guim.co.uk": { label: "The Guardian", href: "https://www.theguardian.com" },
  "media.guim.co.uk": { label: "The Guardian", href: "https://www.theguardian.com" },
  "static01.nyt.com": { label: "The New York Times", href: "https://www.nytimes.com" },
  "images.wsj.net": { label: "The Wall Street Journal", href: "https://www.wsj.com" },
  "cdn.vox-cdn.com": { label: "The Verge", href: "https://www.theverge.com" },
  "techcrunch.com": { label: "TechCrunch", href: "https://techcrunch.com" },
  "images.cnbc.com": { label: "CNBC", href: "https://www.cnbc.com" },
  "media.cnn.com": { label: "CNN", href: "https://www.cnn.com" },
  "s.yimg.com": { label: "Yahoo", href: "https://www.yahoo.com" },
  "ichef.bbci.co.uk": { label: "BBC", href: "https://www.bbc.com" },
  "cdn.mos.cms.futurecdn.net": { label: "Future PLC", href: "https://www.futureplc.com" },
  "images.axios.com": { label: "Axios", href: "https://www.axios.com" },
  "static.reuters.com": { label: "Reuters", href: "https://www.reuters.com" },
  "dims.apnews.com": { label: "AP News", href: "https://apnews.com" },
  "assets.bwbx.io": { label: "Bloomberg", href: "https://www.bloomberg.com" },
  "images.fastcompany.net": { label: "Fast Company", href: "https://www.fastcompany.com" },
  "cdn.arstechnica.net": { label: "Ars Technica", href: "https://arstechnica.com" },
  "i.kinja-img.com": { label: "Gizmodo Media", href: "https://gizmodo.com" },
}

function getImageSource(url: string): { label: string; href: string } | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    if (KNOWN_IMAGE_SOURCES[hostname]) {
      return KNOWN_IMAGE_SOURCES[hostname]
    }
    // Partial match for subdomains
    for (const [key, value] of Object.entries(KNOWN_IMAGE_SOURCES)) {
      if (hostname.endsWith(key) || hostname.includes(key)) {
        return value
      }
    }
    const domain = hostname.replace(/^www\./, "")
    return { label: domain, href: `https://${domain}` }
  } catch {
    return null
  }
}

function getAdaptiveTitleClass(title: string, variant: "page" | "card" = "page"): string {
  const titleLength = title.trim().length

  if (variant === "page") {
    if (titleLength > 140) return "text-lg md:text-3xl"
    if (titleLength > 90) return "text-xl md:text-4xl"
    return "text-2xl md:text-5xl"
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

    if (trimmedLine === "---" || trimmedLine === "***" || trimmedLine === "___") {
      i++
      continue
    }

    if (!trimmedLine) {
      i++
      continue
    }

    if (trimmedLine.toLowerCase().startsWith("```mermaid")) {
      const flowchartLines: string[] = []
      i++

      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        flowchartLines.push(lines[i])
        i++
      }
      i++

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

    if (trimmedLine.includes("|")) {
      const tableLines: string[] = []
      let j = i

      while (j < lines.length) {
        const currentLine = lines[j].trim()
        if (!currentLine.includes("|") || !currentLine.startsWith("|")) break
        tableLines.push(currentLine)
        j++
      }

      if (tableLines.length >= 2 && tableLines[1].includes("-")) {
        const headerCells = tableLines[0]
          .split("|")
          .map((cell) => cell.trim())
          .filter((cell) => cell.length > 0)

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

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[>*_~#-]/g, " ")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function buildArticleDescription(article: Article): string {
  const baseText = article.excerpt?.trim() || stripMarkdown(article.content || "")
  const trimmed = baseText.slice(0, 180).trim()

  if (trimmed.length === 0) {
    return `${article.title} - latest coverage from Qbitz.`
  }

  return trimmed.length < baseText.length ? `${trimmed.slice(0, 157).trimEnd()}...` : trimmed
}

function getArticleTags(categories?: string): string[] {
  return (categories || "")
    .split(",")
    .map((category) => category.trim())
    .filter(Boolean)
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  const { articleId, slug: normalizedSlug } = extractArticleRouteParts(slug)
  const fallbackRouteParam = articleId !== null && normalizedSlug
    ? `${articleId}-${normalizedSlug}`
    : String(articleId ?? normalizedSlug)
  const canonicalPath = fallbackRouteParam ? `/articles/${fallbackRouteParam}` : "/articles"

  if (!article) {
    return {
      title: "Article Not Found",
      description: "The requested article could not be found on Qbitz.",
      alternates: {
        canonical: canonicalPath,
      },
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const resolvedCanonicalPath = buildArticlePath(article.id, article.title)
  const description = buildArticleDescription(article)
  const tags = getArticleTags(article.categories)
  const primaryCategory = tags[0]
  const publishedTime = article.published_at || article.created_at

  return {
    title: article.title,
    description,
    authors: article.source_name ? [{ name: article.source_name }] : undefined,
    category: primaryCategory,
    keywords: tags,
    alternates: {
      canonical: resolvedCanonicalPath,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: article.title,
      description,
      url: resolvedCanonicalPath,
      type: "article",
      siteName: "Qbitz",
      publishedTime,
      modifiedTime: article.created_at,
      authors: article.source_name ? [article.source_name] : undefined,
      section: primaryCategory,
      tags,
      images: article.featured_image
        ? [
            {
              url: article.featured_image,
              alt: article.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: article.featured_image ? "summary_large_image" : "summary",
      title: article.title,
      description,
      images: article.featured_image ? [article.featured_image] : undefined,
    },
  }
}

const siteUrl = 'https://qbitznews.com'

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await getArticleBySlug(slug)

  if (!article) {
    notFound()
  }

  const expectedRouteParam = buildArticleRouteParam(article.id, article.title)
  const requestedRouteParam = normalizeArticleSlug(slug)
  if (requestedRouteParam !== expectedRouteParam) {
    permanentRedirect(buildArticlePath(article.id, article.title))
  }

  const recommendedArticles = await getRecommendedArticles(article, 6)
  const readAlsoArticles = recommendedArticles.slice(0, 2)
  const readAlsoIds = new Set(readAlsoArticles.map((item) => item.id))
  const recommendedReadingArticles = recommendedArticles.filter(
    (item) => Boolean(item.featured_image) && !readAlsoIds.has(item.id)
  )
  const isId = article.language === 'id'
  const published = new Date(article.published_at || article.created_at)
  const formattedDate = published.toLocaleDateString(isId ? "id-ID" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const publishedIso = published.toISOString()
  const modifiedIso = new Date(article.created_at).toISOString()
  const canonicalUrl = `${siteUrl}${buildArticlePath(article.id, article.title)}`
  const description = buildArticleDescription(article)

  const newsArticleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description,
    datePublished: publishedIso,
    dateModified: modifiedIso,
    url: canonicalUrl,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "Qbitz",
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/img/qbitznew.png`,
        width: 512,
        height: 512,
      },
    },
    ...(article.source_name && {
      author: {
        "@type": "Organization",
        name: article.source_name,
        ...(article.source_url && { url: article.source_url }),
      },
    }),
    ...(article.featured_image && {
      image: {
        "@type": "ImageObject",
        url: article.featured_image,
        caption: article.title,
      },
    }),
    ...(article.categories && {
      keywords: article.categories,
      articleSection: article.categories.split(",")[0].trim(),
    }),
  }

  const homeUrl = isId ? `${siteUrl}/id` : siteUrl
  const homeLabel = isId ? "Beranda" : "Home"
  const firstCat = article.categories ? article.categories.split(",")[0].trim() : null
  const firstCatSlug = firstCat
    ? firstCat.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    : null
  const categoryUrl = firstCatSlug ? `${homeUrl}/?category=${firstCatSlug}` : null

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: homeLabel, item: homeUrl },
      ...(firstCat && categoryUrl
        ? [{ "@type": "ListItem", position: 2, name: firstCat, item: categoryUrl }]
        : []),
      { "@type": "ListItem", position: firstCat ? 3 : 2, name: article.title, item: canonicalUrl },
    ],
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-black"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
      </div>

      <Navbar />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(newsArticleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex gap-8 items-start">
        {/* ── Left: Article content ── */}
        <div className="flex-1 min-w-0">
        {/* Breadcrumb navigation */}
        <nav aria-label="breadcrumb" className="mb-8">
          <ol className="flex items-center flex-wrap gap-1.5 text-sm text-gray-500">
            <li>
              <Link href={isId ? "/id" : "/"} className="hover:text-cyan-400 transition-colors">
                {homeLabel}
              </Link>
            </li>
            {firstCat && firstCatSlug && (
              <>
                <li className="text-gray-700">›</li>
                <li>
                  <Link
                    href={(isId ? "/id" : "") + "/?category=" + firstCatSlug}
                    className="hover:text-cyan-400 transition-colors"
                  >
                    {firstCat}
                  </Link>
                </li>
              </>
            )}
            <li className="text-gray-700">›</li>
            <li className="text-gray-400 line-clamp-1">{article.title}</li>
          </ol>
        </nav>
        <article>
          {article.featured_image && (
            <figure className="mb-10">
              <div className="relative w-full overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-950">
                <img
                  src={article.featured_image}
                  alt={article.title}
                  className="w-full h-auto object-contain"
                  fetchPriority="high"
                  loading="eager"
                  decoding="async"
                />
              </div>
              {(() => {
                const src = getImageSource(article.featured_image)
                return src ? (
                  <figcaption className="mt-1.5 text-right text-xs text-gray-500">
                    Photo:{" "}
                    <a
                      href={src.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-cyan-400 transition-colors"
                    >
                      {src.label}
                    </a>
                  </figcaption>
                ) : null
              })()}
            </figure>
          )}

          <div className="mb-8">
            <h1 className={`${getAdaptiveTitleClass(article.title)} font-black text-white mb-4 leading-tight break-words`}>
              {article.title}
            </h1>

            <div className="flex items-center flex-wrap gap-4 text-sm text-gray-400 mb-6">
              <time dateTime={publishedIso} className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 2a1 1 0 00-1 1v2H4a2 2 0 00-2 2v2h20V7a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v2H7V3a1 1 0 00-1-1zm0 5H4v9a2 2 0 002 2h12a2 2 0 002-2V7h-2v2a1 1 0 11-2 0V7H8v2a1 1 0 11-2 0V7z" />
                </svg>
                {formattedDate}
              </time>
              {article.source_name && (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                  </svg>
                  Source:{" "}
                  {article.source_url ? (
                    <a
                      href={article.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-cyan-400 transition-colors underline underline-offset-2"
                    >
                      {article.source_name}
                    </a>
                  ) : (
                    <span>{article.source_name}</span>
                  )}
                </span>
              )}
            </div>

            {article.excerpt && (
              <p className="text-lg text-gray-300 font-medium italic border-l-4 border-cyan-500/50 pl-4 py-2">
                "{article.excerpt}"
              </p>
            )}
          </div>

          <div className="prose prose-invert max-w-none mb-8">
            {renderMarkdownContent(article.content)}
          </div>

          {/* In-content banner ad */}
          <GoogleAd slot="7318960512" format="horizontal" className="my-6" />

          {(readAlsoArticles.length > 0 || article.categories) && (
            <div className="mb-8 p-4 border-l-4 border-cyan-500/60 bg-cyan-500/5 rounded-r space-y-4">
              {readAlsoArticles.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-cyan-300 mb-3 uppercase tracking-wider">{isId ? 'Baca juga:' : 'Read also:'}</h3>
                  <div className="space-y-2">
                    {readAlsoArticles.map((relatedArticle) => (
                      <Link
                        key={relatedArticle.id}
                        href={buildArticlePath(relatedArticle.id, relatedArticle.title)}
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
                  {article.categories.split(", ").map((cat, i) => {
                    const catSlug = cat.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
                    return (
                      <Link
                        key={i}
                        href={(isId ? "/id" : "") + "/?category=" + catSlug}
                        className="px-3 py-1 bg-cyan-500/20 text-cyan-300 text-xs font-semibold rounded-full border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors"
                      >
                        {cat}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </article>

        {/* Back to homepage link */}
        <div className="mt-8 pt-6 border-t border-cyan-500/10">
          <Link
            href={isId ? "/id" : "/"}
            className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {isId ? "Kembali ke Beranda" : "Back to Home"}
          </Link>
        </div>

        {/* Bottom banner before recommended */}
        <GoogleAd slot="4127083649" format="horizontal" className="my-8" />

        {recommendedReadingArticles.length > 0 && (
          <div className="mt-10 pt-12 border-t border-cyan-500/20">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                <svg className="w-8 h-8 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 7a3 3 0 11-6 0 3 3 0 016 0zM7 15a3 3 0 11-6 0 3 3 0 016 0zM16 15a3 3 0 11-6 0 3 3 0 016 0zM16 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {isId ? 'Artikel Terkait' : 'Recommended Reading'}
              </h2>
              <div className="w-80 h-1 bg-gradient-to-r from-cyan-500 to-transparent rounded-full mb-8"></div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {recommendedReadingArticles.map((recArticle) => (
                  <Link
                    key={recArticle.id}
                    href={buildArticlePath(recArticle.id, recArticle.title)}
                    className="group relative overflow-hidden rounded-xl border border-cyan-500/20 bg-black/40 backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20 flex flex-col h-full"
                  >
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

                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-gray-400 text-xs">
                          {new Date(recArticle.created_at).toLocaleDateString(isId ? "id-ID" : "en-US", {
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
        </div>{/* end left column */}

        {/* ── Right: Sticky sidebar ads ── */}
        <aside className="hidden lg:block w-[300px] flex-shrink-0">
          <div className="sticky top-24 space-y-6">
            <GoogleAd slot="6085234178" format="rectangle" style={{ display: "block", width: "300px", height: "250px" }} />
            <GoogleAd slot="1834567290" format="vertical" style={{ display: "block", width: "300px", height: "600px" }} />
          </div>
        </aside>

        </div>{/* end 2-col flex */}
      </main>

      <Footer />
    </div>
  )
}
