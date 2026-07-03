import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function BackgroundBeams({ className }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-px w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent"
          style={{ top: `${15 + i * 14}%` }}
          animate={{
            opacity: [0.2, 0.5, 0.2],
            scaleX: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 4 + i * 0.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
      <div className="absolute -left-1/4 top-1/3 h-96 w-96 rounded-full bg-calm-teal/5 blur-3xl" />
      <div className="absolute -right-1/4 bottom-1/4 h-80 w-80 rounded-full bg-calm-sky/5 blur-3xl" />
    </div>
  )
}
