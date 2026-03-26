"use client"

import Navbar from "@/app/components/Navbar"
import Footer from "@/app/components/Footer"

export default function TermsPage() {
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
            Terms of <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">Service</span>
          </h1>
          <p className="text-gray-400 text-lg">Last updated: March 26, 2026</p>
        </div>

        {/* Content */}
        <div className="prose prose-invert max-w-none space-y-8">
          {/* Agreement */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">1. Agreement to Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              By accessing and using the Qbitz website and services located at ai-news.lumicloud.my.id, you accept and agree to be bound by and abide by the terms and conditions of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          {/* Use License */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">2. Use License</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Permission is granted to temporarily download one copy of the materials (information or software) on the Qbitz platform for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300">
              <li>Modifying or copying the materials</li>
              <li>Using the materials for any commercial purpose or for any public display</li>
              <li>Attempting to decompile, reverse engineer, or disassemble any software contained on the platform</li>
              <li>Removing any copyright or other proprietary notations from the materials</li>
              <li>Transferring the materials to another person or "mirroring" the materials on any other server</li>
              <li>Using automated tools or scripts to access or scrape the platform</li>
            </ul>
          </section>

          {/* Disclaimer */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">3. Disclaimer</h2>
            <p className="text-gray-300 leading-relaxed">
              The materials on the Qbitz platform are provided on an 'as is' basis. Qbitz makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
            </p>
          </section>

          {/* Limitations */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">4. Limitations of Liability</h2>
            <p className="text-gray-300 leading-relaxed">
              In no event shall Qbitz or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on the Qbitz platform, even if Qbitz or an authorized representative has been notified orally or in writing of the possibility of such damage.
            </p>
          </section>

          {/* Content Accuracy */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">5. Content Accuracy</h2>
            <p className="text-gray-300 leading-relaxed">
              The materials appearing on the Qbitz platform could include technical, typographical, or photographic errors. Qbitz does not warrant that any of the materials on the platform are accurate, complete, or current. Qbitz may make changes to the materials contained on the platform at any time without notice.
            </p>
          </section>

          {/* AI-Generated Content */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">6. AI-Generated Content</h2>
            <p className="text-gray-300 leading-relaxed">
              Qbitz uses artificial intelligence to generate, summarize, and categorize news content. While we strive for accuracy, AI-generated content may contain errors or inaccuracies. Users should verify important information from original sources before relying on it for decision-making.
            </p>
          </section>

          {/* User Conduct */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">7. User Conduct</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Users agree not to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300">
              <li>Engage in any conduct that restricts or inhibits anyone's use or enjoyment of the platform</li>
              <li>Post or transmit harassing, threatening, offensive, or illegal content</li>
              <li>Attempt to gain unauthorized access to secure portions or features</li>
              <li>Use the platform for spam, phishing, or malicious purposes</li>
              <li>Violate any applicable laws or regulations</li>
            </ul>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">8. Intellectual Property Rights</h2>
            <p className="text-gray-300 leading-relaxed">
              The materials on the Qbitz platform, including but not limited to text, graphics, logos, images, and software, are the property of Qbitz or its content suppliers and are protected by international copyright laws. Unauthorized use is prohibited.
            </p>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">9. Termination of Access</h2>
            <p className="text-gray-300 leading-relaxed">
              Qbitz may terminate or suspend your access to all or part of the platform, without notice and for any reason, including if you violate these Terms of Service.
            </p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">10. Governing Law</h2>
            <p className="text-gray-300 leading-relaxed">
              These terms and conditions are governed by and construed in accordance with the laws of Indonesia, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
            </p>
          </section>

          {/* Modifications */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">11. Modifications to Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              Qbitz may revise these terms of service for the platform at any time without notice. By using this platform, you are agreeing to be bound by the then current version of these terms of service.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">12. Contact Us</h2>
            <p className="text-gray-300 leading-relaxed">
              If you have questions about these Terms of Service, please contact us at:
            </p>
            <p className="text-cyan-400 mt-4">
              Email: legal@qbitz.ai
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
