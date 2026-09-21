import { AuthBrandLink } from "./auth/AuthBrandLink";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { signOut, type Session } from "../lib/auth";

const links = [
  { href: "/#features", label: "Tools", menu: true },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({data}) => { if(active) setSession(data.session); });
    const {data}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));
    return () => { active=false; data.subscription.unsubscribe(); };
  }, []);
  async function logout() { await signOut(); setOpen(false); window.location.assign("/"); }

  return (
    <header className="border-b border-dashed border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex min-h-[76px] max-w-6xl items-center justify-between px-4 sm:px-6">
        <AuthBrandLink gamingWordmark />

        <nav className="hidden items-center gap-10 lg:flex" aria-label="Primary">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="flex items-center gap-2 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
            >
              {l.label}
              {l.menu && <span className="text-xs" aria-hidden="true">⌄</span>}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {session ? <button type="button" onClick={() => void logout()} className="hidden min-h-touch px-3 font-mono text-xs sm:inline-flex sm:items-center">Log out</button> : <a href="/login" className="hidden min-h-touch items-center px-3 font-mono text-xs font-semibold uppercase tracking-wider text-foreground-muted transition-colors hover:text-foreground sm:inline-flex">
            Sign in
          </a>}
          <a
            href={session ? "/app/upload" : "/app/upload"}
            className="inline-flex min-h-touch items-center rounded-md bg-foreground px-3 sm:px-6 font-mono text-xs font-semibold uppercase tracking-wider text-background transition-colors hover:bg-foreground/85"
          >
            {session ? "Open workspace" : "Get Started"}
          </a>
          <button
            type="button"
            className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md border border-border bg-surface1 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span aria-hidden="true">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Primary mobile"
          className="flex flex-col gap-1 border-t border-border bg-background px-4 py-4 lg:hidden"
        >
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="min-h-touch rounded-md px-2 py-2 text-sm text-foreground-muted hover:bg-surface1 hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          {session ? <button type="button" onClick={() => void logout()} className="min-h-touch px-2 py-2 text-left text-sm">Log out</button> : <a href="/login" className="min-h-touch rounded-md px-2 py-2 text-sm text-foreground-muted hover:bg-surface1 hover:text-foreground" onClick={() => setOpen(false)}>
            Sign in
          </a>}
          <a
            href="/app/upload"
            className="mt-2 inline-flex min-h-touch items-center justify-center rounded-md bg-foreground px-5 font-mono text-xs font-semibold uppercase tracking-wider text-background"
          >
            {session ? "Open workspace" : "Get Started"}
          </a>
        </nav>
      )}
    </header>
  );
}
