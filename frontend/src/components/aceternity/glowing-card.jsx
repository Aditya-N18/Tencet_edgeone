import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function GlowingCard({ children, className, glowColor = 'teal' }) {
  const glowMap = {
    teal: 'from-calm-teal/20 via-primary/10 to-transparent',
    amber: 'from-calm-amber/20 via-calm-amber/5 to-transparent',
    rose: 'from-calm-rose/20 via-destructive/10 to-transparent',
    sky: 'from-calm-sky/20 via-accent/10 to-transparent',
  }

  return (
    <div className={cn('group relative', className)}>
      <div
        className={cn(
          'absolute -inset-0.5 rounded-2xl bg-gradient-to-r opacity-60 blur transition duration-500 group-hover:opacity-100',
          glowMap[glowColor]
        )}
      />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative rounded-2xl"
      >
        {children}
      </motion.div>
    </div>
  )
}
