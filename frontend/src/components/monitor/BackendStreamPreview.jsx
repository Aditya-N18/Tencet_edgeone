import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { isVisionBackendExpected, visionBackendUrl, visionOfflineMessage } from '@/lib/visionBackend'

export function BackendStreamPreview({ streaming, className }) {
  const [frameUrl, setFrameUrl] = useState(null)
  const [streamError, setStreamError] = useState(false)
  const visionExpected = isVisionBackendExpected()
  const backendUrl = visionBackendUrl()

  useEffect(() => {
    if (!streaming || !visionExpected) {
      setFrameUrl(null)
      setStreamError(false)
      return undefined
    }

    let cancelled = false

    async function pullFrame() {
      try {
        const res = await fetch(`${backendUrl}/frame/latest?t=${Date.now()}`, {
          cache: 'no-store',
        })
        if (cancelled) return
        if (res.status === 204) return
        if (!res.ok) throw new Error(`Frame fetch failed (${res.status})`)
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        setFrameUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
        setStreamError(false)
      } catch {
        if (!cancelled) setStreamError(true)
      }
    }

    pullFrame()
    const id = setInterval(pullFrame, 300)

    return () => {
      cancelled = true
      clearInterval(id)
      setFrameUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [streaming, visionExpected, backendUrl])

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-border/60 bg-black', className)}>
      {!visionExpected ? (
        <div className="flex aspect-video items-center justify-center bg-muted/20 px-6 text-center">
          <p className="text-elder-base text-muted-foreground">
            Live camera feed appears when monitoring runs on the home tablet.
          </p>
        </div>
      ) : streaming ? (
        <>
          {frameUrl ? (
            <img
              src={frameUrl}
              alt="Live camera feed from vision service"
              className="aspect-video w-full object-cover"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center bg-muted/10 px-6 text-center">
              <p className="text-elder-base text-muted-foreground">
                {streamError ? visionOfflineMessage() : 'Loading camera feed…'}
              </p>
            </div>
          )}
          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm text-calm-sage backdrop-blur-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-calm-sage animate-pulse-slow" />
            Monitoring active
          </div>
        </>
      ) : (
        <div className="flex aspect-video items-center justify-center bg-muted/20 px-6 text-center">
          <p className="text-elder-base text-muted-foreground">
            Camera is off. Press Start monitoring to begin.
          </p>
        </div>
      )}
    </div>
  )
}
