'use client';

// components/ClientsListModal.tsx
// Full client list: active/inactive tabs, edit inline, add new client.

import { useEffect, useRef, useState } from 'react';

const C = {
  teal: '#10BEB2', tealDeep: '#0E9E95', ink: '#222A2E', sub: '#697479',
  line: '#e7eded', bad: '#d2603a', good: '#1a9f5e', mist: '#eafaf7',
};

type Client = {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  is_active: boolean | null;
};

type View = 'list' | 'add' | 'edit';

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
}

export default function ClientsListModal() {
  const [open, setOpen]       = useState(false);
  const [view, setView]       = useState<View>('list');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError]     = useState<string | null>(null);
  const [q, setQ]             = useState('');
  const [tab, setTab]         = useState<'all' | 'active' | 'inactive'>('all');
  const loadedRef = useRef(false);

  // Add form
  const [addCompany, setAddCompany]   = useState('');
  const [addContact, setAddContact]   = useState('');
  const [addEmail, setAddEmail]       = useState('');

  // Edit form
  const [editTarget, setEditTarget]   = useState<Client | null>(null);
  const [editCompany, setEditCompany] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editEmail, setEditEmail]     = useState('');
  const [editActive, setEditActive]   = useState(true);

  useEffect(() => {
    function findLink(): HTMLElement | null {
      const links = Array.from(document.querySelectorAll('.side a'));
      return (links.find((a) => {
        const t = (a.textContent || '').replace(/\d+/g, '').trim().toLowerCase();
        return t === 'clients';
      }) as HTMLElement) || null;
    }
    let bound: HTMLElement | null = null;
    const onClick = (e: Event) => { e.preventDefault(); setOpen(true); };
    function ensure() {
      const link = findLink();
      if (!link || link === bound) return;
      bound = link; link.style.cursor = 'pointer'; link.addEventListener('click', onClick);
    }
    ensure();
    const obs = new MutationObserver(() => ensure());
    obs.observe(document.body, { childList: true, subtree: true });
    return () => { obs.disconnect(); if (bound) bound.removeEventListener('click', onClick); };
  }, []);

  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    void load();
  }, [open]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/clients');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could not load clients.');
      setClients(Array.isArray(json.clients) ? json.clients : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.');
    } finally { setLoading(false); }
  }

  function refresh() { loadedRef.current = false; void load(); }

  // ── Add client ────────────────────────────────────────────────────────────────
  async function addClient() {
    if (!addCompany.trim() || saving) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: addCompany.trim(), contact_name: addContact.trim() || null, email: addEmail.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could not create client.');
      setAddCompany(''); setAddContact(''); setAddEmail('');
      setView('list'); loadedRef.current = false; void load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unexpected error.'); }
    finally { setSaving(false); }
  }

  // ── Edit client ───────────────────────────────────────────────────────────────
  function openEdit(c: Client) {
    setEditTarget(c); setEditCompany(c.company_name); setEditContact(c.contact_name || '');
    setEditEmail(c.email || ''); setEditActive(c.is_active !== false);
    setView('edit'); setError(null);
  }

  async function saveEdit() {
    if (!editTarget || !editCompany.trim() || saving) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/clients/${editTarget.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: editCompany.trim(),
          contact_name: editContact.trim() || null,
          email: editEmail.trim() || null,
          is_active: editActive,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could not update client.');
      setClients((prev) => prev.map((c) => c.id === editTarget.id ? { ...c, ...json.client } : c));
      setView('list'); setEditTarget(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unexpected error.'); }
    finally { setSaving(false); }
  }

  if (!open) return null;

  const needle = q.trim().toLowerCase();
  const bySearch = needle
    ? clients.filter((c) => [c.company_name, c.contact_name, c.email].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)))
    : clients;
  const byTab = tab === 'active' ? bySearch.filter((c) => c.is_active !== false)
              : tab === 'inactive' ? bySearch.filter((c) => c.is_active === false)
              : bySearch;

  const activeCount   = clients.filter((c) => c.is_active !== false).length;
  const inactiveCount = clients.filter((c) => c.is_active === false).length;

  return (
    <div style={overlay} onClick={() => { setOpen(false); setView('list'); }}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={head}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {view !== 'list' && (
              <button style={backBtn} onClick={() => { setView('list'); setEditTarget(null); setError(null); }}>← Back</button>
            )}
            <div>
              <h3 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em' }}>
                {view === 'list' ? 'Clients' : view === 'add' ? 'New Client' : 'Edit Client'}
              </h3>
              {view === 'list' && (
                <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>
                  {loading ? 'Loading…' : `${clients.length} total · ${activeCount} active · ${inactiveCount} inactive`}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {view === 'list' && (
              <>
                <button style={refreshBtn} onClick={refresh} disabled={loading}>Refresh</button>
                <button style={newBtn} onClick={() => { setView('add'); setError(null); }}>+ New Client</button>
              </>
            )}
            {view === 'add' && (
              <button style={{ ...newBtn, opacity: addCompany.trim() && !saving ? 1 : 0.45 }} onClick={addClient} disabled={!addCompany.trim() || saving}>
                {saving ? 'Saving…' : 'Create Client'}
              </button>
            )}
            {view === 'edit' && (
              <button style={{ ...newBtn, opacity: editCompany.trim() && !saving ? 1 : 0.45 }} onClick={saveEdit} disabled={!editCompany.trim() || saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            )}
            <button style={xBtn} onClick={() => { setOpen(false); setView('list'); }} aria-label="Close">×</button>
          </div>
        </div>

        {error && <div style={errBox}>{error}</div>}

        {/* ── ADD VIEW ──────────────────────────────────────────────────────── */}
        {view === 'add' && (
          <div style={formBox}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Company Name <span style={{ color: C.bad }}>*</span></label>
                <input style={inp} value={addCompany} onChange={(e) => setAddCompany(e.target.value)} placeholder="e.g. La Cocina" autoFocus />
              </div>
              <div>
                <label style={lbl}>Contact Name</label>
                <input style={inp} value={addContact} onChange={(e) => setAddContact(e.target.value)} placeholder="e.g. Maria Lopez" />
              </div>
            </div>
            <div>
              <label style={lbl}>Email</label>
              <input style={{ ...inp, width: '100%' }} type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="e.g. maria@company.com" />
            </div>
          </div>
        )}

        {/* ── EDIT VIEW ─────────────────────────────────────────────────────── */}
        {view === 'edit' && editTarget && (
          <div style={formBox}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Company Name <span style={{ color: C.bad }}>*</span></label>
                <input style={inp} value={editCompany} onChange={(e) => setEditCompany(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Contact Name</label>
                <input style={inp} value={editContact} onChange={(e) => setEditContact(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Email</label>
                <input style={{ ...inp, width: '100%' }} type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Status</label>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button
                    onClick={() => setEditActive(true)}
                    style={{ flex: 1, height: 38, borderRadius: 9, border: `1.5px solid ${editActive ? C.good : C.line}`, background: editActive ? '#e7f7ee' : '#fff', color: editActive ? C.good : C.sub, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                  >Active</button>
                  <button
                    onClick={() => setEditActive(false)}
                    style={{ flex: 1, height: 38, borderRadius: 9, border: `1.5px solid ${!editActive ? C.bad : C.line}`, background: !editActive ? '#fdecec' : '#fff', color: !editActive ? C.bad : C.sub, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                  >Inactive</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── LIST VIEW ─────────────────────────────────────────────────────── */}
        {view === 'list' && (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <input
                style={{ ...inp, flex: 1 }}
                placeholder="Search by company, contact, email…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
              {(['all', 'active', 'inactive'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
                  background: tab === t ? C.teal : C.mist, color: tab === t ? '#fff' : C.tealDeep,
                }}>
                  {t === 'all' ? `All (${clients.length})` : t === 'active' ? `Active (${activeCount})` : `Inactive (${inactiveCount})`}
                </button>
              ))}
            </div>

            {!loading && byTab.length === 0 && (
              <div style={emptyBox}>
                {clients.length === 0
                  ? 'No clients yet. Click "+ New Client" to add one.'
                  : 'No clients match this filter.'}
              </div>
            )}

            {(loading || byTab.length > 0) && (
              <div style={tableWrap}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Company</th>
                      <th style={th}>Contact</th>
                      <th style={th}>Email</th>
                      <th style={th}>Status</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td style={td} colSpan={5}>Loading clients…</td></tr>
                    ) : byTab.map((c) => (
                      <tr key={c.id}>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <span style={avatarStyle}>{initials(c.company_name)}</span>
                            <span style={{ fontWeight: 700 }}>{c.company_name}</span>
                          </div>
                        </td>
                        <td style={td}>{c.contact_name || '—'}</td>
                        <td style={td}>{c.email || '—'}</td>
                        <td style={td}>
                          <span style={{ ...badge, ...(c.is_active === false ? { background: '#fdecec', color: C.bad } : { background: '#e7f7ee', color: C.good }) }}>
                            {c.is_active === false ? 'Inactive' : 'Active'}
                          </span>
                        </td>
                        <td style={td}>
                          <button onClick={() => openEdit(c)} style={editBtn}>Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && needle && (
              <div style={{ fontSize: 12, color: C.sub, marginTop: 8 }}>
                Showing {byTab.length} of {clients.length}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const badge: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, display: 'inline-block' };
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(20,24,27,0.55)', backdropFilter: 'blur(2px)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', zIndex: 9999, overflowY: 'auto',
};
const panel: React.CSSProperties = {
  width: '100%', maxWidth: 940, background: '#fff', borderRadius: 18, padding: '24px 26px 26px',
  boxShadow: '0 30px 70px rgba(0,0,0,0.35)', fontFamily: "'Manrope', sans-serif", color: C.ink,
  display: 'flex', flexDirection: 'column', gap: 0,
};
const head: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 };
const xBtn: React.CSSProperties = { border: 'none', background: 'transparent', fontSize: 26, lineHeight: 1, color: C.sub, cursor: 'pointer', padding: 0 };
const backBtn: React.CSSProperties = { border: `1px solid ${C.line}`, background: '#fff', borderRadius: 9, padding: '5px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: C.ink };
const newBtn: React.CSSProperties = { height: 38, padding: '0 16px', borderRadius: 10, background: C.teal, color: '#fff', fontWeight: 800, fontSize: 13.5, border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const refreshBtn: React.CSSProperties = { height: 38, padding: '0 14px', borderRadius: 10, border: `1px solid ${C.line}`, background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: C.ink, fontFamily: 'inherit' };
const editBtn: React.CSSProperties = { height: 28, padding: '0 10px', borderRadius: 7, border: `1px solid ${C.line}`, background: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: C.ink, fontFamily: 'inherit' };
const formBox: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 20px', background: '#fafdfc', border: `1px solid ${C.line}`, borderRadius: 14, marginBottom: 16 };
const inp: React.CSSProperties = { height: 42, border: `1px solid ${C.line}`, borderRadius: 11, padding: '0 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff', color: C.ink, boxSizing: 'border-box', width: '100%' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 800, color: C.sub, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 };
const tableWrap: React.CSSProperties = { border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'auto', minHeight: 0 };
const th: React.CSSProperties = { textAlign: 'left', fontSize: 10.5, fontWeight: 800, color: C.sub, textTransform: 'uppercase', letterSpacing: '.04em', padding: '11px 12px', position: 'sticky', top: 0, background: '#fff', borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '11px 12px', fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', verticalAlign: 'middle', borderTop: `1px solid ${C.line}` };
const errBox: React.CSSProperties = { background: '#fdecec', color: C.bad, fontSize: 13, fontWeight: 600, padding: '10px 12px', borderRadius: 10, marginBottom: 14 };
const emptyBox: React.CSSProperties = { background: C.mist, color: C.tealDeep, fontSize: 13.5, fontWeight: 600, padding: '20px', borderRadius: 12, textAlign: 'center' };
const avatarStyle: React.CSSProperties = { width: 30, height: 30, borderRadius: 8, background: C.teal, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } as React.CSSProperties;
