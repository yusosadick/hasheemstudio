import { AuthBrandLink } from "./auth/AuthBrandLink";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import { supabase } from "../lib/supabase";
import { signOut, type Session } from "../lib/auth";

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
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
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

  async function logout() {
    await signOut();
    setProfileOpen(false);
    setOpen(false);
    window.location.assign("/");
  }

  const name = session ? displayName(session) : "";
  const metadata = session?.user.user_metadata as Record<string, unknown> | undefined;
  const avatarUrl = typeof metadata?.avatar_url === "string" ? metadata.avatar_url : typeof metadata?.picture === "string" ? metadata.picture : null;

  return (
    <header className="border-b border-dashed border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex min-h-[76px] max-w-6xl items-center justify-between px-4 sm:px-6">
        <AuthBrandLink gamingWordmark />

        <nav className="hidden items-center gap-10 lg:flex" aria-label="Primary">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="flex items-center gap-2 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground">
              {l.label}{l.menu && <span className="text-xs" aria-hidden="true">⌄</span>}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {session ? (
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
                <ChevronDown className="h-4 w-4 text-foreground-muted" aria-hidden="true" />
              </button>
              {profileOpen && (
                <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-surface1 shadow-2xl">
                  <a role="menuitem" href="/app/profile" onClick={() => setProfileOpen(false)} className="flex min-h-touch items-center gap-3 px-4 py-3 text-sm text-foreground transition-colors hover:bg-surface2"><UserRound className="h-4 w-4 text-foreground-muted" />My Profile</a>
                  <a role="menuitem" href="/app/settings" onClick={() => setProfileOpen(false)} className="flex min-h-touch items-center gap-3 px-4 py-3 text-sm text-foreground transition-colors hover:bg-surface2"><Settings className="h-4 w-4 text-foreground-muted" />Settings</a>
                  <div className="border-t border-border" />
                  <button role="menuitem" type="button" onClick={() => void logout()} className="flex min-h-touch w-full items-center gap-3 px-4 py-3 text-left text-sm text-danger transition-colors hover:bg-surface2"><LogOut className="h-4 w-4" />Sign out</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <a href="/login" className="hidden min-h-touch items-center px-3 font-mono text-xs font-semibold uppercase tracking-wider text-foreground-muted transition-colors hover:text-foreground sm:inline-flex">Sign in</a>
              <a href="/app/upload" className="inline-flex min-h-touch items-center rounded-md bg-foreground px-3 sm:px-6 font-mono text-xs font-semibold uppercase tracking-wider text-background transition-colors hover:bg-foreground/85">Get Started</a>
            </>
          )}
          <button type="button" className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md border border-border bg-surface1 lg:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label="Toggle menu" onClick={() => setOpen((v) => !v)}><span aria-hidden="true">{open ? "✕" : "☰"}</span></button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Primary mobile" className="flex flex-col gap-1 border-t border-border bg-background px-4 py-4 lg:hidden">
          {links.map((l) => <a key={l.href} href={l.href} className="min-h-touch rounded-md px-2 py-2 text-sm text-foreground-muted hover:bg-surface1 hover:text-foreground" onClick={() => setOpen(false)}>{l.label}</a>)}
          {session ? <>
            <a href="/app/profile" className="min-h-touch rounded-md px-2 py-2 text-sm text-foreground-muted hover:bg-surface1" onClick={() => setOpen(false)}>My Profile</a>
            <a href="/app/settings" className="min-h-touch rounded-md px-2 py-2 text-sm text-foreground-muted hover:bg-surface1" onClick={() => setOpen(false)}>Settings</a>
            <button type="button" onClick={() => void logout()} className="min-h-touch px-2 py-2 text-left text-sm text-danger">Sign out</button>
          </> : <>
            <a href="/login" className="min-h-touch rounded-md px-2 py-2 text-sm text-foreground-muted hover:bg-surface1" onClick={() => setOpen(false)}>Sign in</a>
            <a href="/app/upload" className="mt-2 inline-flex min-h-touch items-center justify-center rounded-md bg-foreground px-5 font-mono text-xs font-semibold uppercase tracking-wider text-background">Get Started</a>
          </>}
        </nav>
      )}
    </header>
  );
}
