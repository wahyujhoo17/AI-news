"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState } from "react"

export default function Navbar() {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <header className="relative z-50 backdrop-blur-md bg-black/40 border-b border-cyan-500/20 sticky top-0">
      <div className="max-w-7xl mx-auto px-4 py-2 sm:py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo + Brand - Left */}
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity flex-shrink-0" style={{
            filter: "drop-shadow(0 0 20px rgba(255, 255, 255, 0.4)) drop-shadow(0 0 10px rgba(6, 182, 212, 0.3))"
          }}>
            <Image
              src="/img/qbitztext.png"
              alt="Qbitz News Logo"
              width={180}
              height={42}
              className="h-8 sm:h-9 lg:h-10 w-auto object-contain"
              priority
            />
          </Link>

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
          <div className="md:hidden mt-4 pb-4 border-t border-cyan-500/20 space-y-1 pt-3">
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
