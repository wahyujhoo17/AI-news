import type { Metadata } from "next"
import Navbar from "@/app/components/Navbar"
import Footer from "@/app/components/Footer"

export const metadata: Metadata = {
  title: "Privacy Policy | Qbitz",
  description: "Read the Qbitz Privacy Policy to understand how data is collected, used, and protected on qbitznews.com.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Privacy Policy | Qbitz",
    description: "Read the Qbitz Privacy Policy to understand how data is collected, used, and protected on qbitznews.com.",
    url: "/privacy",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy | Qbitz",
    description: "Read the Qbitz Privacy Policy to understand how data is collected, used, and protected on qbitznews.com.",
  },
}

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
          <p className="text-gray-400 text-lg">Last updated: April 5, 2026</p>
        </div>

        {/* Content */}
        <div className="prose prose-invert max-w-none space-y-8">

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">1. Introduction</h2>
            <p className="text-gray-300 leading-relaxed">
              Qbitz ("we", "our", or "us") operates the qbitznews.com website and platform. This Privacy Policy explains
              how we collect, use, disclose, and safeguard your information when you visit our website and use our services.
              By using our website, you consent to the data practices described in this policy.
            </p>
          </section>

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
                  <li>Contact information when you reach out to us</li>
                  <li>Feedback and communications</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-300">
              <li>To provide and improve our AI-powered news platform</li>
              <li>To personalize your experience and content recommendations</li>
              <li>To analyze usage patterns and optimize performance</li>
              <li>To maintain website security and prevent fraud</li>
              <li>To communicate important updates and changes</li>
              <li>To serve relevant advertisements through Google AdSense</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">4. Cookies and Tracking Technologies</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We use cookies and similar tracking technologies to enhance your browsing experience and to serve
              personalized advertisements. Cookies are small data files stored on your device.
            </p>
            <div className="space-y-3 text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-cyan-300 mb-2">Types of Cookies We Use</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li><strong className="text-white">Essential Cookies:</strong> Required for the website to function properly.</li>
                  <li><strong className="text-white">Analytics Cookies:</strong> Help us understand how visitors interact with our site.</li>
                  <li><strong className="text-white">Advertising Cookies:</strong> Used to serve relevant ads and track ad performance.</li>
                  <li><strong className="text-white">Preference Cookies:</strong> Remember your settings and preferences.</li>
                </ul>
              </div>
              <p className="leading-relaxed">
                You can control cookie settings through your browser preferences. Note that disabling certain cookies
                may affect website functionality.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">5. Google AdSense and Advertising</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We use Google AdSense to display advertisements on our website. Google AdSense uses cookies and web beacons
              to serve ads based on your prior visits to our website and other sites on the internet.
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 mb-4">
              <li>Google may use your data to serve personalized ads based on your interests.</li>
              <li>Third-party vendors, including Google, use cookies to serve ads based on prior visits.</li>
              <li>You may opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" className="text-cyan-400 hover:text-cyan-300 transition-colors underline" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>.</li>
              <li>You may also opt out at <a href="https://www.aboutads.info" className="text-cyan-400 hover:text-cyan-300 transition-colors underline" target="_blank" rel="noopener noreferrer">www.aboutads.info</a>.</li>
            </ul>
            <p className="text-gray-300 leading-relaxed">
              For more information about how Google collects and uses your data, please visit{" "}
              <a href="https://policies.google.com/technologies/ads" className="text-cyan-400 hover:text-cyan-300 transition-colors underline" target="_blank" rel="noopener noreferrer">
                Google&apos;s Privacy & Terms
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">6. Data Security</h2>
            <p className="text-gray-300 leading-relaxed">
              We implement appropriate technical and organizational measures to protect your personal information against
              unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the
              Internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">7. Third-Party Services</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Our platform uses the following third-party services that may collect data independently:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300">
              <li><strong className="text-white">Google AdSense</strong> — Advertising platform</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              This third-party service operates under its own privacy policy. We are not responsible for the privacy
              practices of these services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">8. Your Rights (GDPR / Data Subject Rights)</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              If you are located in the European Economic Area (EEA) or other regions with data protection laws, you have the right to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300">
              <li>Access your personal data we hold</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your personal data ("right to be forgotten")</li>
              <li>Object to or restrict the processing of your data</li>
              <li>Data portability — receive your data in a structured, machine-readable format</li>
              <li>Withdraw consent at any time without affecting prior processing</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              To exercise any of these rights, please contact us at{" "}
              <a href="mailto:privacy@qbitznews.com" className="text-cyan-400 hover:text-cyan-300 transition-colors underline">
                privacy@qbitznews.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">9. Children&apos;s Privacy</h2>
            <p className="text-gray-300 leading-relaxed">
              Our platform is not intended for children under 13 years of age. We do not knowingly collect personal
              information from children. If we learn that we have collected such information, we will take immediate
              steps to delete it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">10. Changes to This Privacy Policy</h2>
            <p className="text-gray-300 leading-relaxed">
              We may update this Privacy Policy periodically to reflect changes in our practices or for legal reasons.
              Changes will be posted on this page with an updated date. Your continued use of the platform after changes
              are posted constitutes your acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">11. Contact Us</h2>
            <p className="text-gray-300 leading-relaxed">
              If you have questions, concerns, or requests related to this Privacy Policy or your personal data, please contact us:
            </p>
            <ul className="mt-4 space-y-2 text-gray-300 text-sm">
              <li>Email: <a href="mailto:privacy@qbitznews.com" className="text-cyan-400 hover:text-cyan-300 transition-colors underline">privacy@qbitznews.com</a></li>
              <li>Website: <a href="https://qbitznews.com/contact" className="text-cyan-400 hover:text-cyan-300 transition-colors underline">qbitznews.com/contact</a></li>
            </ul>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  )
}
