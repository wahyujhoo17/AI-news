import { NextRequest, NextResponse } from "next/server"

// Redirect Indonesian visitors to /id if they haven't explicitly chosen a language.
// Detection order:
//   1. Cloudflare CF-IPCountry header (most reliable, if behind Cloudflare)
//   2. Accept-Language header (browser preference)
//
// A cookie `qbitz_lang` lets users "lock" their language after manually switching.

const INDONESIAN_COOKIE = "qbitz_lang"
const ID_PREFIX = "/id"

// Paths that should never be redirected
const BYPASS_PREFIXES = [
  "/api",
  "/_next",
  "/sitemap",
  "/robots.txt",
  "/ads.txt",
  "/favicon",
  "/img",
  "/id", // already on Indonesian version
]

function shouldBypass(pathname: string): boolean {
  return BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function isIndonesianVisitor(request: NextRequest): boolean {
  // 1. Explicit language cookie overrides everything
  const langCookie = request.cookies.get(INDONESIAN_COOKIE)?.value
  if (langCookie === "en") return false
  if (langCookie === "id") return true

  // 2. Cloudflare country header
  const cfCountry = request.headers.get("cf-ipcountry")
  if (cfCountry === "ID") return true
  if (cfCountry && cfCountry !== "XX") return false // known non-ID country

  // 3. Accept-Language header fallback
  const acceptLang = request.headers.get("accept-language") || ""
  const langs = acceptLang
    .split(",")
    .map((l) => l.split(";")[0].trim().toLowerCase())
  return langs.some((l) => l === "id" || l.startsWith("id-"))
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Determine the target language based on the URL path
  const targetLang = pathname.startsWith("/id") ? "id" : "en"
  
  // Skip static assets, API, sitemap, already on /id
  if (shouldBypass(pathname)) {
    const res = NextResponse.next()
    res.headers.set("x-language", targetLang)
    return res
  }

  // Only redirect the homepage — other pages (categories, about, etc.) stay as-is
  if (pathname === "/" && isIndonesianVisitor(request)) {
    const url = request.nextUrl.clone()
    url.pathname = ID_PREFIX
    const response = NextResponse.redirect(url, { status: 302 })
    // Set cookie so subsequent requests don't need to re-detect
    response.cookies.set(INDONESIAN_COOKIE, "id", {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
      sameSite: "lax",
    })
    return response
  }

  const response = NextResponse.next()
  response.headers.set("x-language", targetLang)
  return response
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - api routes
     * - _next (static files, HMR)
     * - static files (images, favicon, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon|img|sitemap|robots|ads\.txt).*)",
  ],
}
