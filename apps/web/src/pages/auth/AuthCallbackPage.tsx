// Adapted from zahorozanzibar 2fd32cf (Apache-2.0). Uses Hasheem session/return adapters.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { PageSEO } from '@/components/shared/PageSEO';
import { completeAuth } from '@/lib/completeAuth';
import { authReturnPath } from '@/lib/authReturn';
export default function AuthCallbackPage() {
 const navigate=useNavigate();const [error,setError]=useState<string|null>(null);
 useEffect(()=>{let cancelled=false;void completeAuth().then(()=>{if(!cancelled)navigate(authReturnPath(),{replace:true});}).catch(err=>{if(!cancelled)setError(err instanceof Error?err.message:'Sign-in failed.');});return()=>{cancelled=true;};},[navigate]);
 return <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"><PageSEO title="Completing sign-in" noIndex />{error?<><p role="alert">{error}</p><Link className="text-primary underline" to="/login">Back to sign in</Link></>:<><Loader2 className="animate-spin"/><p>Completing sign-in…</p></>}</div>;
}
