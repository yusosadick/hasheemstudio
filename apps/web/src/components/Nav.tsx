import { Link } from "react-router-dom";
import { useState } from "react";
import { IconFilm } from "./Icons";

const links = [
  { href: "/#features", label: "Tools", menu: true },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-dashed border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex min-h-[76px] max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3 text-xl font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center border border-border bg-surface1">
            <IconFilm className="text-accent" width={20} height={20} />
          </span>
          <span>Hasheem Studio</span>
        </Link>

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

        <div className="flex items-center gap-3">
          <a href="/login" className="hidden min-h-touch items-center px-3 font-mono text-xs font-semibold uppercase tracking-wider text-foreground-muted transition-colors hover:text-foreground sm:inline-flex">
            Log in
          </a>
          <a
            href="/signup"
            className="hidden min-h-touch items-center rounded-md bg-foreground px-6 font-mono text-xs font-semibold uppercase tracking-wider text-background transition-colors hover:bg-foreground/85 sm:inline-flex"
          >
            Start free
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
          <a href="/login" className="min-h-touch rounded-md px-2 py-2 text-sm text-foreground-muted hover:bg-surface1 hover:text-foreground" onClick={() => setOpen(false)}>
            Log in
          </a>
          <a
            href="/signup"
            className="mt-2 inline-flex min-h-touch items-center justify-center rounded-md bg-foreground px-5 font-mono text-xs font-semibold uppercase tracking-wider text-background"
          >
            Start free
          </a>
        </nav>
      )}
    </header>
  );
}
