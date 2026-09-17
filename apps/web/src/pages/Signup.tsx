import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signUp } from "../lib/auth";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await signUp(email, password);
      // Real, server-confirmed distinction — never assume signup means logged in. See the note on
      // signUp() in lib/auth.ts for why this check exists.
      if ("requiresConfirmation" in result) {
        setConfirmationSent(true);
      } else {
        navigate("/app/upload");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  if (confirmationSent) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          We sent a confirmation link to <span className="text-foreground">{email}</span>. Click it
          to activate your account, then{" "}
          <Link to="/login" className="text-accent-text underline underline-offset-4">
            log in
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-2 text-sm text-foreground-muted">
        Verified Free plan: 100&nbsp;MB/file, 2 minutes, 3 jobs/day. No card required.
      </p>
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
            minLength={8}
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
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-sm text-foreground-muted">
        Already have an account?{" "}
        <Link to="/login" className="text-accent-text underline underline-offset-4">
          Log in
        </Link>
      </p>
    </div>
  );
}
