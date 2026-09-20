// Adapted from zahorozanzibar 2fd32cf (Apache-2.0). Retains its auth operations;
// replaces booking/profile stores with Hasheem's dedicated sessions and return destination.
import { supabase } from '@/lib/supabase';
import { signIn, signOut } from '@/lib/auth';
import { AUTH_RETURN_KEY, safeReturnPath } from '@/lib/authReturn';
export function useAuth() {
  return {
    signIn, signOut,
    async signUp(email:string,password:string,fullName:string,country:string) {
      const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:fullName,country},emailRedirectTo:`${window.location.origin}/auth/callback`}});
      if(error) throw error; return data;
    },
    async checkEmailExists(email:string) {
      const {data,error}=await supabase.rpc('email_exists',{p_email:email.trim()});
      if(error) throw new Error('Could not check your email. Please try again.');
      return data===true;
    },
    async signInWithGoogle(next?:string|null) {
      try { localStorage.setItem(AUTH_RETURN_KEY,safeReturnPath(next)); } catch { /* optional */ }
      const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:`${window.location.origin}/auth/callback`}});
      if(error) throw error;
    },
    async resetPassword(email:string) {
      const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/reset-password`});
      if(error) throw error;
    },
    async verifyRecoveryCode(email:string,token:string) {
      const {data,error}=await supabase.auth.verifyOtp({email:email.trim(),token:token.trim(),type:'recovery'});
      if(error) throw error; return data;
    },
    async updatePassword(password:string) {
      const {error}=await supabase.auth.updateUser({password}); if(error) throw error;
    },
  };
}
