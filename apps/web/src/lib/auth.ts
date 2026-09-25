// Hasheem session adapter for the imported Supabase-based Zahoro auth flow.
import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';
export type { Session };
export function getSession(): Session | null {
  try {
    const session=JSON.parse(localStorage.getItem('hasheemstudio-session') ?? 'null');
    return session?.access_token && session?.user && session.expires_at * 1000 > Date.now() ? session : null;
  } catch { return null; }
}
export async function getValidSession(): Promise<Session | null> {
  const {data,error}=await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
export async function signIn(email:string,password:string) {
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error) throw error;
  return data.session;
}
export async function signOut(): Promise<void> {
  // Revoke the session everywhere; if the network/server refuses, still end it on this device so the user is never stuck signed in.
  const {error}=await supabase.auth.signOut();
  if(error) await supabase.auth.signOut({scope:'local'});
}
