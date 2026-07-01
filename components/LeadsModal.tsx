'use client';

// components/LeadsModal.tsx
//
// Seccion Leads (pipeline). Mismo patron que TicketsModal:
//  - Se engancha al link "Leads" del sidebar por DOM, sin tocar content/admin.ts.
//  - Lista los leads desde /api/leads, permite crear y mover por etapas
//    (nuevo -> contactado -> calificado -> propuesta -> ganado / perdido).

import { useEffect, useRef, useState } from 'react';

const C = {
  teal: '#10BEB2',
  tealDeep: '#0E9E95',
  ink: '#222A2E',
  sub: '#697479',
  line: '#e7eded',
  bad: '#d2603a',
  good: '#1a9f5e',
  warn: '#c98a14',
  blue: '#3b7dd8',
  mist: '#eafaf7',
};

type Status = 'new' | 'contacted' | 'converted' | 'lost';

type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: Status;
  created_at: string;
};

const STATUS_LABEL: Record<Status, string> = {
  new: 'New',
  contacted: 'Contacted',
  converted: 'Converted',
  lost: 'Lost',
};

const SOURCES = ['Web', 'Referral', 'Social Media', 'Phone', 'Event', 'Other'];

function statusStyle(s: Status): React.CSSProperties {
  const map: Record<Status, { background: string; color: string }> = {
    new: { background: C.mist, color: C.tealDeep },
    contacted: { background: '#eaf2fc', color: C.blue },
    converted: { background: '#e7f7ee', color: C.good },
    lost: { background: '#fdecec', color: C.bad },
  };
  return { ...badgeBase, ...map[s] };
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function LeadsModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('');

  const loadedRef = useRef(false);

  useEffect(() => {
    function findLink(): HTMLElement | null {
      const links = Array.from(document.querySelectorAll('.side a'));
      return (links.find(
        (a) => (a.textContent || '').replace(/\d+/g, '').trim().toLowerCase() === 'leads'
      ) as HTMLElement) || null;
    }
    let bound: HTMLElement | null = null;
    const onClick = (e: Event) => {
      e.preventDefault();
      setOpen(true);
    };
    function ensure() {
      const link = findLink();
      if (!link || link === bound) return;
      bound = link;
      link.style.cursor = 'pointer';
      link.addEventListener('click', onClick);
    }
    ensure();
    const obs = new MutationObserver(() => ensure());
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      obs.disconnect();
      if (bound) bound.removeEventListener('click', onClick);
    };
  }, []);

  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    void load();
  }, [open]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/leads', { method: 'GET' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'No se pudieron cargar los leads.');
      setLeads(Array.isArray(json.leads) ? json.leads : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  }

  async function createLead() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          source: source || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'No se pudo crear el lead.');
      setLeads((prev) => [json.lead as Lead, ...prev]);
      setName(''); setEmail(''); setPhone(''); setSource('');
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id: string, status: Status) {
    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    try {
      const res = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error || 'No se pudo actualizar.');
      }
    } catch (err) {
      setLeads(prev);
      setError(err instanceof Error ? err.message : 'Error al actualizar el estado.');
    }
  }

  if (!open) return null;

  const ganados = leads.filter((l) => l.status === 'converted').length;
  const activos = leads.filter((l) => !['converted', 'lost'].includes(l.status)).length;

  return (
    <div style={overlay} onClick={() => setOpen(false)}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <div>
            <h3 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em' }}>Leads</h3>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>
              {loading ? 'Cargando…' : `${leads.length} en total · ${activos} activos · ${ganados} ganados`}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button style={newBtn} onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Cerrar' : '+ Nuevo lead'}
            </button>
            <button style={x} onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
          </div>
        </div>

        {showForm && (
          <div style={formBox}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input style={{ ...input, flex: 1 }} placeholder="Nombre del contacto *" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input style={{ ...input, flex: 1 }} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input style={{ ...input, flex: 1 }} placeholder="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <select style={{ ...input, width: 170 }} value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">— Origen —</option>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button style={{ ...saveBtn, opacity: name.trim() && !saving ? 1 : 0.5 }} onClick={createLead} disabled={!name.trim() || saving}>
              {saving ? 'Guardando…' : 'Crear lead'}
            </button>
          </div>
        )}

        {error && <div style={errBox}>{error}</div>}

        {!error && !loading && leads.length === 0 && (
          <div style={emptyBox}>No hay leads todavía. Crea el primero con "+ Nuevo lead".</div>
        )}

        {(loading || leads.length > 0) && (
          <div style={tableWrap}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Contacto</th>
                  <th style={th}>Email</th>
                  <th style={th}>Origen</th>
                  <th style={th}>Fecha</th>
                  <th style={th}>Etapa</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td style={td} colSpan={6}>Cargando leads…</td></tr>
                ) : (
                  leads.map((l) => (
                    <tr key={l.id}>
                      <td style={{ ...td, fontWeight: 700 }}>{l.name}</td>
                      <td style={td}>{l.email || '—'}</td>
                      <td style={td}>{l.source || '—'}</td>
                      <td style={{ ...td, color: C.sub }}>{fmtDate(l.created_at)}</td>
                      <td style={td}>
                        <select
                          style={{ ...statusStyle(l.status), border: 'none', cursor: 'pointer', appearance: 'none', paddingRight: 22 }}
                          value={l.status}
                          onChange={(e) => changeStatus(l.id, e.target.value as Status)}
                        >
                          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const badgeBase: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, display: 'inline-block',
};
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(20,24,27,0.55)', backdropFilter: 'blur(2px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 9999,
};
const panel: React.CSSProperties = {
  width: '100%', maxWidth: 960, background: '#fff', borderRadius: 18, padding: '24px 26px 22px',
  boxShadow: '0 30px 70px rgba(0,0,0,0.35)', fontFamily: "'Manrope', sans-serif", color: C.ink,
  maxHeight: '88vh', display: 'flex', flexDirection: 'column',
};
const head: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16,
};
const x: React.CSSProperties = {
  border: 'none', background: 'transparent', fontSize: 26, lineHeight: 1, color: C.sub, cursor: 'pointer', padding: 0,
};
const newBtn: React.CSSProperties = {
  height: 40, padding: '0 15px', borderRadius: 11, background: C.teal, color: '#fff',
  fontWeight: 800, fontSize: 13.5, border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
};
const formBox: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: '#fafdfc',
  border: `1px solid ${C.line}`, borderRadius: 14, marginBottom: 16,
};
const input: React.CSSProperties = {
  height: 42, border: `1px solid ${C.line}`, borderRadius: 11, padding: '0 12px',
  fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff', color: C.ink,
};
const saveBtn: React.CSSProperties = {
  height: 44, border: 'none', borderRadius: 11, background: C.teal, color: '#fff',
  fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
};
const tableWrap: React.CSSProperties = {
  border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'auto', flex: 1, minHeight: 0,
};
const th: React.CSSProperties = {
  textAlign: 'left', fontSize: 11, fontWeight: 800, color: C.sub, textTransform: 'uppercase',
  letterSpacing: '.04em', padding: '12px 12px', position: 'sticky', top: 0, background: '#fff',
  borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '11px 12px', borderTop: `1px solid ${C.line}`, fontSize: 13.5, fontWeight: 600,
  whiteSpace: 'nowrap', verticalAlign: 'middle',
};
const errBox: React.CSSProperties = {
  background: '#fdecec', color: C.bad, fontSize: 13, fontWeight: 600, padding: '10px 12px',
  borderRadius: 10, marginBottom: 14, lineHeight: 1.45,
};
const emptyBox: React.CSSProperties = {
  background: C.mist, color: C.tealDeep, fontSize: 13.5, fontWeight: 600, padding: '16px',
  borderRadius: 12, lineHeight: 1.5,
};
