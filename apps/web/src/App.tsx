import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { LandingAuthShell } from "./components/auth/LandingAuthShell";
import { Nav } from "./components/Nav";

export default function App() {
  const { pathname } = useLocation();
  // Bumps on every sign-out (this tab or another) so the current page remounts with fresh, signed-out state.
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;
      // Forget the remembered video too, so the freshly mounted homepage is genuinely reset (not the same result again).
      try { localStorage.removeItem("hasheemstudio-last-job"); } catch { /* optional */ }
      setEpoch((n) => n + 1);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (["/login", "/signup", "/register", "/forgot-password", "/reset-password", "/verify-email", "/auth/callback"].includes(pathname)) return <LandingAuthShell><Outlet key={epoch} /></LandingAuthShell>;
  return (
    <div className="min-h-screen bg-background text-foreground sm:px-5 sm:py-5">
      <div className="relative mx-auto min-h-[calc(100vh-2.5rem)] max-w-[1480px] overflow-hidden border-border sm:border">
        <div
          aria-hidden="true"
          className="page-guides pointer-events-none absolute inset-y-0 left-1/2 z-0 hidden -translate-x-1/2 lg:block"
        />
        <div className="relative z-10">
          <Nav />
          <main>
            <Outlet key={epoch} />
          </main>
        </div>
      </div>
    </div>
  );
}
