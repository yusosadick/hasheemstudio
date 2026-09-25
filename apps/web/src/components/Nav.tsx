import { AuthBrandLink } from "./auth/AuthBrandLink";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, ChevronDown, Loader2, LogOut } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getSession, signOut, type Session } from "../lib/auth";

const links = [
  { href: "/#features", label: "Tools", menu: true },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
];

function displayName(session: Session) {
  const metadata = session.user.user_metadata as Record<string, unknown> | undefined;
  return String(metadata?.display_name ?? metadata?.full_name ?? session.user.email?.split("@")[0] ?? "Client");
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C";
}

export function Nav() {
  const [profileOpen, setProfileOpen] = useState(false);
  // Read the stored session synchronously so a signed-in visitor never sees the signed-out buttons flash first.
  const [session, setSession] = useState<Session | null>(() => getSession());
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => { if (active) setSession(data.session); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, []);

  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [signingOut, setSigningOut] = useState(false);
  const [frozen, setFrozen] = useState<Session | null>(null);
  const [toast, setToast] = useState(false);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Sign-out is animated end to end and never reloads the page: the menu stays open with a spinner while the
  // session ends (the profile chip is held until then), then the navbar cross-fades to "Sign in", the page is
  // left/remounted signed-out (App), and a confirmation toast slides in.
  async function logout() {
    if (signingOut) return;
    setFrozen(session);
    setSigningOut(true);
    const minimum = new Promise((resolve) => setTimeout(resolve, reduce ? 0 : 650));
    try { await Promise.all([signOut(), minimum]); } catch { /* signOut() already falls back to a local sign-out */ }
    setProfileOpen(false);
    setSigningOut(false);
    setFrozen(null);
    navigate("/", { replace: true });
    setToast(true);
  }

  const shown = signingOut ? frozen : session;
  const name = shown ? displayName(shown) : "";
  const metadata = shown?.user.user_metadata as Record<string, unknown> | undefined;
  const avatarUrl = typeof metadata?.avatar_url === "string" ? metadata.avatar_url : typeof metadata?.picture === "string" ? metadata.picture : null;

  return (
    <header className="relative z-40 border-b border-dashed border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex min-h-[60px] sm:min-h-[76px] max-w-6xl items-center justify-between px-4 sm:px-6">
        <AuthBrandLink />

        <nav className="hidden items-center gap-10 lg:flex" aria-label="Primary">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="flex items-center gap-2 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground">
              {l.label}{l.menu && <span className="text-xs" aria-hidden="true">⌄</span>}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <AnimatePresence mode="wait" initial={false}>
          {shown ? (
            <motion.div key="in" initial={reduce ? false : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.22 }}>
            <div ref={profileRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                aria-label={`Open profile menu for ${name}`}
                onClick={() => setProfileOpen((value) => !value)}
                className="flex min-h-touch items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface1"
              >
                {avatarUrl ? <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-surface2 font-mono text-xs text-foreground">{initials(name)}</span>}
                <span className="hidden min-w-0 sm:block"><span className="block max-w-32 truncate text-sm font-medium text-foreground">{name}</span><span className="block font-mono text-[10px] uppercase tracking-widest text-foreground-muted">Client</span></span>
                <ChevronDown className={`h-4 w-4 text-foreground-muted transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              <AnimatePresence>
                {profileOpen && (
                  <motion.div role="menu" style={{ transformOrigin: "top right" }} initial={reduce ? false : { opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.96 }} transition={{ duration: 0.16 }} className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-surface1 shadow-2xl">
                    <button role="menuitem" type="button" disabled={signingOut} onClick={() => void logout()} className="flex min-h-touch w-full items-center gap-3 px-4 py-3 text-left text-sm text-danger transition-colors hover:bg-surface2 disabled:cursor-progress disabled:opacity-80">
                      {signingOut ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LogOut className="h-4 w-4" aria-hidden="true" />}
                      {signingOut ? "Signing out…" : "Sign out"}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            </motion.div>
          ) : (
            <motion.div key="out" className="flex items-center gap-2 sm:gap-3" initial={reduce ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
              <a href="/login" className="hidden min-h-touch items-center px-3 font-mono text-xs font-semibold uppercase tracking-wider text-foreground-muted transition-colors hover:text-foreground sm:inline-flex">Sign in</a>
              <a href="/login" className="inline-flex min-h-touch items-center rounded-md border border-[#ff006e] bg-gradient-primary px-4 sm:px-6 whitespace-nowrap font-mono text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-white shadow-[0_6px_18px_rgba(255,0,110,0.25)] transition hover:brightness-110">Get Started</a>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div role="status" aria-live="polite" initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={{ duration: 0.25 }} className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
            <span className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-surface1 px-4 py-2.5 text-sm shadow-2xl"><CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />You’ve been signed out</span>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
