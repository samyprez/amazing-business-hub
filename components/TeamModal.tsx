'use client';

import { useEffect, useState } from 'react';

const C = {
  teal: '#10BEB2', tealDeep: '#0E9E95', ink: '#222A2E', sub: '#697479',
  line: '#e7eded', mist: '#eafaf7', bad: '#d2603a',
};

type Member = { id: string; full_name: string | null; role: string; created_at: string; };

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'Admin', staff: 'Staff', client: 'Client',
};
const ROLES = ['staff', 'admin', 'super_admin'];

function fmt(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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
      // Get current user id for "cannot delete yourself" check
      const meRes = await fetch('/api/me').catch(() => null);
      if (meRes?.ok) {
        const me = await meRes.json() as { id?: string };
        if (me.id) setCurrentUserId(me.id);
      }

      const res = await fetch('/api/team');
      const d = await res.json() as { members?: Member[]; error?: string };
      if (d.error) { setError(d.error); return; }
      setMembers(d.members ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading team');
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
      setInvSuccess(`✓ Invite sent to ${invEmail}! They'll receive an email to set their password.`);
      setInvEmail(''); setInvName(''); setInvRole('staff');
      setShowInvite(false);
      void load();
    } finally { setInviting(false); }
  }

  async function removeMember(id: string, name: string | null) {
    if (!confirm(`Remove ${name ?? 'this member'} from the team? This cannot be undone.`)) return;
    setError(null);
    const res = await fetch('/api/team', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const d = await res.json() as { ok?: boolean; error?: string };
    if (d.error) { setError(d.error); return; }
    setMembers(prev => prev.filter(m => m.id !== id));
  }

  if (!open) return null;

  return (
    <div style={overlay} onClick={() => setOpen(false)}>
      <div style={panel} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={head}>
          <h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em', margin: 0 }}>
            Team · <span style={{ color: C.teal }}>{members.length}</span>
          </h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button style={primaryBtn} onClick={() => { setShowInvite(v => !v); setError(null); setInvSuccess(null); }}>
              {showInvite ? 'Cancel' : '+ Invite Member'}
            </button>
            <button style={xBtn} onClick={() => setOpen(false)}>×</button>
          </div>
        </div>

        {invSuccess && (
          <div style={{ background: '#e7f7ee', color: '#1a9f5e', padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
            {invSuccess}
          </div>
        )}

        {error && (
          <div style={{ background: '#fdecec', color: C.bad, padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
            ⚠️ {error}
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
            <div style={{ fontSize: 12, color: C.sub }}>
              They&apos;ll receive an email to set their password and access the dashboard.
            </div>
          </div>
        )}

        {/* Team list */}
        {loading && <div style={empty}>Loading team…</div>}
        {!loading && members.length === 0 && !error && (
          <div style={empty}>No team members yet. Use &ldquo;+ Invite Member&rdquo; to add someone.</div>
        )}

        {members.length > 0 && (
          <div style={tableWrap}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Member</th>
                  <th style={th}>Role</th>
                  <th style={th}>Since</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={avatarStyle(m.role)}>{initials(m.full_name)}</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{m.full_name ?? 'Unnamed'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={td}>
                      <span style={roleBadge(m.role)}>{ROLE_LABEL[m.role] ?? m.role}</span>
                    </td>
                    <td style={{ ...td, color: C.sub, fontSize: 13 }}>{fmt(m.created_at)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {m.id !== currentUserId && (
                        <button
                          style={{ border: `1px solid ${C.bad}`, background: 'transparent', color: C.bad, borderRadius: 7, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
                          onClick={() => void removeMember(m.id, m.full_name)}
                        >
                          Remove
                        </button>
                      )}
                      {m.id === currentUserId && (
                        <span style={{ fontSize: 11, color: C.sub }}>You</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function avatarStyle(role: string): React.CSSProperties {
  const colors: Record<string, string> = {
    super_admin: 'linear-gradient(135deg,#1c2225,#10BEB2)',
    admin: 'linear-gradient(135deg,#10BEB2,#0E9E95)',
    staff: 'linear-gradient(135deg,#3b7dd8,#1a73e8)',
  };
  return {
    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
    background: colors[role] ?? 'linear-gradient(135deg,#697479,#4a5568)',
    color: '#fff', fontWeight: 800, fontSize: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
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
  width: '100%', maxWidth: 720, background: '#fff', borderRadius: 18,
  padding: '24px 26px 28px', boxShadow: '0 30px 70px rgba(0,0,0,0.3)',
  fontFamily: "'Manrope', sans-serif", color: C.ink,
  display: 'flex', flexDirection: 'column', gap: 18,
};
const head: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const xBtn: React.CSSProperties = { border: 'none', background: 'transparent', fontSize: 26, lineHeight: 1, color: C.sub, cursor: 'pointer', padding: 0 };
const primaryBtn: React.CSSProperties = { border: 'none', background: C.teal, color: '#fff', borderRadius: 10, padding: '8px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' };
const empty: React.CSSProperties = { textAlign: 'center', padding: '40px 0', color: C.sub, fontSize: 13.5 };
const tableWrap: React.CSSProperties = { border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden' };
const th: React.CSSProperties = { padding: '10px 14px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: C.sub, textAlign: 'left', background: '#f8fafa', borderBottom: `1px solid ${C.line}` };
const td: React.CSSProperties = { padding: '12px 14px', fontSize: 14, verticalAlign: 'middle' };
const inp: React.CSSProperties = {
  flex: 1, minWidth: 160, height: 40, border: `1px solid ${C.line}`, borderRadius: 9,
  padding: '0 12px', fontSize: 13.5, fontFamily: "'Manrope', sans-serif", outline: 'none',
};
