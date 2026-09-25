import { Link } from 'react-router-dom';
import { PageSEO } from '@/components/shared/PageSEO';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <PageSEO title="Page not found" noIndex />
      <p className="font-mono text-xs font-semibold uppercase tracking-widest text-accent-text">Error 404</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">This page doesn’t exist</h1>
      <p className="mt-3 text-foreground-muted">The link may be old or mistyped. You can head back and prepare a video.</p>
      <Link to="/" className="mt-8 inline-flex min-h-touch items-center rounded-md bg-gradient-primary px-6 text-sm font-semibold text-foreground-on-accent">Back to home</Link>
    </div>
  );
}
