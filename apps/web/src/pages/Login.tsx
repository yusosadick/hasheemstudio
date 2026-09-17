import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signIn } from "../lib/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      navigate("/app/upload");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Log in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-touch rounded-md border border-border bg-surface1 px-3 text-foreground focus-visible:outline-focusring"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-touch rounded-md border border-border bg-surface1 px-3 text-foreground focus-visible:outline-focusring"
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 inline-flex min-h-touch items-center justify-center rounded-md bg-gradient-primary px-6 text-sm font-medium text-foreground-on-accent disabled:opacity-60"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-foreground-muted">
        No account yet?{" "}
        <Link to="/signup" className="text-accent-text underline underline-offset-4">
          Sign up
        </Link>
      </p>
    </div>
  );
}
