import * as React from 'react'
import { cn } from '@/lib/utils'

const Badge = React.forwardRef(({ className, variant = 'default', ...props }, ref) => {
  const variants = {
    default: 'bg-primary/15 text-primary border-primary/30',
    secondary: 'bg-secondary text-secondary-foreground border-border',
    success: 'bg-calm-sage/15 text-calm-sage border-calm-sage/30',
    warning: 'bg-calm-amber/15 text-calm-amber border-calm-amber/30',
    alert: 'bg-calm-rose/15 text-calm-rose border-calm-rose/30',
  }

  return (
    <div
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full border px-4 py-1.5 text-base font-medium',
        variants[variant],
        className
      )}
      {...props}
    />
  )
})
Badge.displayName = 'Badge'

export { Badge }
