// Adapted from zahorozanzibar 2fd32cf (Apache-2.0): dedicated Hasheem config, no demo credentials.
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { flowType:'pkce', detectSessionInUrl:false, persistSession:true, autoRefreshToken:true, storageKey:'hasheemstudio-session' },
});
// Share exchanges across StrictMode effect re-runs; a one-time code must only be spent once.
const exchanges = new Map<string, ReturnType<typeof supabase.auth.exchangeCodeForSession>>();
export function exchangeCodeOnce(code:string) {
  let request = exchanges.get(code);
  if (!request) { request=supabase.auth.exchangeCodeForSession(code); exchanges.set(code,request); }
  return request;
}
