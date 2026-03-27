import { NextRequest, NextResponse } from 'next/server'
import { buildArticlePath } from '@/lib/article-slug'
import { pool } from '@/lib/db'
import { SITE_URL, escapeXml, formatSitemapDate, SITEMAP_ARTICLE_CHUNK_SIZE } from '@/lib/sitemap'

export const revalidate = 3600

type SitemapArticle = {
  id: number
  title: string
  featured_image?: string | null
  published_at?: string | null
  created_at: string
}

type CountResult = {
  total: string
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ page: string }> }) {
  try {
    const { page } = await params
    const pageNumber = parseInt(page, 10)

    if (!Number.isFinite(pageNumber) || pageNumber < 1) {
      return NextResponse.json({ error: 'Invalid sitemap page' }, { status: 404 })
    }

    const countResult = await pool.query<CountResult>(
      `SELECT COUNT(*) AS total
       FROM articles
       WHERE is_published = true`
    )

    const totalArticles = parseInt(countResult.rows[0]?.total || '0', 10)
    const totalPages = Math.max(1, Math.ceil(totalArticles / SITEMAP_ARTICLE_CHUNK_SIZE))

    if (pageNumber > totalPages) {
      return NextResponse.json({ error: 'Sitemap page out of range' }, { status: 404 })
    }

    const offset = (pageNumber - 1) * SITEMAP_ARTICLE_CHUNK_SIZE

    const result = await pool.query<SitemapArticle>(
      `SELECT id, title, featured_image, published_at, created_at
       FROM articles
       WHERE is_published = true
       ORDER BY published_at DESC NULLS LAST, created_at DESC
       LIMIT $1 OFFSET $2`,
      [SITEMAP_ARTICLE_CHUNK_SIZE, offset]
    )

    const articles = result.rows

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'

    articles.forEach((article) => {
      const articlePath = buildArticlePath(article.id, article.title)
      const date = formatSitemapDate(article.published_at || article.created_at)

      xml += '  <url>\n'
      xml += `    <loc>${SITE_URL}${articlePath}</loc>\n`
      xml += `    <lastmod>${date}</lastmod>\n`
      xml += '    <changefreq>never</changefreq>\n'
      xml += '    <priority>0.8</priority>\n'

      if (article.featured_image) {
        xml += '    <image:image>\n'
        xml += `      <image:loc>${escapeXml(article.featured_image)}</image:loc>\n`
        xml += `      <image:title>${escapeXml(article.title)}</image:title>\n`
        xml += '    </image:image>\n'
      }

      xml += '  </url>\n'
    })

    xml += '</urlset>'

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Article sitemap error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
