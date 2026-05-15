import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { SITE_URL, escapeXml } from '@/lib/sitemap'
import { buildArticlePath, getDisplayTitle } from '@/lib/article-slug'

// Google News sitemaps: only articles published in the last 48 hours
// https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
export const revalidate = 300 // re-generate every 5 minutes

type NewsArticle = {
  id: number
  title: string
  published_at: string | null
  created_at: string
  language: string
}

export async function GET() {
  try {
    const result = await pool.query<NewsArticle>(
      `SELECT id, title, published_at, created_at, language
       FROM articles
       WHERE is_published = true
         AND COALESCE(published_at, created_at) >= NOW() - INTERVAL '48 hours'
       ORDER BY COALESCE(published_at, created_at) DESC
       LIMIT 1000`
    )

    const articles = result.rows

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset\n'
    xml += '  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
    xml += '  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"\n'
    xml += '  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'

    articles.forEach((article) => {
      const displayTitle = getDisplayTitle(article.title)
      const articlePath = buildArticlePath(article.id, displayTitle)
      const pubDate = new Date(article.published_at || article.created_at).toISOString()

      xml += '  <url>\n'
      xml += `    <loc>${SITE_URL}${escapeXml(articlePath)}</loc>\n`
      xml += '    <news:news>\n'
      xml += '      <news:publication>\n'
      xml += '        <news:name>Qbitz</news:name>\n'
      xml += `        <news:language>${article.language || 'en'}</news:language>\n`
      xml += '      </news:publication>\n'
      xml += `      <news:publication_date>${pubDate}</news:publication_date>\n`
      xml += `      <news:title>${escapeXml(displayTitle)}</news:title>\n`
      xml += '    </news:news>\n'
      xml += '  </url>\n'
    })

    xml += '</urlset>'

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('News sitemap error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
