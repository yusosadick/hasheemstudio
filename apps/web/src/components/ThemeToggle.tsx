import { useEffect, useState } from "react";
import { IconSun, IconMoon } from "./Icons";

type Theme = "light" | "dark";

function readInitialTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" ? "light" : "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("hasheemstudio-theme", theme);
    } catch {
      // Private browsing / blocked storage: theme still applies for this load, just not persisted.
    }
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md border border-border text-foreground-muted transition-colors hover:text-foreground focus-visible:outline-focusring"
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    >
      {theme === "dark" ? <IconSun /> : <IconMoon />}
    </button>
  );
}
