// Adapted from yusosadick/zahorozanzibar @ 2fd32cf (Apache-2.0).
// Modified for Hasheem Studio branding, sessions, redirect safety, and verification.
// See third_party/zahorozanzibar/README.md and LICENSE.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Globe, Lock, Mail, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { authHeroSrc } from '@/lib/authHero'
import { PageSEO } from '@/components/shared/PageSEO'
import { AuthBrandLink } from '@/components/auth/AuthBrandLink'
import { AUTH_RETURN_KEY, safeReturnPath } from '@/lib/authReturn'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const countries = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France',
  'Kenya', 'Tanzania', 'Uganda', 'South Africa', 'Nigeria', 'India', 'China',
  'Japan', 'Brazil', 'Mexico', 'Italy', 'Spain', 'Netherlands', 'Sweden',
  'Norway', 'Denmark', 'Switzerland', 'New Zealand', 'Other',
]

type Step = 'email' | 'password' | 'signup'

/**
 * Single progressive auth page. Three states:
 *  - email:    just an email input + Continue + Continue with Google
 *  - password: existing account → ask password (sign in)
 *  - signup:   new email → ask name + password + country (create account)
 *
 * The split between password/signup is decided by `checkEmailExists`
 * which calls the rate-limited `email_exists` RPC. The lookup is
 * deliberately tolerant: on rate-limit / failure we fall back to the
 * signup path, which never blocks the user (signup against an existing
 * email returns a clean "email already in use" error from Supabase
 * that we surface in the UI).
 */
export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const nextPath = searchParams.get('next')

  const { signIn, signUp, signInWithGoogle, checkEmailExists } = useAuth()
  const [confirmation, setConfirmation] = useState(false)
  const [googleAvailable, setGoogleAvailable] = useState(false)
  useEffect(() => { let active=true; void fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {headers:{apikey:import.meta.env.VITE_SUPABASE_ANON_KEY}}).then(r=>r.json()).then(settings=>{if(active)setGoogleAvailable(settings.external?.google===true)}).catch(()=>{}); return ()=>{active=false}; },[])
  useEffect(() => { if (nextPath) { try { localStorage.setItem(AUTH_RETURN_KEY, safeReturnPath(nextPath)) } catch { /* optional */ } } }, [nextPath])

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [country, setCountry] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const passwordInputRef = useRef<HTMLInputElement | null>(null)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  // Auto-focus the right field as we move between steps.
  useEffect(() => {
    if (step === 'password') passwordInputRef.current?.focus()
    if (step === 'signup') nameInputRef.current?.focus()
  }, [step])

  const navigateAfterAuth = useCallback(() => {
    let stored: string | null = null
    try { stored = localStorage.getItem(AUTH_RETURN_KEY) } catch { /* optional storage */ }
    navigate(safeReturnPath(nextPath ?? stored))
  }, [navigate, nextPath])

  // ── Step 1: email → decide path ───────────────────────────────────
  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const candidate = email.trim()
    if (!EMAIL_RE.test(candidate)) {
      setError('Please enter a valid email address.')
      return
    }
    setPending(true)
    try {
      const exists = await checkEmailExists(candidate)
      setStep(exists ? 'password' : 'signup')
    } catch (err) { setError(err instanceof Error ? err.message : 'Please try again.') } finally {
      setPending(false)
    }
  }

  // ── Step 2a: password (existing user) ─────────────────────────────
  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setPending(true)
    try {
      await signIn(email.trim(), password)
      navigateAfterAuth()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in. Check your password and try again.')
    } finally {
      setPending(false)
    }
  }

  // ── Step 2b: signup (new user) ────────────────────────────────────
  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (fullName.trim().length < 2) { setError('Please enter your full name.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Use at least one uppercase letter and one number.')
      return
    }
    if (!country) { setError('Please select your country.'); return }

    setPending(true)
    try {
      const result = await signUp(email.trim(), password, fullName.trim(), country)
      if (result?.session) {
        navigateAfterAuth()
        return
      }
      // Email confirmation required — surface a friendly success.
      setStep('email')
      setConfirmation(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account. Please try again.')
    } finally {
      setPending(false)
    }
  }

  const onGoogle = async () => {
    setError(null)
    try {
      await signInWithGoogle(nextPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.')
    }
  }

  const backToEmail = () => {
    setError(null)
    setPassword('')
    setFullName('')
    setCountry('')
    setShowPassword(false)
    setStep('email')
  }

  return (
    <>
      <PageSEO
        title={step === 'signup' ? 'Create your account' : 'Sign in'}
        description="Sign in or create your Hasheem Studio account to download your prepared video."
        canonicalPath="/login"
        noIndex
      />
      <div data-public-dark="true" className="flex min-h-screen bg-background">
        {/* Left: progressive form */}
        <div className="flex w-full flex-col justify-center px-8 py-10 md:w-1/2 md:px-16 lg:px-24">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="mx-auto w-full max-w-md"
          >
            <AuthBrandLink className="mb-10" />

            {/* Heading + chrome */}
            <AnimatePresence mode="wait" initial={false}>
              {step === 'email' && (
                <motion.header
                  key="h-email"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                >
                  <h1 className="font-heading text-3xl font-bold text-text">Welcome to Hasheem Studio</h1>
                  <p className="mt-2 text-text-muted">Sign in or create your account in seconds.</p>
                </motion.header>
              )}
              {step === 'password' && (
                <motion.header
                  key="h-pwd"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                >
                  <h1 className="font-heading text-3xl font-bold text-text">Welcome back</h1>
                  <button
                    type="button"
                    onClick={backToEmail}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
                  >
                    <span className="truncate max-w-[220px]">{email}</span>
                    <span className="text-primary">change</span>
                  </button>
                </motion.header>
              )}
              {step === 'signup' && (
                <motion.header
                  key="h-signup"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                >
                  <h1 className="font-heading text-3xl font-bold text-text">Create your account</h1>
                  <button
                    type="button"
                    onClick={backToEmail}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
                  >
                    <span className="truncate max-w-[220px]">{email}</span>
                    <span className="text-primary">change</span>
                  </button>
                </motion.header>
              )}
            </AnimatePresence>

            {confirmation && <p role="status" className="mt-6 rounded-xl border border-border bg-surface1 p-4 text-sm">Check your email to verify your account, then sign in here. Your processed video is saved.</p>}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400"
              >
                {error}
              </motion.div>
            )}

            {/* Bodies */}
            <AnimatePresence mode="wait" initial={false}>
              {step === 'email' && (
                <motion.form
                  key="f-email"
                  onSubmit={submitEmail}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                  className="mt-8 space-y-4"
                >
                  <Field icon={Mail}>
                    <input
                      type="email"
                      aria-label="Email address" required
                      autoComplete="email"
                      autoFocus
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={fieldInputClass}
                    />
                  </Field>

                  <Button type="submit" disabled={pending} className="w-full rounded-xl" size="lg">
                    {pending ? 'Checking…' : (<span className="inline-flex items-center gap-1.5">Continue <ArrowRight className="h-4 w-4" /></span>)}
                  </Button>

                  <div className="my-2 flex items-center gap-3 text-[11px] uppercase tracking-wider text-text-muted/70">
                    <span className="h-px flex-1 bg-border" />
                    or
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <button
                    type="button"
                    onClick={onGoogle}
                    disabled={!googleAvailable}
                    title={googleAvailable ? undefined : "Google sign-in is not configured yet"}
                    className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-[#1f2937] transition-colors hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <GoogleMark />
                    {googleAvailable ? "Continue with Google" : "Google sign-in unavailable"}
                  </button>

                  <p className="pt-2 text-center text-xs text-text-muted">1 free video download per day · up to 100 MB</p>
                </motion.form>
              )}

              {step === 'password' && (
                <motion.form
                  key="f-pwd"
                  onSubmit={submitPassword}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                  className="mt-8 space-y-4"
                >
                  <Field icon={Lock}>
                    <input
                      ref={passwordInputRef}
                      type={showPassword ? 'text' : 'password'}
                      aria-label="Password" required autoComplete="current-password"
                      placeholder="Your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={cn(fieldInputClass, 'pr-11')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </Field>

                  <Button type="submit" disabled={pending} className="w-full rounded-xl" size="lg">
                    {pending ? 'Signing in…' : 'Sign in'}
                  </Button>

                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={backToEmail}
                      className="inline-flex items-center gap-1 text-text-muted hover:text-text transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" /> Use a different email
                    </button>
                    <Link to={`/forgot-password?next=${encodeURIComponent(safeReturnPath(nextPath))}`} className="font-semibold text-primary hover:text-primary-dark">
                      Forgot password?
                    </Link>
                  </div>
                </motion.form>
              )}

              {step === 'signup' && (
                <motion.form
                  key="f-signup"
                  onSubmit={submitSignup}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                  className="mt-8 space-y-4"
                >
                  <Field icon={User}>
                    <input
                      ref={nameInputRef}
                      type="text"
                      aria-label="Full name" required autoComplete="name"
                      placeholder="Full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={fieldInputClass}
                    />
                  </Field>

                  <Field icon={Lock}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      aria-label="Create password" required autoComplete="new-password"
                      placeholder="Min 8 chars, 1 uppercase, 1 number"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={cn(fieldInputClass, 'pr-11')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </Field>

                  <Field icon={Globe}>
                    <select aria-label="Country" required
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className={cn(fieldInputClass, 'appearance-none')}
                    >
                      <option value="">Select your country</option>
                      {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>

                  <Button type="submit" disabled={pending} className="w-full rounded-xl" size="lg">
                    {pending ? 'Creating account…' : 'Create account'}
                  </Button>

                  <button
                    type="button"
                    onClick={backToEmail}
                    className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" /> Use a different email
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Right: decorative image (preserves the existing two-column layout) */}
        <div className="relative hidden md:block md:w-1/2">
          <img
            src={authHeroSrc(step === 'signup' ? 'register' : 'login')}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            width={1200}
            height={1600}
            decoding="async"
          />
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute bottom-12 left-12 right-12">
            <div className="rounded-2xl bg-black/40 p-8 backdrop-blur-sm">
              <p className="font-heading text-2xl font-bold text-white">Your video. Ready for its next destination.</p>
              <p className="mt-3 text-sm text-white/70">Upload, prepare, and verify. Sign in when you’re ready to download.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Small UI helpers (kept local — none of these are reused elsewhere) ──

const fieldInputClass =
  'w-full rounded-xl border border-border bg-surface py-3 pl-11 pr-4 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50'

function Field({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
        {children}
      </div>
    </div>
  )
}

function GoogleMark() {
  // Inline Google brand mark (avoids an extra network round trip for an icon).
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#EA4335" d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z" />
      <path fill="#4285F4" d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#FBBC05" d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.97 13.04C2.45 15.98 5.48 18 9 18z" />
    </svg>
  )
}
