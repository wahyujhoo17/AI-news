import { NextResponse } from 'next/server'

export async function GET() {
  const robots = `# Robots.txt for Qbitz AI News Platform
# Submitted: 2026-03-27

# Allow all pages to be crawled
User-agent: *
Allow: /
Allow: /articles/
Allow: /categories
Allow: /about
Allow: /privacy
Allow: /terms
Disallow: /api/
Disallow: /_next/
Disallow: /.next/

# Sitemaps
Sitemap: https://qbitznews.com/sitemap.xml

# Crawl delay and request rate
Crawl-delay: 1
Request-rate: 30/60

# Google specific
User-agent: Googlebot
Allow: /
Crawl-delay: 0
Request-rate: 100/60

# Block problematic bots
User-agent: Amazonbot
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: GPTBot
Disallow: /

User-agent: meta-externalagent
Disallow: /

User-agent: ChatGPT-User
Disallow: /
`

  return new NextResponse(robots, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}

export const revalidate = 86400 // Revalidate every 24 hours
