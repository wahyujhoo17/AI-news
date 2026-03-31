import type { Metadata } from "next"
import Navbar from "@/app/components/Navbar"
import Footer from "@/app/components/Footer"

export const metadata: Metadata = {
  title: "Disclaimer",
  description: "Read the Qbitz Disclaimer regarding AI-generated content, accuracy limitations, and third-party source attribution.",
  alternates: {
    canonical: "/disclaimer",
  },
  openGraph: {
    title: "Disclaimer | Qbitz",
    description: "Read the Qbitz Disclaimer regarding AI-generated content, accuracy limitations, and third-party source attribution.",
    url: "/disclaimer",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Disclaimer | Qbitz",
    description: "Read the Qbitz Disclaimer regarding AI-generated content, accuracy limitations, and third-party source attribution.",
  },
}

export default function DisclaimerPage() {
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
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">Disclaimer</span>
          </h1>
          <p className="text-gray-400 text-lg">Last updated: March 31, 2026</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8">
          {/* AI-Generated Content */}
          <section className="border border-cyan-500/20 rounded-2xl bg-black/40 p-6 md:p-8">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">1. AI-Generated Content</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Qbitz is an AI-powered news aggregation and content platform. Articles published on qbitznews.com are 
              generated or summarized with the assistance of artificial intelligence (AI) models. While we strive for 
              accuracy and quality, AI-generated content may contain errors, inaccuracies, or outdated information.
            </p>
            <p className="text-gray-300 leading-relaxed">
              Qbitz does not guarantee the completeness, accuracy, timeliness, or reliability of any content 
              published on this platform. Readers are encouraged to verify important information through primary 
              sources before making any decisions based on content from this site.
            </p>
          </section>

          {/* No Professional Advice */}
          <section className="border border-cyan-500/20 rounded-2xl bg-black/40 p-6 md:p-8">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">2. No Professional Advice</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              The content published on Qbitz is for general informational and educational purposes only. Nothing on 
              this website constitutes professional advice of any kind, including but not limited to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 mb-4">
              <li>Medical, health, or clinical advice</li>
              <li>Financial, investment, or trading advice</li>
              <li>Legal, regulatory, or compliance advice</li>
              <li>Technical or engineering recommendations</li>
            </ul>
            <p className="text-gray-300 leading-relaxed">
              Always consult a qualified professional before making decisions in these domains.
            </p>
          </section>

          {/* Third-Party Sources */}
          <section className="border border-cyan-500/20 rounded-2xl bg-black/40 p-6 md:p-8">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">3. Third-Party Sources & Attribution</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Qbitz aggregates and summarizes information from publicly available third-party news sources. All 
              original source articles remain the intellectual property of their respective publishers. Qbitz credits 
              original sources on every article where attribution data is available.
            </p>
            <p className="text-gray-300 leading-relaxed">
              Qbitz does not claim authorship or ownership over source content. If you believe any content on this 
              platform infringes your copyright or is inaccurately attributed, please contact us at{" "}
              <a
                href="mailto:editorial@qbitznews.com"
                className="text-cyan-400 hover:text-cyan-300 transition-colors underline underline-offset-2"
              >
                editorial@qbitznews.com
              </a>{" "}
              and we will address your request promptly.
            </p>
          </section>

          {/* External Links */}
          <section className="border border-cyan-500/20 rounded-2xl bg-black/40 p-6 md:p-8">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">4. External Links</h2>
            <p className="text-gray-300 leading-relaxed">
              Articles on Qbitz may contain links to external websites. These links are provided for reference and 
              convenience only. Qbitz does not endorse, control, or take responsibility for the content, privacy 
              practices, or accuracy of any external websites. Accessing external links is at your own risk.
            </p>
          </section>

          {/* Advertising */}
          <section className="border border-cyan-500/20 rounded-2xl bg-black/40 p-6 md:p-8">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">5. Advertising</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Qbitz may display advertisements served by third-party networks including Google AdSense. These 
              advertisements are not endorsements of the advertised products or services by Qbitz.
            </p>
            <p className="text-gray-300 leading-relaxed">
              Third-party advertisers may use cookies and tracking technologies to serve personalized ads. 
              For more information, please review our{" "}
              <a href="/privacy" className="text-cyan-400 hover:text-cyan-300 transition-colors underline underline-offset-2">
                Privacy Policy
              </a>.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section className="border border-cyan-500/20 rounded-2xl bg-black/40 p-6 md:p-8">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">6. Limitation of Liability</h2>
            <p className="text-gray-300 leading-relaxed">
              To the maximum extent permitted by applicable law, Qbitz, its operators, affiliates, employees, and 
              agents shall not be liable for any direct, indirect, incidental, consequential, or punitive damages 
              arising from your use of, or reliance on, any content published on this platform. Use of this website 
              is entirely at your own risk.
            </p>
          </section>

          {/* Changes */}
          <section className="border border-cyan-500/20 rounded-2xl bg-black/40 p-6 md:p-8">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">7. Changes to This Disclaimer</h2>
            <p className="text-gray-300 leading-relaxed">
              Qbitz reserves the right to update or modify this Disclaimer at any time without prior notice. 
              Continued use of the platform after any changes constitutes your acceptance of the updated Disclaimer. 
              We encourage you to review this page periodically.
            </p>
          </section>

          {/* Contact */}
          <section className="border border-cyan-500/30 bg-cyan-500/5 rounded-2xl p-6 md:p-8">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">8. Contact</h2>
            <p className="text-gray-300 leading-relaxed">
              If you have questions about this Disclaimer or wish to report inaccurate content, please reach out:
            </p>
            <ul className="mt-4 space-y-2 text-gray-300 text-sm">
              <li>
                Email:{" "}
                <a
                  href="mailto:hello@qbitznews.com"
                  className="text-cyan-400 hover:text-cyan-300 transition-colors underline underline-offset-2"
                >
                  hello@qbitznews.com
                </a>
              </li>
              <li>
                Website:{" "}
                <a
                  href="https://qbitznews.com"
                  className="text-cyan-400 hover:text-cyan-300 transition-colors underline underline-offset-2"
                >
                  qbitznews.com
                </a>
              </li>
              <li>
                Contact page:{" "}
                <a
                  href="/contact"
                  className="text-cyan-400 hover:text-cyan-300 transition-colors underline underline-offset-2"
                >
                  qbitznews.com/contact
                </a>
              </li>
            </ul>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
