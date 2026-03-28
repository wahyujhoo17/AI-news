"use client"

import Link from "next/link"
import Image from "next/image"

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative z-20 mt-20 border-t border-cyan-500/20 backdrop-blur-sm bg-black/60">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Brand Section */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative w-11 h-11" style={{
                filter: "drop-shadow(0 0 15px rgba(255, 255, 255, 0.35)) drop-shadow(0 0 8px rgba(6, 182, 212, 0.25))"
              }}>
                <Image
                  src="/img/qbitznew.png"
                  alt="Qbitz Logo"
                  width={44}
                  height={44}
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h3 className="font-black text-cyan-400">Qbitz</h3>
                <p className="text-[10px] text-cyan-300/60 tracking-widest">NEWS</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              AI-powered news platform for the digital era. Get the latest information with artificial intelligence technology.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-bold text-white mb-4">Navigation</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-gray-400 hover:text-cyan-300 transition-colors text-sm">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/categories" className="text-gray-400 hover:text-cyan-300 transition-colors text-sm">
                  Categories
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-gray-400 hover:text-cyan-300 transition-colors text-sm">
                  About
                </Link>
              </li>
            </ul>
          </div>

          {/* Features */}
          <div>
            <h4 className="font-bold text-white mb-4">Features</h4>
            <ul className="space-y-2">
              <li>
                <a href="/#" className="text-gray-400 hover:text-cyan-300 transition-colors text-sm">
                  Real-time Updates
                </a>
              </li>
              <li>
                <a href="/categories" className="text-gray-400 hover:text-cyan-300 transition-colors text-sm">
                  Browse Categories
                </a>
              </li>
              <li>
                <a href="/#" className="text-gray-400 hover:text-cyan-300 transition-colors text-sm">
                  Smart Search
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold text-white mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <a href="/about" className="text-gray-400 hover:text-cyan-300 transition-colors text-sm">
                  About Us
                </a>
              </li>
              <li>
                <a href="/privacy" className="text-gray-400 hover:text-cyan-300 transition-colors text-sm">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms" className="text-gray-400 hover:text-cyan-300 transition-colors text-sm">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-cyan-500/10 pt-8">
          {/* Bottom Section */}
          <div className="flex flex-col md:flex-row items-center justify-between">
            <p className="text-gray-500 text-sm text-center md:text-left mb-4 md:mb-0">
              &copy; {currentYear} Qbitz. All rights reserved. Powered by AI.
            </p>
            
            {/* Status */}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-400">System Online</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
