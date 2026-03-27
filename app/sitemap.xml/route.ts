import { NextResponse } from 'next/server'

export const revalidate = 3600

// CENTRALIZED SLUG GENERATOR - MUST MATCH article page.tsx
function generateSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export async function GET() {
  try {
    const res = await fetch('http://localhost:3001/api/articles?limit=1000', {
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 })
    }

    const data = await res.json()
    const articles = Array.isArray(data.articles) ? data.articles : []

    function escapeXml(str: string): string {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
    }

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'

    const staticPages = [
      { url: '/', changefreq: 'daily', priority: 1.0 },
      { url: '/categories', changefreq: 'weekly', priority: 0.9 },
      { url: '/about', changefreq: 'monthly', priority: 0.7 },
      { url: '/privacy', changefreq: 'yearly', priority: 0.5 },
      { url: '/terms', changefreq: 'yearly', priority: 0.5 },
    ]

    staticPages.forEach((page) => {
      xml += '  <url>\n'
      xml += `    <loc>https://qbitznews.com${page.url}</loc>\n`
      xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`
      xml += `    <priority>${page.priority}</priority>\n`
      xml += '  </url>\n'
    })

    articles.forEach((article: any) => {
      const slug = generateSlug(article.title)  // USE CENTRALIZED FUNCTION
      const date = new Date(article.published_at || article.created_at)
        .toISOString()
        .split('T')[0]

      xml += '  <url>\n'
      xml += `    <loc>https://qbitznews.com/articles/${slug}</loc>\n`
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
    console.error('Sitemap error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
