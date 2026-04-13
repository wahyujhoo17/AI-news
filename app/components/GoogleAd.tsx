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

    let attempts = 0
    let retryTimer: number | undefined

    const tryPush = () => {
      if (pushed.current) return true
      try {
        const adsbygoogle = (window.adsbygoogle = window.adsbygoogle || [])
        adsbygoogle.push({})
        pushed.current = true
        return true
      } catch {
        return false
      }
    }

    if (!tryPush()) {
      // Retry for cases where adsbygoogle script loads after component mount.
      retryTimer = window.setInterval(() => {
        attempts += 1
        if (tryPush() || attempts >= 10) {
          if (retryTimer) window.clearInterval(retryTimer)
        }
      }, 1500)
    }

    return () => {
      if (retryTimer) window.clearInterval(retryTimer)
    }
  }, [])

  return (
    <ins
      ref={insRef}
      className={`adsbygoogle block overflow-hidden [&[data-ad-status="unfilled"]]:!hidden ${className}`}
      style={style || { display: "block" }}
      data-ad-client="ca-pub-5926049453295619"
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
    />
  )
}
