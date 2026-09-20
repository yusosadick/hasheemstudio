// Adapted from yusosadick/zahorozanzibar @ 2fd32cf (Apache-2.0).
// Modified for Hasheem Studio branding, sessions, redirect safety, and verification.
// See third_party/zahorozanzibar/README.md and LICENSE.
import { AUTH_RETURN_KEY, safeReturnPath } from '@/lib/authReturn'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { PageSEO } from '@/components/shared/PageSEO'

const forgotSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

type ForgotForm = z.infer<typeof forgotSchema>

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  useEffect(() => { const next=params.get('next'); if(next) {try{localStorage.setItem(AUTH_RETURN_KEY,safeReturnPath(next))}catch{/* optional */}} },[params])
  const { resetPassword, verifyRecoveryCode } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  // Email is captured on send so the code-verify step can pass it to verifyOtp.
  const [sentEmail, setSentEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
  })

  const onSubmit = async (data: ForgotForm) => {
    try {
      setError(null)
      await resetPassword(data.email)
      setSentEmail(data.email)
      setSent(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send reset code email'
      setError(message)
    }
  }

  // Code path: user copies the 6-digit code from the email and submits it here.
  // verifyOtp establishes a recovery session, then we route to /reset-password
  // exactly where the one-click link would have landed them.
  const onVerifyCode = async () => {
    const token = code.replace(/\s/g, '')
    // Must match the Supabase project's OTP length (Auth → Email → OTP length, currently 6).
    if (!/^\d{6}$/.test(token)) {
      setCodeError('Enter the 6-digit code from your email.')
      return
    }
    try {
      setCodeError(null)
      setVerifying(true)
      await verifyRecoveryCode(sentEmail, token)
      navigate('/reset-password', { replace: true })
    } catch {
      // Supabase returns a generic error for wrong/expired/used codes — keep it generic.
      setCodeError('That code is invalid or has expired. Request a new code below.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <>
      <PageSEO
        title="Reset password"
        description="Request a password reset code for your Hasheem Studio account."
        canonicalPath="/forgot-password"
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
              {sent ? 'Check your email' : 'Reset password'}
            </CardTitle>
            <CardDescription>
              {sent
                ? 'Enter the six-digit code we just emailed you'
                : 'Enter your email and we\'ll send you a reset code'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {sent ? (
              <div className="space-y-4">
                <p className="text-sm text-text-muted">
                  Enter the six-digit password recovery code from your email below.
                </p>

                <div className="space-y-2">
                  <input
                    aria-label="Recovery code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                    onKeyDown={(e) => { if (e.key === 'Enter') void onVerifyCode() }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="6-digit code"
                    className={cn(
                      'w-full rounded-lg border bg-background/50 py-3 px-4 text-center text-xl font-semibold tracking-[0.25em] text-text placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all',
                      codeError ? 'border-red-500' : 'border-border'
                    )}
                  />
                  {codeError && <p className="text-xs text-red-400">{codeError}</p>}
                </div>

                <Button
                  onClick={() => void onVerifyCode()}
                  className="w-full"
                  size="lg"
                  disabled={verifying}
                >
                  {verifying ? 'Verifying…' : 'Continue'}
                </Button>

                <Link
                  to="/login"
                  className="flex items-center justify-center gap-1 text-sm text-text-muted hover:text-primary transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to login
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
                    <label className="text-sm font-medium text-text-muted">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                      <input
                        {...register('email')}
                        aria-label="Email address"
                        type="email"
                        placeholder="you@example.com"
                        className={cn(
                          'w-full rounded-lg border bg-background/50 py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all',
                          errors.email ? 'border-red-500' : 'border-border'
                        )}
                      />
                    </div>
                    {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
                  </div>

                  <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? 'Sending...' : 'Send reset code'}
                  </Button>
                </form>

                <div className="text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary transition-colors"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back to Login
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
    </>
  )
}
