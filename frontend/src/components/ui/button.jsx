import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-3 whitespace-nowrap rounded-xl text-elder-base font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline:
          'border-2 border-border bg-transparent hover:bg-secondary/50',
        ghost: 'hover:bg-secondary/50',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        calm:
          'bg-calm-teal/15 text-calm-teal border-2 border-calm-teal/30 hover:bg-calm-teal/25',
      },
      size: {
        default: 'h-14 px-8 py-4',
        lg: 'h-16 px-10 text-elder-lg',
        xl: 'h-20 px-12 text-elder-lg rounded-2xl',
        icon: 'h-14 w-14',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
