import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getValidSession, type Session } from '@/lib/auth';
import { PageSEO } from '@/components/shared/PageSEO';

export default function AccountPage() {
  const { section = 'profile' } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    void getValidSession().then((value) => {
      if (!value) navigate(`/login?next=/app/${section}`, { replace: true });
      else setSession(value);
    }).catch(() => navigate(`/login?next=/app/${section}`, { replace: true }));
  }, [navigate, section]);

  if (!session) return <div className="mx-auto max-w-3xl px-4 py-16 text-sm text-foreground-muted">Loading your account…</div>;

  const metadata = session.user.user_metadata as Record<string, unknown> | undefined;
  const name = String(metadata?.display_name ?? metadata?.full_name ?? session.user.email ?? 'Client');
  const isSettings = section === 'settings';

  return (
    <>
      <PageSEO title={isSettings ? 'Settings' : 'My Profile'} description="Manage your Hasheem Studio account." canonicalPath={`/app/${section}`} noIndex />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-widest text-foreground-muted">Client account</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{isSettings ? 'Settings' : 'My Profile'}</h1>
        <div className="mt-8 rounded-xl border border-border bg-surface1 p-6">
          {isSettings ? <p className="text-sm text-foreground-muted">Account preferences and security controls will appear here. Your session and privacy settings remain protected by Hasheem Studio.</p> : <><p className="text-lg font-medium">{name}</p><p className="mt-2 text-sm text-foreground-muted">{session.user.email}</p></>}
        </div>
      </div>
    </>
  );
}
