import type { Metadata } from "next"
import IdHomePageClient from "./IdHomePageClient"

export const metadata: Metadata = {
  title: "Platform Berita Bertenaga AI",
  description: "Tetap update dengan berita Indonesia dan dunia yang dikurasi AI — analisis real-time, topik terkini, dan artikel berkategori otomatis dari Qbitz.",
  alternates: {
    canonical: "/id",
    languages: {
      "en": "/",
      "id": "/id",
    },
  },
  openGraph: {
    title: "Qbitz — Berita Terkini Bertenaga AI",
    description: "Tetap update dengan berita Indonesia dan dunia yang dikurasi AI dari Qbitz.",
    url: "/id",
    type: "website",
    locale: "id_ID",
  },
}

export default function IdHomePage() {
  return <IdHomePageClient />
}
