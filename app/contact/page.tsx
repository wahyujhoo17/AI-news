import type { Metadata } from "next"
import Navbar from "@/app/components/Navbar"
import Footer from "@/app/components/Footer"

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the Qbitz team. We welcome feedback, partnership inquiries, and content reporting.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact Us | Qbitz",
    description: "Get in touch with the Qbitz team. We welcome feedback, partnership inquiries, and content reporting.",
    url: "/contact",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Us | Qbitz",
    description: "Get in touch with the Qbitz team. We welcome feedback, partnership inquiries, and content reporting.",
  },
}

export default function ContactPage() {
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
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
            Contact{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">Us</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Have a question, feedback, or want to report an issue? We&apos;d love to hear from you.
          </p>
        </div>

        <div className="space-y-8">
          {/* Contact Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* General Inquiry */}
            <div className="border border-cyan-500/20 rounded-2xl bg-black/40 backdrop-blur-sm p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">General Inquiries</h2>
                  <p className="text-gray-400 text-sm mb-3">
                    For general questions about Qbitz, partnerships, or media requests.
                  </p>
                  <a
                    href="mailto:hello@qbitznews.com"
                    className="text-cyan-400 hover:text-cyan-300 transition-colors text-sm font-semibold underline underline-offset-2"
                  >
                    hello@qbitznews.com
                  </a>
                </div>
              </div>
            </div>

            {/* Content / Editorial */}
            <div className="border border-cyan-500/20 rounded-2xl bg-black/40 backdrop-blur-sm p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Content & Editorial</h2>
                  <p className="text-gray-400 text-sm mb-3">
                    To report inaccurate content, request corrections, or flag copyright issues.
                  </p>
                  <a
                    href="mailto:editorial@qbitznews.com"
                    className="text-cyan-400 hover:text-cyan-300 transition-colors text-sm font-semibold underline underline-offset-2"
                  >
                    editorial@qbitznews.com
                  </a>
                </div>
              </div>
            </div>

            {/* Privacy / Legal */}
            <div className="border border-cyan-500/20 rounded-2xl bg-black/40 backdrop-blur-sm p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Privacy & Legal</h2>
                  <p className="text-gray-400 text-sm mb-3">
                    For data privacy requests, GDPR inquiries, or legal matters.
                  </p>
                  <a
                    href="mailto:privacy@qbitznews.com"
                    className="text-cyan-400 hover:text-cyan-300 transition-colors text-sm font-semibold underline underline-offset-2"
                  >
                    privacy@qbitznews.com
                  </a>
                </div>
              </div>
            </div>

            {/* Technical Support */}
            <div className="border border-cyan-500/20 rounded-2xl bg-black/40 backdrop-blur-sm p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Technical Support</h2>
                  <p className="text-gray-400 text-sm mb-3">
                    To report broken pages, technical issues, or bugs on the platform.
                  </p>
                  <a
                    href="mailto:support@qbitznews.com"
                    className="text-cyan-400 hover:text-cyan-300 transition-colors text-sm font-semibold underline underline-offset-2"
                  >
                    support@qbitznews.com
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Response Time Notice */}
          <div className="border border-cyan-500/20 rounded-2xl bg-cyan-500/5 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white mb-2">Response Time</h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  We aim to respond to all inquiries within <strong className="text-white">2–3 business days</strong>. 
                  For urgent content corrections or privacy requests, please indicate urgency in your subject line and 
                  we will prioritize accordingly.
                </p>
              </div>
            </div>
          </div>

          {/* Location / Company Info */}
          <div className="border border-cyan-500/20 rounded-2xl bg-black/40 backdrop-blur-sm p-6 md:p-8">
            <h2 className="text-xl font-bold text-white mb-4">About Qbitz</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-400">
              <div>
                <p className="text-gray-500 mb-1">Platform</p>
                <p className="text-gray-300">Qbitz — AI-Powered News</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Website</p>
                <a href="https://qbitznews.com" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                  qbitznews.com
                </a>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Content Type</p>
                <p className="text-gray-300">AI-curated & AI-generated news articles</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Language</p>
                <p className="text-gray-300">English (International)</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
