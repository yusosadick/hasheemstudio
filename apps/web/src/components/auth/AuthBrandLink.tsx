// Adapted from yusosadick/zahorozanzibar @ 2fd32cf (Apache-2.0).
// Modified for Hasheem Studio branding, sessions, redirect safety, and verification.
// See third_party/zahorozanzibar/README.md and LICENSE.
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Film } from 'lucide-react'

type AuthBrandLinkProps = {
  className?: string
  titleClassName?: string
}

export function AuthBrandLink({ className, titleClassName }: AuthBrandLinkProps) {
  return (
    <Link
      to="/"
      aria-label="Hasheem Studio"
      className={cn('flex items-center gap-2 whitespace-nowrap', className)}
    >
      <span className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-surface1"><Film className="h-6 w-6 text-primary" /></span>
      <span
        className={cn(
          "min-w-0 font-sans font-bold leading-none tracking-tight text-text",
          titleClassName ?? 'text-xl'
        )}
      >
        Hasheem
        <span className="font-normal text-primary"> Studio</span>
      </span>
    </Link>
  )
}
