'use client';

import { useEffect, useState } from 'react';

const C = {
  teal: '#10BEB2', tealDeep: '#0E9E95', ink: '#222A2E', sub: '#697479',
  line: '#e7eded', mist: '#eafaf7',
};

type Member = { id: string; full_name: string | null; role: string; avatar_url: string | null; created_at: string; };

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'Admin', staff: 'Staff', client: 'Client',
};
const ROLES = ['staff', 'admin', 'super_admin'];

function fmt(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

function initials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

export default function TeamModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [invEmail, setInvEmail] = useState('');
  const [invName, setInvName] = useState('');
  const [invRole, setInvRole] = useState('staff');
  const [inviting, setInviting] = useState(false);
  const [invSuccess, setInvSuccess] = useState<string | null>(null);

  useEffect(() => {
    function findLink(): HTMLElement | null {
      const links = Array.from(document.querySelectorAll('.side a'));
      return (links.find(
        (a) => (a.textContent || '').replace(/\d+/g, '').trim().toLowerCase() === 'team'
      ) as HTMLElement) || null;
    }
    let bound: HTMLElement | null = null;
    const onClick = (e: Event) => { e.preventDefault(); setOpen(true); };
    function ensure() {
      const link = findLink();
      if (!link || link === bound) return;
      bound = link; link.addEventListener('click', onClick);
    }
    ensure();
    const obs = new MutationObserver(() => ensure());
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/team');
      const d = await res.json() as { members?: Member[]; error?: string };
      if (d.error) { setError(d.error); return; }
      setMembers(d.members ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { if (open) void load(); }, [open]);

  async function invite() {
    if (!invEmail.trim()) return;
    setInviting(true);
    setInvSuccess(null);
    setError(null);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: invEmail.trim(), full_name: invName.trim(), role: invRole }),
      });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (d.error) { setError(d.error); return; }
      setInvSuccess(`Invite sent to ${invEmail}! They'll receive an email to set their password.`);
      setInvEmail(''); setInvName(''); setInvRole('staff');
      setShowInvite(false);
      void load();
    } finally { setInviting(false); }
  }

  if (!open) return null;

  return (
    <div style={overlay} onClick={() => setOpen(false)}>
      <div style={panel} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={head}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' }}>
              Team · <span style={{ color: C.teal }}>{members.length}</span>
            </h3>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button style={primaryBtn} onClick={() => { setShowInvite(v => !v); setError(null); setInvSuccess(null); }}>
              {showInvite ? 'Cancel' : '+ Invite Member'}
            </button>
            <button style={xBtn} onClick={() => setOpen(false)}>×</button>
          </div>
        </div>

        {/* Success message */}
        {invSuccess && (
          <div style={{ background: '#e7f7ee', color: '#1a9f5e', padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
            ✓ {invSuccess}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: '#fdecec', color: '#d2603a', padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
            ⚠️ {error}
            {error.includes('SERVICE_ROLE_KEY') && (
              <div style={{ fontWeight: 400, marginTop: 6, fontSize: 12 }}>
                Add <code>SUPABASE_SERVICE_ROLE_KEY</code> to Vercel → Environment Variables. Find it in Supabase → Settings → API → service_role key.
              </div>
            )}
          </div>
        )}

        {/* Invite form */}
        {showInvite && (
          <div style={{ background: C.mist, borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>Invite a New Team Member</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input style={inp} placeholder="Full name" value={invName} onChange={e => setInvName(e.target.value)} />
              <input style={inp} placeholder="Email address *" type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)} />
              <select style={inp} value={invRole} onChange={e => setInvRole(e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
            <button
              style={{ ...primaryBtn, alignSelf: 'flex-start', opacity: invEmail.trim() ? 1 : 0.5 }}
              onClick={invite}
              disabled={inviting || !invEmail.trim()}
            >
              {inviting ? 'Sending invite…' : 'Send Invite Email'}
            </button>
            <div style={{ fontSize: 12, color: C.sub }}>They&apos;ll receive an email with a link to set their password and log in.</div>
          </div>
        )}

        {/* Team grid */}
        {loading && <div style={empty}>Loading team…</div>}
        {!loading && members.length === 0 && !error && (
          <div style={empty}>No team members yet. Use &ldquo;+ Invite Member&rdquo; to add someone.</div>
        )}

        <div style={grid}>
          {members.map(m => (
            <div key={m.id} style={card}>
              <div style={avatarWrap}>
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt={m.full_name ?? ''} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={avatarFallback}>{initials(m.full_name)}</div>
                )}
              </div>
              <div style={{ fontWeight: 800, fontSize: 15, marginTop: 10, color: C.ink }}>{m.full_name ?? 'Unnamed'}</div>
              <div style={{ marginTop: 6 }}>
                <span style={roleBadge(m.role)}>{ROLE_LABEL[m.role] ?? m.role}</span>
              </div>
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 8 }}>Since {fmt(m.created_at)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function roleBadge(role: string): React.CSSProperties {
  const colors: Record<string, { bg: string; color: string }> = {
    super_admin: { bg: '#1a2023', color: '#10BEB2' },
    admin:       { bg: '#eafaf7', color: '#0E9E95' },
    staff:       { bg: '#e8f0fe', color: '#1a73e8' },
    client:      { bg: '#f0f2f2', color: '#697479' },
  };
  const c = colors[role] ?? colors.client;
  return { display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: c.bg, color: c.color };
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(20,24,27,0.55)', backdropFilter: 'blur(2px)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  padding: '40px 20px', zIndex: 9999, overflowY: 'auto',
};
const panel: React.CSSProperties = {
  width: '100%', maxWidth: 860, background: '#fff', borderRadius: 18,
  padding: '24px 26px 32px', boxShadow: '0 30px 70px rgba(0,0,0,0.3)',
  fontFamily: "'Manrope', sans-serif", color: C.ink,
  display: 'flex', flexDirection: 'column', gap: 20,
};
const head: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const xBtn: React.CSSProperties = { border: 'none', background: 'transparent', fontSize: 26, lineHeight: 1, color: C.sub, cursor: 'pointer', padding: 0 };
const primaryBtn: React.CSSProperties = { border: 'none', background: C.teal, color: '#fff', borderRadius: 10, padding: '8px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' };
const empty: React.CSSProperties = { textAlign: 'center', padding: '40px 0', color: C.sub, fontSize: 13.5 };
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 };
const card: React.CSSProperties = { background: C.mist, borderRadius: 16, padding: '20px 16px', textAlign: 'center', border: `1px solid ${C.line}` };
const avatarWrap: React.CSSProperties = { display: 'flex', justifyContent: 'center' };
const avatarFallback: React.CSSProperties = {
  width: 72, height: 72, borderRadius: '50%',
  background: 'linear-gradient(135deg, #10BEB2, #0E9E95)',
  color: '#fff', fontWeight: 900, fontSize: 22,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const inp: React.CSSProperties = {
  flex: 1, minWidth: 160, height: 40, border: `1px solid ${C.line}`, borderRadius: 9,
  padding: '0 12px', fontSize: 13.5, fontFamily: "'Manrope', sans-serif", outline: 'none',
};
