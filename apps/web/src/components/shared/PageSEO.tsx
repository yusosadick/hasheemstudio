import { useEffect } from 'react';

const SITE_URL = 'https://hasheemstudio.com';
const DEFAULT_IMAGE = `${SITE_URL}/images/brand/og-image.jpg`;

type Restore = () => void;

// Updates the tag that already exists in index.html (or creates it) and puts the old value back on unmount,
// so a page never leaves duplicate <meta> tags behind for crawlers to disagree about.
function setTag(tag: 'meta' | 'link', match: Record<string, string>, set: Record<string, string>): Restore {
  const selector = `${tag}${Object.entries(match).map(([k, v]) => `[${k}="${v}"]`).join('')}`;
  let el = document.head.querySelector<HTMLElement>(selector);
  const created = !el;
  const previous: Record<string, string | null> = {};
  if (!el) {
    el = document.createElement(tag);
    Object.entries(match).forEach(([k, v]) => el!.setAttribute(k, v));
    document.head.append(el);
  }
  for (const [k, v] of Object.entries(set)) { previous[k] = el.getAttribute(k); el.setAttribute(k, v); }
  const node = el;
  return () => {
    if (created) node.remove();
    else for (const [k, v] of Object.entries(previous)) v === null ? node.removeAttribute(k) : node.setAttribute(k, v);
  };
}

export function PageSEO({
  title,
  description,
  canonicalPath,
  noIndex,
  image = DEFAULT_IMAGE,
  jsonLd,
}: {
  title: string;
  description?: string;
  canonicalPath?: string;
  noIndex?: boolean;
  image?: string;
  jsonLd?: Record<string, unknown>;
}) {
  useEffect(() => {
    const fullTitle = title.includes('Hasheem Studio') ? title : `${title} | Hasheem Studio`;
    const canonicalUrl = `${SITE_URL}${canonicalPath ?? window.location.pathname}`;
    const previousTitle = document.title;
    document.title = fullTitle;

    const undo: Restore[] = [
      setTag('meta', { name: 'robots' }, { content: noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' }),
      setTag('link', { rel: 'canonical' }, { href: canonicalUrl }),
      setTag('meta', { property: 'og:title' }, { content: fullTitle }),
      setTag('meta', { property: 'og:url' }, { content: canonicalUrl }),
      setTag('meta', { property: 'og:type' }, { content: 'website' }),
      setTag('meta', { property: 'og:image' }, { content: image }),
      setTag('meta', { name: 'twitter:card' }, { content: 'summary_large_image' }),
      setTag('meta', { name: 'twitter:title' }, { content: fullTitle }),
      setTag('meta', { name: 'twitter:image' }, { content: image }),
    ];
    if (description) {
      undo.push(
        setTag('meta', { name: 'description' }, { content: description }),
        setTag('meta', { property: 'og:description' }, { content: description }),
        setTag('meta', { name: 'twitter:description' }, { content: description }),
      );
    }
    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.pageSeo = 'true';
      script.textContent = JSON.stringify(jsonLd);
      document.head.append(script);
    }
    return () => {
      document.title = previousTitle;
      undo.reverse().forEach((fn) => fn());
      script?.remove();
    };
  }, [title, description, canonicalPath, noIndex, image, jsonLd]);

  return null;
}
