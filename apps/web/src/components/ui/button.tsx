// Adapted from yusosadick/zahorozanzibar @ 2fd32cf (Apache-2.0).
// Modified for Hasheem Studio branding, sessions, redirect safety, and verification.
// See third_party/zahorozanzibar/README.md and LICENSE.
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-primary text-white hover:opacity-90 shadow-md hover:shadow-lg',
        secondary:
          'bg-surface-light text-text hover:bg-surface-light/80 border border-border',
        outline:
          'border border-primary text-primary bg-transparent hover:bg-primary/10',
        ghost:
          'text-text hover:bg-surface-light hover:text-text',
        destructive:
          'bg-error text-white hover:bg-error/90 shadow-md',
        link:
          'text-primary underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-md',
        default: 'min-h-11 h-10 px-5 py-2 text-base sm:min-h-10 sm:text-sm',
        lg: 'min-h-12 h-12 px-8 text-base rounded-lg sm:min-h-12',
        /** Marketing pill — matches hero / Navbar CTAs; use with `rounded-full` in className if needed */
        marketing:
          'min-h-11 rounded-[50px] px-6 font-bold text-fluid-nav shadow-none sm:min-h-10',
        icon: 'h-11 w-11 sm:h-10 sm:w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
export type { ButtonProps }
