import { notFound } from "next/navigation"
import { getArticleBySlug } from "@/lib/db"

function formatParagraphs(content: string) {
  if (!content) return null

  return content
    .split(/\r?\n\r?\n/)
    .filter(Boolean)
    .map((paragraph) => (
      <p key={paragraph} className="mb-4 leading-relaxed text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
        {paragraph.trim()}
      </p>
    ))
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await getArticleBySlug(slug)

  if (!article) {
    notFound()
  }

  const published = new Date(article.published_at || article.created_at)
  const formattedDate = published.toLocaleDateString("id-ID", { month: "long", day: "numeric", year: "numeric" })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <article className="overflow-hidden rounded-3xl bg-white dark:bg-gray-800 shadow-xl">
          {article.featured_image && (
            <div className="relative h-72 overflow-hidden">
              <img
                src={article.featured_image}
                alt={article.title}
                className="h-full w-full object-cover filter brightness-95"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            </div>
          )}

          <div className="p-6 sm:p-8">
            <div className="mb-4 text-sm font-medium text-blue-600 dark:text-blue-400">
              {article.categories || article.category || "Berita"}
            </div>
            <h1 className="mb-4 text-3xl font-bold leading-tight text-gray-900 dark:text-white">{article.title}</h1>
            <div className="mb-6 flex items-center text-sm text-gray-500 dark:text-gray-400 gap-4">
              <span>{article.source_name || "AI News"}</span>
              <span>•</span>
              <span>{formattedDate}</span>
              {typeof article.views === "number" && (
                <>
                  <span>•</span>
                  <span>{article.views.toLocaleString()} views</span>
                </>
              )}
            </div>

            {article.excerpt && (
              <p className="mb-6 text-lg text-gray-600 dark:text-gray-300 italic">{article.excerpt}</p>
            )}

            <div className="prose prose-lg mx-auto text-gray-800 dark:prose-invert dark:text-gray-200">
              {formatParagraphs(article.content)}
            </div>

            <div className="mt-10 border-t border-gray-200 dark:border-gray-700 pt-4 text-sm text-gray-500 dark:text-gray-400">
              <p>Author: {article.author || "AI News Editor"}</p>
              <p>Source: {article.source_url ? <a className="text-blue-600 dark:text-blue-400 hover:underline" href={article.source_url}>{article.source_name || article.source_url}</a> : article.source_name || "AI News"}</p>
            </div>
          </div>
        </article>
      </main>
    </div>
  )
}
