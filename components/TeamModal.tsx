'use client';

import { useEffect, useState } from 'react';

const C = {
  teal: '#10BEB2', tealDeep: '#0E9E95', ink: '#222A2E', sub: '#697479',
  line: '#e7eded', mist: '#eafaf7',
};

type Member = {
  id: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
  created_at: string;
  position: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  staff: 'Staff',
  client: 'Client',
};

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
    try {
      const res = await fetch('/api/team');
      const d = await res.json() as { members?: Member[] };
      setMembers(d.members ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { if (open) void load(); }, [open]);

  if (!open) return null;

  const staffMembers = members.filter(m => m.role !== 'client');

  return (
    <div style={overlay} onClick={() => setOpen(false)}>
      <div style={panel} onClick={e => e.stopPropagation()}>
        <div style={head}>
          <h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' }}>
            Team · <span style={{ color: C.teal }}>{staffMembers.length}</span>
          </h3>
          <button style={xBtn} onClick={() => setOpen(false)}>×</button>
        </div>

        {loading && <div style={empty}>Loading team…</div>}
        {!loading && staffMembers.length === 0 && (
          <div style={empty}>No team members found. Create users in Supabase → Authentication → Users.</div>
        )}

        <div style={grid}>
          {staffMembers.map(m => (
            <div key={m.id} style={card}>
              {/* Avatar */}
              <div style={avatarWrap}>
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt={m.full_name ?? ''} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={avatarFallback}>{initials(m.full_name)}</div>
                )}
              </div>
              <div style={{ fontWeight: 800, fontSize: 15, marginTop: 10, color: C.ink }}>{m.full_name ?? 'Unnamed'}</div>
              {m.position && <div style={{ fontSize: 12.5, color: C.tealDeep, fontWeight: 600, marginTop: 2 }}>{m.position}</div>}
              <div style={{ marginTop: 6 }}>
                <span style={roleBadge(m.role)}>{ROLE_LABEL[m.role] ?? m.role}</span>
              </div>
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 8 }}>
                Since {fmt(m.created_at)}
              </div>
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
const empty: React.CSSProperties = { textAlign: 'center', padding: '40px 0', color: C.sub, fontSize: 13.5 };
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 };
const card: React.CSSProperties = {
  background: C.mist, borderRadius: 16, padding: '20px 16px', textAlign: 'center',
  border: `1px solid ${C.line}`,
};
const avatarWrap: React.CSSProperties = { display: 'flex', justifyContent: 'center' };
const avatarFallback: React.CSSProperties = {
  width: 72, height: 72, borderRadius: '50%',
  background: 'linear-gradient(135deg, #10BEB2, #0E9E95)',
  color: '#fff', fontWeight: 900, fontSize: 22,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
