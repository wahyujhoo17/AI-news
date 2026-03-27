export const SITE_URL = 'https://qbitznews.com'
export const SITEMAP_ARTICLE_CHUNK_SIZE = 5000

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function formatSitemapDate(value?: string | null): string {
  const parsedDate = new Date(value || '')
  if (Number.isNaN(parsedDate.getTime())) {
    return new Date().toISOString().split('T')[0]
  }
  return parsedDate.toISOString().split('T')[0]
}
