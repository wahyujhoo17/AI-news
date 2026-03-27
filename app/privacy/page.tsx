"use client"

import Navbar from "@/app/components/Navbar"
import Footer from "@/app/components/Footer"

export default function PrivacyPage() {
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
            Privacy <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">Policy</span>
          </h1>
          <p className="text-gray-400 text-lg">Last updated: March 26, 2026</p>
        </div>

        {/* Content */}
        <div className="prose prose-invert max-w-none space-y-8">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">1. Introduction</h2>
            <p className="text-gray-300 leading-relaxed">
              Qbitz ("we", "our", or "us") operates the qbitznews.com website and platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services.
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">2. Information We Collect</h2>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-cyan-300 mb-2">Automatically Collected Information</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>IP address and browser type</li>
                  <li>Device information and operating system</li>
                  <li>Pages visited and time spent on site</li>
                  <li>Referral source and navigation patterns</li>
                  <li>Cookies and similar tracking technologies</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-cyan-300 mb-2">Information You Provide</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>Search queries and preferences</li>
                  <li>Contact information (if provided)</li>
                  <li>Feedback and user comments</li>
                </ul>
              </div>
            </div>
          </section>

          {/* How We Use Information */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-300">
              <li>To provide and improve our AI-powered news platform</li>
              <li>To personalize your experience and content recommendations</li>
              <li>To analyze usage patterns and optimize performance</li>
              <li>To maintain website security and prevent fraud</li>
              <li>To communicate important updates and changes</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          {/* Data Security */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">4. Data Security</h2>
            <p className="text-gray-300 leading-relaxed">
              We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet is 100% secure.
            </p>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">5. Cookies and Tracking</h2>
            <p className="text-gray-300 leading-relaxed">
              We use cookies and similar tracking technologies to enhance your browsing experience. You can control cookie settings through your browser preferences. Note that disabling cookies may affect some functionality of our platform.
            </p>
          </section>

          {/* Third-Party Services */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">6. Third-Party Services</h2>
            <p className="text-gray-300 leading-relaxed">
              Our platform uses third-party services for analytics, CDN delivery, and image hosting (Unsplash). We do not share your personal information with these services beyond what is necessary for platform functionality. Each third-party service has their own privacy policy.
            </p>
          </section>

          {/* User Rights */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">7. Your Rights</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              You have the right to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300">
              <li>Access your personal data we hold</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your data</li>
              <li>Opt-out of certain data collection</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">8. Children's Privacy</h2>
            <p className="text-gray-300 leading-relaxed">
              Our platform is not intended for children under 13 years of age. We do not knowingly collect personal information from children. If we learn that we have collected such information, we will take steps to delete it promptly.
            </p>
          </section>

          {/* Policy Changes */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">9. Changes to Privacy Policy</h2>
            <p className="text-gray-300 leading-relaxed">
              We may update this Privacy Policy periodically. Changes will be posted on this page with an updated "Last updated" date. Your continued use of the platform constitutes acceptance of any changes.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">10. Contact Us</h2>
            <p className="text-gray-300 leading-relaxed">
              If you have questions about this Privacy Policy or our privacy practices, please contact us at:
            </p>
            <p className="text-cyan-400 mt-4">
              Email: privacy@qbitz.ai
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
