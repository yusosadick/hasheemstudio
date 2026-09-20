import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { completeAuth } from '@/lib/completeAuth';
import { authReturnPath } from '@/lib/authReturn';
import { Button } from '@/components/ui/button';
import { PageSEO } from '@/components/shared/PageSEO';

export default function VerifyEmailPage() {
  const [email,setEmail]=useState(()=>sessionStorage.getItem('hasheemstudio-verification-email')??'');
  const [code,setCode]=useState('');
  const [status,setStatus]=useState<'loading'|'entry'|'success'>('loading');
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{let active=true;void completeAuth().then(()=>{if(active)setStatus('success')}).catch(()=>{if(active)setStatus('entry')});return()=>{active=false}},[]);
  async function verify(e:FormEvent) {
    e.preventDefault();if(pending)return;setError('');
    if(!/^\d{6}$/.test(code)){setError('Enter the six-digit code from your email.');return;}
    setPending(true);
    try {
      const {data,error}=await supabase.auth.verifyOtp({email:email.trim(),token:code,type:'signup'});
      if(error||!data.session)throw new Error();
      await completeAuth(); sessionStorage.removeItem('hasheemstudio-verification-email');setCode('');setStatus('success');
    } catch {setCode('');setError('That code is invalid, expired or already used. Request a new code.');}
    finally{setPending(false)}
  }
  async function resend() {
    if(pending||!email.trim())return;setPending(true);setError('');
    try {const {error}=await supabase.auth.resend({type:'signup',email:email.trim(),options:{emailRedirectTo:`${window.location.origin}/auth/callback`}});if(error)throw error;setError('If this address needs verification, a new code has been requested.');}
    catch{setError('Could not request a code. Wait a moment and try again.');}finally{setPending(false)}
  }
  return <><PageSEO title="Verify email" canonicalPath="/verify-email" noIndex />
    <h1 className="text-3xl font-bold">{status==='success'?'Email Verified!':'Verify your email'}</h1>
    {status==='loading'?<p role="status" className="mt-4">Checking your session…</p>:status==='success'?<div className="mt-6 space-y-4"><p>Your email is confirmed. Your prepared video is waiting.</p><Button asChild className="w-full"><Link to={authReturnPath()}>Return to your video</Link></Button></div>:<form onSubmit={verify} className="mt-6 space-y-4">
      <p className="text-foreground-muted">Enter the six-digit code sent to your email. Never share it.</p>
      <label className="block">Email address<input aria-label="Email address" required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background p-3" /></label>
      <label className="block">Confirmation code<input aria-label="Confirmation code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/[^0-9]/g,''))} className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-center text-xl tracking-widest" /></label>
      {error&&<p role="alert" className="text-sm text-foreground-muted">{error}</p>}
      <Button disabled={pending} type="submit" className="w-full">{pending?'Verifying…':'Verify email'}</Button>
      <button disabled={pending} type="button" onClick={()=>void resend()} className="min-h-touch text-sm underline">Request a new code</button>
    </form>}</>;
}
