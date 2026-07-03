import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function VoiceAmbientOverlay({ active, className }) {
  if (!active) return null

  return (
    <div
      className={cn('pointer-events-none fixed inset-0 z-[5]', className)}
      aria-hidden
    >
      <motion.div
        className="absolute inset-0 bg-calm-amber/8"
        animate={{ opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(252,211,77,0.18)_0%,_transparent_65%)]"
        animate={{ opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -left-1/4 top-0 h-[70vh] w-[70vw] rounded-full bg-calm-amber/20 blur-[120px]"
        animate={{ opacity: [0.25, 0.45, 0.25], scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-1/4 bottom-0 h-[60vh] w-[60vw] rounded-full bg-calm-rose/15 blur-[100px]"
        animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.08, 1] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-calm-amber/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-calm-amber/40 to-transparent" />
      <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-calm-amber/30 to-transparent" />
      <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-calm-amber/30 to-transparent" />
    </div>
  )
}
