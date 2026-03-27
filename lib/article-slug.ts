export function normalizeArticleSlug(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export function extractArticleRouteParts(routeParam: string): {
  articleId: number | null
  slug: string
} {
  const normalized = normalizeArticleSlug(routeParam)

  if (!normalized) {
    return {
      articleId: null,
      slug: "",
    }
  }

  const compositeMatch = normalized.match(/^(\d+)-(.+)$/)
  if (compositeMatch) {
    return {
      articleId: parseInt(compositeMatch[1], 10),
      slug: normalizeArticleSlug(compositeMatch[2]),
    }
  }

  if (/^\d+$/.test(normalized)) {
    return {
      articleId: parseInt(normalized, 10),
      slug: "",
    }
  }

  return {
    articleId: null,
    slug: normalized,
  }
}

export function buildArticleRouteParam(articleId: number | string, title: string): string {
  const normalizedTitle = normalizeArticleSlug(title)
  const normalizedId = String(articleId).trim()

  return normalizedTitle ? `${normalizedId}-${normalizedTitle}` : normalizedId
}

export function buildArticlePath(articleId: number | string, title: string): string {
  return `/articles/${buildArticleRouteParam(articleId, title)}`
}
