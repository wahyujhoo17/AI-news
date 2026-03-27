import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { SITE_URL, formatSitemapDate, SITEMAP_ARTICLE_CHUNK_SIZE } from '@/lib/sitemap'

export const revalidate = 3600

type CountResult = {
  total: string
}

export async function GET() {
  try {
    const countResult = await pool.query<CountResult>(
      `SELECT COUNT(*) AS total
       FROM articles
       WHERE is_published = true`
    )
    const totalArticles = parseInt(countResult.rows[0]?.total || '0', 10)
    const totalArticleSitemaps = Math.max(1, Math.ceil(totalArticles / SITEMAP_ARTICLE_CHUNK_SIZE))

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    xml += '  <sitemap>\n'
    xml += `    <loc>${SITE_URL}/sitemap-pages.xml</loc>\n`
    xml += `    <lastmod>${formatSitemapDate()}</lastmod>\n`
    xml += '  </sitemap>\n'

    for (let page = 1; page <= totalArticleSitemaps; page++) {
      xml += '  <sitemap>\n'
      xml += `    <loc>${SITE_URL}/sitemap-articles/${page}</loc>\n`
      xml += `    <lastmod>${formatSitemapDate()}</lastmod>\n`
      xml += '  </sitemap>\n'
    }

    xml += '</sitemapindex>'

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Sitemap error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
