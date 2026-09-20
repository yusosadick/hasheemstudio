// Adapted from yusosadick/zahorozanzibar @ 2fd32cf (Apache-2.0).
// Modified for Hasheem Studio branding, sessions, redirect safety, and verification.
// See third_party/zahorozanzibar/README.md and LICENSE.
import { useEffect, useState } from 'react'
import { completeAuth } from '@/lib/completeAuth'
import { authReturnPath } from '@/lib/authReturn'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageSEO } from '@/components/shared/PageSEO'

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    let cancelled=false
    void completeAuth().then(()=>{if(!cancelled)setStatus('success')}).catch(()=>{if(!cancelled)setStatus('error')})
    return ()=>{cancelled=true}
  }, [])

  return (
    <>
      <PageSEO
        title="Verify email"
        description="Confirm your email address for your Hasheem Studio account."
        canonicalPath="/verify-email"
        noIndex
      />
    <div data-public-dark="true" className="relative w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >


        <Card className="border-0 bg-transparent shadow-none">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            {status === 'loading' && (
              <>
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <div>
                  <h2 className="font-heading text-2xl font-bold text-text mb-2">
                    Verifying Your Email
                  </h2>
                  <p className="text-text-muted">Please wait while we confirm your email address...</p>
                </div>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-400" />
                </div>
                <div>
                  <h2 className="font-heading text-2xl font-bold text-text mb-2">
                    Email Verified!
                  </h2>
                  <p className="text-text-muted">
                    Your email has been successfully verified. You can now sign in to your account and download your video.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <Link to="/login">
                    <Button className="w-full" size="lg">
                      Sign In to Your Account
                    </Button>
                  </Link>
                  <Link to={authReturnPath()}>
                    <Button variant="outline" className="w-full">
                      Return to your video
                    </Button>
                  </Link>
                </div>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="mx-auto w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-red-400" />
                </div>
                <div>
                  <h2 className="font-heading text-2xl font-bold text-text mb-2">
                    Verification Failed
                  </h2>
                  <p className="text-text-muted">
                    The verification link may have expired or is invalid. Please request a new verification email.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <Link to="/login">
                    <Button className="w-full" size="lg">
                      Go to Login
                    </Button>
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
