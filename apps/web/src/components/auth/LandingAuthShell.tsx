import { useState, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { Nav } from "../Nav";
import { HeroBackdrop } from "../HeroBackdrop";
import "../ConversionHero.css";

/** Public landing frame, shared by every authentication route. */
export function LandingAuthShell({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false);
  return <MotionConfig reducedMotion="user"><div data-public-dark="true" className="min-h-screen bg-background text-foreground sm:p-5">
    <div className="relative mx-auto min-h-[calc(100vh-2.5rem)] max-w-[1480px] overflow-hidden border-border sm:border">
      <Nav />
      <main className="relative isolate min-h-[calc(100vh-8rem)] px-4 py-12 sm:px-6 sm:py-16">
        <HeroBackdrop paused={paused} />
        <div className="relative mx-auto max-w-md">
          <p className="mb-6 text-center font-mono text-xs uppercase tracking-widest text-foreground-muted">Your video. Ready for what’s next.</p>
          <div className="h-1 rounded-t-xl bg-gradient-primary" />
          <div className="rounded-b-xl border border-t-0 border-border bg-surface1 p-6 sm:p-8">
            <div className="mb-6 flex justify-center" aria-label="Hasheem Studio brand">
              <img src="/images/brand/hasheem-studio-script-wordmark.webp" alt="Hasheem Studio" className="h-14 w-auto object-contain" />
            </div>
            {children}
          </div>
          <button type="button" className="mx-auto mt-6 block min-h-touch text-xs text-foreground-muted" onClick={() => setPaused(!paused)}>{paused ? "Play" : "Pause"} background animation</button>
        </div>
      </main>
    </div>
  </div></MotionConfig>;
}
