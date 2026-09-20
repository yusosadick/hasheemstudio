import { useEffect } from 'react';
export function PageSEO({title, noIndex}: {title:string; description?:string; canonicalPath?:string; noIndex?:boolean}) {
  useEffect(() => {
    const previous = document.title; document.title = `${title} | Hasheem Studio`;
    const meta = document.createElement('meta'); meta.name='robots'; meta.content=noIndex ? 'noindex, nofollow' : 'index, follow'; document.head.append(meta);
    return () => { document.title = previous; meta.remove(); };
  },[title,noIndex]);
  return null;
}
