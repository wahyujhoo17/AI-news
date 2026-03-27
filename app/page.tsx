import type { Metadata } from "next"
import HomePageClient from "./HomePageClient"

export const metadata: Metadata = {
  title: "AI-Powered News Platform",
  description: "Stay updated with AI-powered global news coverage, real-time analysis, and automatically categorized stories from Qbitz.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Qbitz - AI-Powered News Platform",
    description: "Stay updated with AI-powered global news coverage, real-time analysis, and automatically categorized stories from Qbitz.",
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Qbitz - AI-Powered News Platform",
    description: "Stay updated with AI-powered global news coverage, real-time analysis, and automatically categorized stories from Qbitz.",
  },
}

export default function HomePage() {
  return <HomePageClient />
}
