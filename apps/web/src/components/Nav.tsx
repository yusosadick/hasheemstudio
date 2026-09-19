import { Link } from "react-router-dom";
import { useState } from "react";
import { IconFilm } from "./Icons";

const links = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#features", label: "Why Hasheem" },
  { href: "/#pricing", label: "Pricing" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <IconFilm className="text-accent" />
          Hasheem Studio
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-foreground-muted transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a href="/login" className="hidden min-h-touch items-center px-2 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground sm:inline-flex">
            Log in
          </a>
          <a
            href="/signup"
            className="hidden min-h-touch items-center rounded-md bg-gradient-primary px-5 text-sm font-medium text-foreground-on-accent shadow-sm transition-opacity hover:opacity-90 sm:inline-flex"
          >
            Start for free
          </a>
          <button
            type="button"
            className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md border border-border md:hidden"
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
          className="flex flex-col gap-1 border-t border-border px-4 py-3 md:hidden"
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
          <a href="/login" className="min-h-touch rounded-md px-2 py-2 text-sm text-foreground-muted hover:bg-surface1 hover:text-foreground" onClick={() => setOpen(false)}>
            Log in
          </a>
          <a
            href="/signup"
            className="mt-2 inline-flex min-h-touch items-center justify-center rounded-md bg-gradient-primary px-5 text-sm font-medium text-foreground-on-accent"
          >
            Start for free
          </a>
        </nav>
      )}
    </header>
  );
}
