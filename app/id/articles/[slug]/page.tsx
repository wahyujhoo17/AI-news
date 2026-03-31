import { redirect } from "next/navigation"

// Indonesian article URLs (/id/articles/[slug]) redirect to canonical English URLs.
// The article content IS in Indonesian (written by worker-id.js);
// we keep a single canonical URL to avoid duplicate content for SEO.
export default async function IdArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/articles/${slug}`)
}
