import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const sizeMap = {
  sm: 'h-16 w-16',
  md: 'h-24 w-24',
  lg: 'h-32 w-32',
  xl: 'h-40 w-40',
}

const colorMap = {
  calm: 'bg-calm-teal/20 text-calm-teal ring-calm-teal/30',
  listening: 'bg-calm-sky/20 text-calm-sky ring-calm-sky/30 animate-pulse-slow',
  alert: 'bg-calm-rose/20 text-calm-rose ring-calm-rose/30 animate-pulse',
  safe: 'bg-calm-sage/20 text-calm-sage ring-calm-sage/30',
}

export function PulseOrb({ status = 'calm', size = 'lg', icon: Icon, className }) {
  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      <motion.div
        className={cn(
          'absolute rounded-full opacity-30',
          sizeMap[size],
          colorMap[status].split(' ')[0]
        )}
        animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.1, 0.3] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        className={cn(
          'relative flex items-center justify-center rounded-full ring-2',
          sizeMap[size],
          colorMap[status]
        )}
      >
        {Icon && <Icon className="h-1/2 w-1/2" strokeWidth={1.75} />}
      </div>
    </div>
  )
}
