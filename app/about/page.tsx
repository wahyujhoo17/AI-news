import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import Navbar from "@/app/components/Navbar"
import Footer from "@/app/components/Footer"

export const metadata: Metadata = {
  title: "About",
  description: "Learn about Qbitz, our AI-powered news platform, and how we automate news aggregation, analysis, and publishing.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About",
    description: "Learn about Qbitz, our AI-powered news platform, and how we automate news aggregation, analysis, and publishing.",
    url: "/about",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "About",
    description: "Learn about Qbitz, our AI-powered news platform, and how we automate news aggregation, analysis, and publishing.",
  },
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-black"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
      </div>

      <Navbar />

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="relative w-40 h-40 mx-auto mb-6" style={{
            filter: "drop-shadow(0 0 40px rgba(255, 255, 255, 0.5)) drop-shadow(0 0 20px rgba(6, 182, 212, 0.4)) drop-shadow(0 0 60px rgba(59, 130, 246, 0.2))"
          }}>
            <Image
              src="/img/qbitznew.png"
              alt="Qbitz Logo"
              width={160}
              height={160}
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
            About <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">Qbitz</span>
          </h1>
          <p className="text-gray-400 text-xl max-w-2xl mx-auto">
            Platform berita AI-powered untuk era digital
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-12">
          {/* Mission Section */}
          <section className="border border-cyan-500/20 rounded-2xl bg-black/40 backdrop-blur-sm p-8 md:p-12">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Our Mission</h2>
                <p className="text-gray-400 leading-relaxed">
                  At Qbitz, we harness the power of artificial intelligence to revolutionize how people consume news. 
                  We analyze global information sources, synthesize key insights, and deliver news stories in real-time, 
                  making global events accessible and understandable to everyone.
                </p>
              </div>
            </div>
          </section>

          {/* Technology Section */}
          <section className="border border-cyan-500/20 rounded-2xl bg-black/40 backdrop-blur-sm p-8 md:p-12">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Powered by AI</h2>
                <p className="text-gray-400 leading-relaxed mb-4">
                  We use advanced artificial intelligence to:
                </p>
                <ul className="space-y-2 text-gray-400">
                  <li className="flex items-start gap-3">
                    <span className="text-cyan-400 font-bold mt-0.5">→</span>
                    <span>Aggregate news from 7+ international sources</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-cyan-400 font-bold mt-0.5">→</span>
                    <span>Generate comprehensive, original article summaries</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-cyan-400 font-bold mt-0.5">→</span>
                    <span>Auto-categorize content based on topics</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-cyan-400 font-bold mt-0.5">→</span>
                    <span>Find relevant featured images automatically</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-cyan-400 font-bold mt-0.5">→</span>
                    <span>Update content every 30 minutes</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="border border-cyan-500/20 rounded-2xl bg-black/40 backdrop-blur-sm p-8 md:p-12">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">Key Features</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-black/60 rounded-lg border border-cyan-500/10">
                    <h3 className="font-bold text-cyan-300 mb-2">Real-time Updates</h3>
                    <p className="text-sm text-gray-400">Fresh articles every 30 minutes from global sources</p>
                  </div>
                  <div className="p-4 bg-black/60 rounded-lg border border-cyan-500/10">
                    <h3 className="font-bold text-cyan-300 mb-2">Smart Search</h3>
                    <p className="text-sm text-gray-400">Find articles instantly with intelligent search</p>
                  </div>
                  <div className="p-4 bg-black/60 rounded-lg border border-cyan-500/10">
                    <h3 className="font-bold text-cyan-300 mb-2">Category Browse</h3>
                    <p className="text-sm text-gray-400">Explore 7+ categories: Tech, Business, Sports, and more</p>
                  </div>
                  <div className="p-4 bg-black/60 rounded-lg border border-cyan-500/10">
                    <h3 className="font-bold text-cyan-300 mb-2">Rich Visuals</h3>
                    <p className="text-sm text-gray-400">Beautiful featured images on every article</p>
                  </div>
                  <div className="p-4 bg-black/60 rounded-lg border border-cyan-500/10">
                    <h3 className="font-bold text-cyan-300 mb-2">Markdown Format</h3>
                    <p className="text-sm text-gray-400">Well-structured content with proper formatting</p>
                  </div>
                  <div className="p-4 bg-black/60 rounded-lg border border-cyan-500/10">
                    <h3 className="font-bold text-cyan-300 mb-2">Related Articles</h3>
                    <p className="text-sm text-gray-400">Smart recommendations based on article topics</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* AI System Section */}
          <section className="border border-cyan-500/20 rounded-2xl bg-black/40 backdrop-blur-sm p-8 md:p-12">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">Fully AI-Managed System</h2>
                <p className="text-gray-400 leading-relaxed mb-4">
                  Qbitz operates on a fully automated AI system that continuously monitors, analyzes, and generates news content 
                  without human intervention. Our intelligent algorithms work 24/7 to keep you informed with the latest global developments.
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-cyan-400 font-bold mt-0.5">✓</span>
                    <span className="text-gray-400"><strong>Automated Content Processing:</strong> AI automatically aggregates information, analyzes context, and generates original summaries</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-cyan-400 font-bold mt-0.5">✓</span>
                    <span className="text-gray-400"><strong>Continuous Updates:</strong> New articles added every 30 minutes with fresh perspectives</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-cyan-400 font-bold mt-0.5">✓</span>
                    <span className="text-gray-400"><strong>Intelligent Categorization:</strong> AI automatically classifies content into relevant topics</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-cyan-400 font-bold mt-0.5">✓</span>
                    <span className="text-gray-400"><strong>Quality Assurance:</strong> Multi-layer duplicate prevention ensures original content</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-cyan-400 font-bold mt-0.5">✓</span>
                    <span className="text-gray-400"><strong>Visual Enhancement:</strong> AI selects and optimizes featured images for each story</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-cyan-400 font-bold mt-0.5">✓</span>
                    <span className="text-gray-400"><strong>Smart Recommendations:</strong> AI recommends related articles based on topic relevance</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="border border-cyan-500/30 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 backdrop-blur-sm p-8 md:p-12 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Ready to Stay Informed?</h2>
            <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
              Start exploring the latest AI-powered news coverage. Browse categories, search articles, or subscribe for updates.
            </p>
            <Link
              href="/"
              className="inline-block px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-lg hover:shadow-lg hover:shadow-cyan-500/50 transition-all"
            >
              Back to Home
            </Link>
          </section>
        </div>

        {/* Stats Section */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-black text-cyan-400 mb-2">100%</div>
            <p className="text-sm text-gray-400">AI Managed</p>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-black text-cyan-400 mb-2">24/7</div>
            <p className="text-sm text-gray-400">Continuous Operation</p>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-black text-cyan-400 mb-2">8+</div>
            <p className="text-sm text-gray-400">News Categories</p>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-black text-cyan-400 mb-2">30min</div>
            <p className="text-sm text-gray-400">Update Cycle</p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
