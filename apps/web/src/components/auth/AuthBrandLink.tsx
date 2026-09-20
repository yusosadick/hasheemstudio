// Adapted from yusosadick/zahorozanzibar @ 2fd32cf (Apache-2.0).
// Modified for Hasheem Studio branding, sessions, redirect safety, and verification.
// See third_party/zahorozanzibar/README.md and LICENSE.
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

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
      <img
        src="/images/brand/hasheem-gaming-wordmark-dark.png"
        alt="Hasheem Gaming"
        className={cn(
          'h-auto max-w-full object-contain object-left',
          titleClassName === 'text-2xl' ? 'w-56' : 'w-48'
        )}
      />
    </Link>
  )
}
