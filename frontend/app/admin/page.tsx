'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '@/components/DashboardShell';
import { api } from '@/lib/api';

export default function AdminPage() {
  const router = useRouter();
  const [gate, setGate] = useState<'loading' | 'ok' | 'forbidden' | 'auth'>('loading');
  const [builtin, setBuiltin] = useState<string[]>([]);
  const [admins, setAdmins] = useState<string[]>([]);
  const [additionalText, setAdditionalText] = useState('');
  const [effective, setEffective] = useState<string[]>([]);
  const [smtpOk, setSmtpOk] = useState(false);
  const [smtpHint, setSmtpHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    const data = await api.getAdminSettings();
    setBuiltin(data.builtin_professor_emails || []);
    setAdmins(data.admin_emails || []);
    setEffective(data.effective_professor_emails || []);
    setSmtpOk(!!data.smtp_configured);
    setSmtpHint(data.smtp_user_hint ?? null);
    const add = data.additional_professor_emails || [];
    setAdditionalText(add.join('\n'));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await api.adminMe();
      if (cancelled) return;
      if (!me) {
        setGate('auth');
        return;
      }
      if (!me.isAdmin) {
        setGate('forbidden');
        return;
      }
      setGate('ok');
      try {
        await loadSettings();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load settings');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSettings]);

  const parseAdditional = (text: string): string[] =>
    text
      .split(/[\n,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

  const handleSave = async () => {
    setError(null);
    setSavedMsg(null);
    setSaving(true);
    try {
      const list = parseAdditional(additionalText);
      const res = await api.updateAdminProfessorEmails(list);
      setEffective(res.effective_professor_emails || []);
      setSavedMsg('Professor list updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (gate === 'loading') {
    return (
      <DashboardShell>
        <div className="p-8 text-slate-400">Loading…</div>
      </DashboardShell>
    );
  }

  if (gate === 'auth') {
    return (
      <DashboardShell>
        <div className="p-8 max-w-lg">
          <p className="text-slate-300 mb-4">Sign in to access the admin panel.</p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="px-4 py-2 rounded-xl bg-primary text-background-dark font-semibold"
          >
            Go to home
          </button>
        </div>
      </DashboardShell>
    );
  }

  if (gate === 'forbidden') {
    return (
      <DashboardShell>
        <div className="p-8 max-w-lg">
          <p className="text-amber-400 font-medium mb-2">Access denied</p>
          <p className="text-slate-400 text-sm mb-4">This area is only for administrators.</p>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 rounded-xl border border-primary/30 text-primary hover:bg-primary/10"
          >
            Back to dashboard
          </button>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-100 mb-1">Admin</h1>
        <p className="text-slate-500 text-sm mb-8">
          Manage extra professor accounts (pose sessions). SMTP stays in server <code className="text-primary/90">.env</code>.
        </p>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-sm">{error}</div>
        )}
        {savedMsg && (
          <div className="mb-4 p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-sm">
            {savedMsg}
          </div>
        )}

        <section className="mb-10 p-6 rounded-2xl border border-primary/15 bg-white/[0.03]">
          <h2 className="text-lg font-semibold text-primary mb-3">Administrators</h2>
          <p className="text-slate-500 text-sm mb-4">
            <span className="text-slate-300">alvaromp2005@gmail.com</span> is always an admin. Add more via{' '}
            <code className="text-slate-400">ADMIN_EMAILS</code> in backend <code className="text-slate-400">.env</code>{' '}
            (comma-separated).
          </p>
          <ul className="list-disc list-inside text-slate-400 text-sm space-y-1">
            {admins.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </section>

        <section className="mb-10 p-6 rounded-2xl border border-primary/15 bg-white/[0.03]">
          <h2 className="text-lg font-semibold text-primary mb-3">Built-in professors</h2>
          <p className="text-slate-500 text-sm mb-4">Always allowed (env + defaults). Not removable from this UI.</p>
          <ul className="list-disc list-inside text-slate-400 text-sm space-y-1">
            {builtin.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </section>

        <section className="mb-10 p-6 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5">
          <h2 className="text-lg font-semibold text-fuchsia-300 mb-3">Additional professor emails</h2>
          <p className="text-slate-500 text-sm mb-4">
            One address per line (or comma-separated). These users can save Pose Attendance sessions in the app.
          </p>
          <textarea
            value={additionalText}
            onChange={(e) => setAdditionalText(e.target.value)}
            rows={8}
            className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-slate-200 text-sm font-mono focus:border-fuchsia-500/50 focus:outline-none"
            placeholder="teacher2@school.edu&#10;other@example.com"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-4 px-6 py-3 rounded-xl bg-fuchsia-600/80 text-white font-semibold hover:bg-fuchsia-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save professor emails'}
          </button>
        </section>

        <section className="mb-10 p-6 rounded-2xl border border-primary/15 bg-white/[0.03]">
          <h2 className="text-lg font-semibold text-slate-200 mb-3">Effective professor list</h2>
          <ul className="list-disc list-inside text-slate-400 text-sm space-y-1">
            {effective.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </section>

        <section className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
          <h2 className="text-lg font-semibold text-slate-200 mb-3">Email (SMTP)</h2>
          <p className="text-slate-500 text-sm mb-4">
            Outbound mail (Zoho, etc.) is configured with <code className="text-slate-400">SMTP_*</code> in backend{' '}
            <code className="text-slate-400">.env</code>. This panel does not store passwords.
          </p>
          <p className="text-slate-300 text-sm">
            Status:{' '}
            <span className={smtpOk ? 'text-emerald-400' : 'text-amber-400'}>
              {smtpOk ? 'Configured' : 'Not configured'}
            </span>
            {smtpHint ? (
              <>
                {' '}
                · From: <span className="text-slate-400">{smtpHint}</span>
              </>
            ) : null}
          </p>
        </section>
      </div>
    </DashboardShell>
  );
}
