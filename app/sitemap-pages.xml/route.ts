import { NextResponse } from 'next/server'
import { SITE_URL, formatSitemapDate } from '@/lib/sitemap'

export const revalidate = 3600

export async function GET() {
  const staticPages = [
    { url: '/', changefreq: 'daily', priority: 1.0 },
    { url: '/categories', changefreq: 'weekly', priority: 0.9 },
    { url: '/about', changefreq: 'monthly', priority: 0.7 },
    { url: '/contact', changefreq: 'monthly', priority: 0.6 },
    { url: '/disclaimer', changefreq: 'yearly', priority: 0.5 },
    { url: '/privacy', changefreq: 'yearly', priority: 0.5 },
    { url: '/terms', changefreq: 'yearly', priority: 0.5 },
    // Indonesian section
    { url: '/id', changefreq: 'daily', priority: 0.9 },
    { url: '/id/categories', changefreq: 'weekly', priority: 0.8 },
  ]

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

  staticPages.forEach((page) => {
    xml += '  <url>\n'
    xml += `    <loc>${SITE_URL}${page.url}</loc>\n`
    xml += `    <lastmod>${formatSitemapDate()}</lastmod>\n`
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`
    xml += `    <priority>${page.priority}</priority>\n`
    xml += '  </url>\n'
  })

  xml += '</urlset>'

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
