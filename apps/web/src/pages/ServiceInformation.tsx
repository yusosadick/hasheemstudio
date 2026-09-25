import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { PageSEO } from '@/components/shared/PageSEO';
import { LEGAL, SUPPORT_EMAIL } from '../content/legal.mjs';

function linkify(text: string) {
  return text.split(SUPPORT_EMAIL).flatMap((part, i, all) => i < all.length - 1
    ? [part, <a key={i} href={`mailto:${SUPPORT_EMAIL}`} className="text-accent-text underline underline-offset-2">{SUPPORT_EMAIL}</a>]
    : [part]).map((n, i) => <Fragment key={i}>{n}</Fragment>);
}

export default function ServiceInformation({ kind }: { kind: 'privacy' | 'terms' }) {
  const doc = LEGAL[kind];
  const other = kind === 'privacy' ? { to: '/terms', label: 'Terms of Service' } : { to: '/privacy', label: 'Privacy Policy' };
  return (
    <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6">
      <PageSEO
        title={doc.title}
        description={doc.description}
        canonicalPath={`/${kind}`}
        jsonLd={{
          '@context': 'https://schema.org', '@type': 'WebPage', name: `${doc.title} | Hasheem Studio`, description: doc.description,
          url: `https://hasheemstudio.com/${kind}`, inLanguage: 'en', isPartOf: { '@type': 'WebSite', name: 'Hasheem Studio', url: 'https://hasheemstudio.com/' },
        }}
      />
      <div className="grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav aria-label="On this page" className="sticky top-8 text-sm">
            <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-widest text-foreground-muted">On this page</p>
            <ol className="space-y-1.5 border-l border-border">
              {doc.sections.map((s) => (
                <li key={s.id}><a href={`#${s.id}`} className="-ml-px block border-l border-transparent py-0.5 pl-3 text-foreground-muted transition-colors hover:border-accent hover:text-foreground">{s.title.replace(/^\d+\.\s*/, '')}</a></li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-accent-text">Legal</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">{doc.title}</h1>
          <p className="mt-3 text-sm text-foreground-muted">Last updated: {doc.updated} · <Link to={other.to} className="underline underline-offset-2 hover:text-foreground">{other.label}</Link></p>
          <div className="mt-6 space-y-4 text-[15px] leading-7 text-foreground-muted">
            {doc.intro.map((p, i) => <p key={i}>{linkify(p)}</p>)}
          </div>
          {doc.sections.map((s) => (
            <section key={s.id} id={s.id} className="mt-10 scroll-mt-8 border-t border-border pt-8">
              <h2 className="text-xl font-semibold tracking-tight">{s.title}</h2>
              <div className="mt-4 space-y-4 text-[15px] leading-7 text-foreground-muted">
                {s.body.map((b, i) => typeof b === 'string'
                  ? <p key={i}>{linkify(b)}</p>
                  : <ul key={i} className="list-disc space-y-2 pl-5 marker:text-accent">{b.list.map((li, j) => <li key={j}>{linkify(li)}</li>)}</ul>)}
              </div>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
