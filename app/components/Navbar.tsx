"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"

interface SearchResult {
  id: number
  title: string
  featured_image?: string
  excerpt?: string
  created_at: string
}

function generateSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Handle search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    setIsSearching(true)
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/articles?limit=100`)
        const data = await response.json()
        const articles = data.articles || []

        const query = searchQuery.toLowerCase()
        const filtered = articles
          .filter((a: SearchResult) =>
            a.title.toLowerCase().includes(query) ||
            a.excerpt?.toLowerCase().includes(query)
          )
          .slice(0, 8)

        setSearchResults(filtered)
        setShowDropdown(true)
      } catch (error) {
        console.error("Search error:", error)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSearchResultClick = (articleTitle: string) => {
    const slug = generateSlug(articleTitle)
    setSearchQuery("")
    setShowDropdown(false)
    setIsMobileMenuOpen(false)
    router.push(`/articles/${slug}`)
  }

  return (
    <header className="relative z-50 backdrop-blur-md bg-black/40 border-b border-cyan-500/20 sticky top-0">
      <div className="max-w-7xl mx-auto px-4 py-2 sm:py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo + Brand - Left */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity flex-shrink-0" style={{
            filter: "drop-shadow(0 0 20px rgba(255, 255, 255, 0.4)) drop-shadow(0 0 10px rgba(6, 182, 212, 0.3))"
          }}>
            <Image
              src="/img/Qbitz.png"
              alt="Qbitz Logo"
              width={44}
              height={44}
              className="w-10 h-10 sm:w-11 sm:h-11 object-contain"
              priority
            />
            <div className="hidden sm:flex flex-col leading-none">
              <h1 className="text-base sm:text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300">
                Qbitz
              </h1>
              <p className="text-cyan-300/60 text-[8px] sm:text-[9px] tracking-widest font-semibold">AI NEWS</p>
            </div>
          </Link>

          {/* Center Search Bar - Desktop Only */}
          <div ref={searchRef} className="hidden lg:flex flex-1 max-w-sm relative">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.trim() && setShowDropdown(true)}
                className="w-full px-3 py-2 rounded-lg bg-gray-800/50 border border-cyan-500/30 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 transition-all text-sm"
              />
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-black/90 border border-cyan-500/30 rounded-lg overflow-hidden z-50 backdrop-blur-sm max-h-80 overflow-y-auto">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleSearchResultClick(result.title)}
                      className="w-full px-3 py-2 hover:bg-cyan-500/20 transition-all flex gap-2 items-start border-b border-cyan-500/10 last:border-b-0 text-left"
                    >
                      {result.featured_image && (
                        <Image
                          src={result.featured_image}
                          alt={result.title}
                          width={40}
                          height={40}
                          className="w-10 h-10 object-cover rounded flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-white line-clamp-1">{result.title}</h4>
                        <p className="text-[10px] text-cyan-400/60">{new Date(result.created_at).toLocaleDateString()}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className={`text-sm font-semibold transition-colors ${
                pathname === "/" ? "text-cyan-400" : "text-gray-300 hover:text-cyan-300"
              }`}
            >
              Home
            </Link>
            <Link
              href="/categories"
              className={`text-sm font-semibold transition-colors ${
                pathname === "/categories" ? "text-cyan-400" : "text-gray-300 hover:text-cyan-300"
              }`}
            >
              Categories
            </Link>
            <Link
              href="/about"
              className={`text-sm font-semibold transition-colors ${
                pathname === "/about" ? "text-cyan-400" : "text-gray-300 hover:text-cyan-300"
              }`}
            >
              About
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 hover:bg-cyan-500/10 rounded-lg transition-all"
          >
            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-cyan-500/20 space-y-3">
            {/* Mobile Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.trim() && setShowDropdown(true)}
                className="w-full px-3 py-2 rounded-lg bg-gray-800/50 border border-cyan-500/30 text-white placeholder-gray-400 focus:outline-none text-sm"
              />
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-black/90 border border-cyan-500/30 rounded-lg overflow-hidden z-50 max-h-64 overflow-y-auto">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleSearchResultClick(result.title)}
                      className="w-full px-3 py-2 hover:bg-cyan-500/20 text-left border-b border-cyan-500/10 last:border-b-0"
                    >
                      <h4 className="text-xs font-semibold text-white line-clamp-1">{result.title}</h4>
                      <p className="text-[10px] text-cyan-400/60">{new Date(result.created_at).toLocaleDateString()}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile Navigation */}
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-lg font-semibold text-sm ${
                pathname === "/" ? "bg-cyan-500/20 text-cyan-300" : "text-gray-300"
              }`}
            >
              Home
            </Link>
            <Link
              href="/categories"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-lg font-semibold text-sm ${
                pathname === "/categories" ? "bg-cyan-500/20 text-cyan-300" : "text-gray-300"
              }`}
            >
              Categories
            </Link>
            <Link
              href="/about"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-lg font-semibold text-sm ${
                pathname === "/about" ? "bg-cyan-500/20 text-cyan-300" : "text-gray-300"
              }`}
            >
              About
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
