// Adapted from yusosadick/zahorozanzibar @ 2fd32cf (Apache-2.0).
// Modified for Hasheem Studio branding, sessions, redirect safety, and verification.
// See third_party/zahorozanzibar/README.md and LICENSE.
import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { supabase, exchangeCodeOnce } from '@/lib/supabase'
import { PageSEO } from '@/components/shared/PageSEO'

const resetSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
})

type ResetForm = z.infer<typeof resetSchema>

type LinkState = 'verifying' | 'ready' | 'invalid'

/**
 * Supabase password-recovery links arrive in one of two shapes depending on
 * project + email-template settings:
 *   1. PKCE:    /reset-password?code=<one-time-code>
 *   2. Implicit: /reset-password#access_token=...&refresh_token=...&type=recovery
 * We support both, plus a clear "link expired" state when neither is present
 * AND there is no recovery session already on the client. This stops the bad
 * UX where the form submitted with no session and the raw Supabase error
 * "Auth session missing!" leaked through.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code')
  const { updatePassword } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [linkState, setLinkState] = useState<LinkState>('verifying')

  useEffect(() => {
    let cancelled = false

    void (async () => {
      // Shape 1: PKCE — exchange the code for a session.
      if (code) {
        const { error: exErr } = await exchangeCodeOnce(code)
        if (cancelled) return
        if (exErr) {
          setLinkState('invalid')
          return
        }
        navigate('/reset-password', { replace: true })
        setLinkState('ready')
        return
      }

      // Shape 2: implicit / recovery hash — parse the fragment.
      const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
      if (hash) {
        const params = new URLSearchParams(hash)
        const access = params.get('access_token')
        const refresh = params.get('refresh_token')
        const type = params.get('type')
        if (access && refresh && (type === 'recovery' || type === null)) {
          const { error: setErr } = await supabase.auth.setSession({
            access_token: access,
            refresh_token: refresh,
          })
          if (cancelled) return
          if (setErr) {
            setLinkState('invalid')
            return
          }
          // Strip the tokens from the URL so they don't sit in history / shoulder-surf range.
          window.history.replaceState(null, '', '/reset-password')
          setLinkState('ready')
          return
        }
      }

      // Shape 3: nothing in the URL — fall back to an existing session if
      // one is already loaded (e.g. user came back to the tab after clicking).
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      setLinkState(data.session ? 'ready' : 'invalid')
    })()

    return () => {
      cancelled = true
    }
  }, [code, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
  })

  const onSubmit = async (data: ResetForm) => {
    try {
      setError(null)
      // Guard: never call updateUser() without a recovery session — that's
      // what surfaces the cryptic "Auth session missing!" error.
      const { data: s } = await supabase.auth.getSession()
      if (!s.session) {
        setLinkState('invalid')
        return
      }
      await updatePassword(data.password)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reset password'
      setError(message)
    }
  }

  return (
    <>
      <PageSEO
        title="Set new password"
        description="Choose a new password for your Hasheem Studio account."
        canonicalPath="/reset-password"
        noIndex
      />
    <div data-public-dark="true" className="relative w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >


        <Card className="border-0 bg-transparent shadow-none">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {success ? 'Password Updated' : 'Set New Password'}
            </CardTitle>
            <CardDescription>
              {success
                ? 'Your password has been reset successfully'
                : 'Enter your new password below'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {success ? (
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-400" />
                </div>
                <p className="text-sm text-text-muted">
                  Redirecting you to the login page...
                </p>
              </div>
            ) : linkState === 'verifying' ? (
              <div className="text-center py-8 text-sm text-text-muted">Verifying reset link…</div>
            ) : linkState === 'invalid' ? (
              <div className="space-y-4 text-center">
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                  This password reset link is no longer valid. It may have expired,
                  already been used, or been opened in a different browser than the
                  one you requested it from.
                </div>
                <Link to="/forgot-password">
                  <Button className="w-full" size="lg">Request a new link</Button>
                </Link>
                <Link
                  to="/login"
                  className="block text-xs text-text-muted hover:text-text transition-colors"
                >
                  Back to sign in
                </Link>
              </div>
            ) : (
              <>
                {error && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-muted">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                      <input
                        {...register('password')}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min 8 chars, 1 uppercase, 1 number"
                        className={cn(
                          'w-full rounded-lg border bg-background/50 py-2.5 pl-10 pr-10 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all',
                          errors.password ? 'border-red-500' : 'border-border'
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
                  </div>

                  <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? 'Updating...' : 'Update Password'}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
    </>
  )
}
