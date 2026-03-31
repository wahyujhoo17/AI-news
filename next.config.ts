import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.guim.co.uk" },
      { protocol: "https", hostname: "media.guim.co.uk" },
      { protocol: "https", hostname: "static01.nyt.com" },
      { protocol: "https", hostname: "images.wsj.net" },
      { protocol: "https", hostname: "cdn.vox-cdn.com" },
      { protocol: "https", hostname: "images.cnbc.com" },
      { protocol: "https", hostname: "media.cnn.com" },
      { protocol: "https", hostname: "s.yimg.com" },
      { protocol: "https", hostname: "ichef.bbci.co.uk" },
      { protocol: "https", hostname: "cdn.mos.cms.futurecdn.net" },
      { protocol: "https", hostname: "images.axios.com" },
      { protocol: "https", hostname: "static.reuters.com" },
      { protocol: "https", hostname: "dims.apnews.com" },
      { protocol: "https", hostname: "assets.bwbx.io" },
      { protocol: "https", hostname: "images.fastcompany.net" },
      { protocol: "https", hostname: "cdn.arstechnica.net" },
      { protocol: "https", hostname: "i.kinja-img.com" },
      { protocol: "https", hostname: "**.techcrunch.com" },
    ],
  },
}

export default nextConfig
