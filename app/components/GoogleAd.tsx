"use client"

import { useEffect, useRef } from "react"

interface GoogleAdProps {
  slot: string
  format?: "auto" | "rectangle" | "vertical" | "horizontal"
  fullWidthResponsive?: boolean
  className?: string
  style?: React.CSSProperties
}

declare global {
  interface Window {
    adsbygoogle: unknown[]
  }
}

export default function GoogleAd({
  slot,
  format = "auto",
  fullWidthResponsive = true,
  className = "",
  style,
}: GoogleAdProps) {
  const insRef = useRef<HTMLModElement>(null)
  const pushed = useRef(false)

  useEffect(() => {
    if (pushed.current) return
    try {
      const adsbygoogle = (window.adsbygoogle = window.adsbygoogle || [])
      adsbygoogle.push({})
      pushed.current = true
    } catch {
      // adsbygoogle not ready yet
    }
  }, [])

  return (
    <div className={"overflow-hidden " + className}>
      <ins
        ref={insRef}
        className="adsbygoogle block"
        style={style || { display: "block" }}
        data-ad-client="ca-pub-5926049453295619"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
      />
    </div>
  )
}
