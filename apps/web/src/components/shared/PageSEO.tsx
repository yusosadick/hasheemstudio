import { useEffect } from 'react';

const SITE_URL = 'https://hasheemstudio.com';

export function PageSEO({
  title,
  description,
  canonicalPath,
  noIndex,
}: {
  title: string;
  description?: string;
  canonicalPath?: string;
  noIndex?: boolean;
}) {
  useEffect(() => {
    const fullTitle = `${title} | Hasheem Studio`;
    const canonicalUrl = `${SITE_URL}${canonicalPath ?? window.location.pathname}`;
    const previousTitle = document.title;
    const created: HTMLElement[] = [];

    document.title = fullTitle;

    const addMeta = (attrs: Record<string, string>) => {
      const meta = document.createElement('meta');
      Object.entries(attrs).forEach(([key, value]) => meta.setAttribute(key, value));
      document.head.append(meta);
      created.push(meta);
    };

    addMeta({ name: 'robots', content: noIndex ? 'noindex, nofollow' : 'index, follow' });
    if (description) addMeta({ name: 'description', content: description });
    addMeta({ property: 'og:title', content: fullTitle });
    if (description) addMeta({ property: 'og:description', content: description });
    addMeta({ property: 'og:url', content: canonicalUrl });
    addMeta({ property: 'og:type', content: 'website' });
    addMeta({ name: 'twitter:card', content: 'summary_large_image' });
    addMeta({ name: 'twitter:title', content: fullTitle });
    if (description) addMeta({ name: 'twitter:description', content: description });

    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = canonicalUrl;
    document.head.append(canonical);

    return () => {
      document.title = previousTitle;
      created.forEach((element) => element.remove());
      canonical.remove();
    };
  }, [title, description, canonicalPath, noIndex]);

  return null;
}
