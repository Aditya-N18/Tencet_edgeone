import { cn } from '@/lib/utils'

export function WebcamPreview({ videoRef, active, error, className }) {
  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-border/60 bg-black', className)}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          'aspect-video w-full object-cover transition-opacity duration-500',
          active ? 'opacity-100' : 'opacity-30'
        )}
      />
      {!active && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 px-6 text-center">
          <p className="text-elder-base text-muted-foreground">
            Waiting for vision model to start…
          </p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 px-6 text-center">
          <p className="text-elder-base text-calm-rose">{error}</p>
        </div>
      )}
      {active && (
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm text-calm-sage backdrop-blur-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-calm-sage animate-pulse-slow" />
          Live
        </div>
      )}
    </div>
  )
}
