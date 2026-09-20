import { supabase, exchangeCodeOnce } from './supabase';
let completion: Promise<void> | null = null;
export function completeAuth(): Promise<void> {
  if (completion) return completion;
  completion=(async()=>{
    const url=new URL(window.location.href);
    const hash=new URLSearchParams(url.hash.slice(1));
    const error=url.searchParams.get('error_description') ?? hash.get('error_description');
    const access=hash.get('access_token'), refresh=hash.get('refresh_token'), code=url.searchParams.get('code');
    window.history.replaceState(null,'',url.pathname);
    if(error) throw new Error(error);
    if(code){const result=await exchangeCodeOnce(code);if(result.error)throw result.error;}
    else if(access&&refresh){const result=await supabase.auth.setSession({access_token:access,refresh_token:refresh});if(result.error)throw result.error;}
    const {data,error:verifyError}=await supabase.auth.getUser();
    if(verifyError||!data.user?.email_confirmed_at) throw new Error('This link is invalid or has expired. Please sign in or request a new link.');
  })().finally(() => { completion = null; });
  // Only deduplicate in-flight effects. Future visits must verify the current user again.
  return completion;
}
