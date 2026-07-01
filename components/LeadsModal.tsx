'use client';

import { useEffect, useRef, useState } from 'react';

const C = {
  teal: '#10BEB2', tealDeep: '#0E9E95', ink: '#222A2E', sub: '#697479',
  line: '#e7eded', bad: '#d2603a', good: '#1a9f5e', warn: '#c98a14',
  blue: '#3b7dd8', mist: '#eafaf7',
};

type Status = 'new' | 'contacted' | 'converted' | 'lost';
type Lead = { id: string; name: string; email: string | null; phone: string | null; status: Status; created_at: string; };

const STATUS_LABEL: Record<Status, string> = { new: 'New', contacted: 'Contacted', converted: 'Converted', lost: 'Lost' };
const STATUSES = Object.keys(STATUS_LABEL) as Status[];

function statusStyle(s: Status): React.CSSProperties {
  const map: Record<Status, { background: string; color: string }> = {
    new:       { background: C.mist,      color: C.tealDeep },
    contacted: { background: '#eaf2fc',   color: C.blue },
    converted: { background: '#e7f7ee',   color: C.good },
    lost:      { background: '#fdecec',   color: C.bad },
  };
  return { ...badgeBase, ...map[s] };
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

export default function LeadsModal() {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [error, setError]     = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]   = useState(false);

  // New lead form
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Detail / edit drawer
  const [selected, setSelected] = useState<Lead | null>(null);
  const [editing, setEditing]   = useState(false);
  const [eName, setEName]   = useState('');
  const [eEmail, setEEmail] = useState('');
  const [ePhone, setEPhone] = useState('');
  const [eStatus, setEStatus] = useState<Status>('new');
  const [eSaving, setESaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadedRef = useRef(false);

  useEffect(() => {
    function findLink(): HTMLElement | null {
      const links = Array.from(document.querySelectorAll('.side a'));
      return (links.find(
        (a) => (a.textContent || '').replace(/\d+/g, '').trim().toLowerCase() === 'leads'
      ) as HTMLElement) || null;
    }
    let bound: HTMLElement | null = null;
    const onClick = (e: Event) => { e.preventDefault(); setOpen(true); };
    function ensure() {
      const link = findLink();
      if (!link || link === bound) return;
      bound = link;
      link.addEventListener('click', onClick);
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
      const res = await fetch('/api/leads');
      const json = await res.json() as { leads?: Lead[]; error?: string };
      if (!res.ok) throw new Error(json?.error || 'Error cargando leads.');
      setLeads(Array.isArray(json.leads) ? json.leads : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally { setLoading(false); }
  }

  async function createLead() {
    if (!name.trim() || saving) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() || null, phone: phone.trim() || null }),
      });
      const json = await res.json() as { lead?: Lead; error?: string };
      if (!res.ok) throw new Error(json?.error || 'No se pudo crear.');
      setLeads(prev => [json.lead as Lead, ...prev]);
      setName(''); setEmail(''); setPhone(''); setShowForm(false);
    } catch (err) { setError(err instanceof Error ? err.message : 'Error.'); }
    finally { setSaving(false); }
  }

  function openDetail(l: Lead) {
    setSelected(l); setEditing(false);
    setEName(l.name); setEEmail(l.email ?? ''); setEPhone(l.phone ?? ''); setEStatus(l.status);
  }

  async function saveEdit() {
    if (!selected || eSaving) return;
    setESaving(true); setError(null);
    try {
      const res = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, name: eName.trim(), email: eEmail.trim() || null, phone: ePhone.trim() || null, status: eStatus }),
      });
      const json = await res.json() as { lead?: Lead; error?: string };
      if (!res.ok) throw new Error(json?.error || 'No se pudo guardar.');
      const updated = json.lead as Lead;
      setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
      setSelected(updated); setEditing(false);
    } catch (err) { setError(err instanceof Error ? err.message : 'Error.'); }
    finally { setESaving(false); }
  }

  async function deleteLead() {
    if (!selected || deleting) return;
    if (!confirm(`¿Eliminar el lead "${selected.name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id }),
      });
      if (!res.ok) { const j = await res.json() as { error?: string }; throw new Error(j?.error || 'Error.'); }
      setLeads(prev => prev.filter(l => l.id !== selected.id));
      setSelected(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Error.'); }
    finally { setDeleting(false); }
  }

  async function changeStatus(id: string, status: Status) {
    setLeads(ls => ls.map(l => l.id === id ? { ...l, status } : l));
    if (selected?.id === id) setSelected(s => s ? { ...s, status } : s);
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
  }

  if (!open) return null;

  const ganados = leads.filter(l => l.status === 'converted').length;
  const activos = leads.filter(l => !['converted', 'lost'].includes(l.status)).length;

  return (
    <div style={overlay} onClick={() => { setOpen(false); setSelected(null); }}>
      <div style={panel} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={head}>
          <div>
            <h3 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em' }}>Leads</h3>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>
              {loading ? 'Cargando…' : `${leads.length} en total · ${activos} activos · ${ganados} ganados`}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {selected && (
              <button style={backBtn} onClick={() => setSelected(null)}>← Volver</button>
            )}
            {!selected && (
              <button style={newBtn} onClick={() => setShowForm(v => !v)}>
                {showForm ? 'Cerrar' : '+ Nuevo lead'}
              </button>
            )}
            <button style={x} onClick={() => { setOpen(false); setSelected(null); }} aria-label="Cerrar">×</button>
          </div>
        </div>

        {error && <div style={errBox}>{error}</div>}

        {/* ── DETAIL / EDIT VIEW ── */}
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Info card */}
            <div style={{ background: C.mist, borderRadius: 12, padding: '16px 18px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={metaLabel}>Contacto</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{selected.name}</div>
              </div>
              <div>
                <div style={metaLabel}>Email</div>
                <div style={{ fontWeight: 600 }}>{selected.email || '—'}</div>
              </div>
              <div>
                <div style={metaLabel}>Teléfono</div>
                <div style={{ fontWeight: 600 }}>{selected.phone || '—'}</div>
              </div>
              <div>
                <div style={metaLabel}>Fecha</div>
                <div style={{ fontWeight: 600 }}>{fmtDate(selected.created_at)}</div>
              </div>
              <div>
                <div style={metaLabel}>Etapa</div>
                <span style={statusStyle(selected.status)}>{STATUS_LABEL[selected.status]}</span>
              </div>
            </div>

            {/* Status buttons */}
            <div>
              <div style={metaLabel}>Cambiar etapa</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                {STATUSES.map(s => (
                  <button key={s} onClick={() => void changeStatus(selected.id, s)} style={{
                    ...statusStyle(s), border: 'none', cursor: 'pointer',
                    opacity: selected.status === s ? 1 : 0.4,
                    transform: selected.status === s ? 'scale(1.05)' : 'scale(1)',
                  }}>{STATUS_LABEL[s]}</button>
                ))}
              </div>
            </div>

            {/* Edit form */}
            {!editing ? (
              <button style={{ ...newBtn, alignSelf: 'flex-start' }} onClick={() => setEditing(true)}>✏ Editar datos</button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: '#fafdfc', border: `1px solid ${C.line}`, borderRadius: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: C.ink, marginBottom: 2 }}>Editar lead</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input style={{ ...inp, flex: 1, minWidth: 140 }} placeholder="Nombre *" value={eName} onChange={e => setEName(e.target.value)} />
                  <input style={{ ...inp, flex: 1, minWidth: 140 }} placeholder="Email" value={eEmail} onChange={e => setEEmail(e.target.value)} />
                  <input style={{ ...inp, flex: 1, minWidth: 140 }} placeholder="Teléfono" value={ePhone} onChange={e => setEPhone(e.target.value)} />
                  <select style={{ ...inp, minWidth: 130 }} value={eStatus} onChange={e => setEStatus(e.target.value as Status)}>
                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ ...saveBtn, opacity: eName.trim() && !eSaving ? 1 : 0.5 }} onClick={saveEdit} disabled={!eName.trim() || eSaving}>
                    {eSaving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                  <button style={{ ...saveBtn, background: '#f0f2f2', color: C.sub }} onClick={() => setEditing(false)}>Cancelar</button>
                </div>
              </div>
            )}

            {/* Delete */}
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
              <button
                style={{ border: `1px solid ${C.bad}`, background: 'transparent', color: C.bad, borderRadius: 8, padding: '6px 14px', fontSize: 12.5, cursor: 'pointer', fontWeight: 700, opacity: deleting ? 0.5 : 1 }}
                onClick={deleteLead}
                disabled={deleting}
              >
                {deleting ? 'Eliminando…' : '🗑 Eliminar lead'}
              </button>
            </div>
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {!selected && (
          <>
            {showForm && (
              <div style={formBox}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input style={{ ...inp, flex: 1, minWidth: 140 }} placeholder="Nombre del contacto *" value={name} onChange={e => setName(e.target.value)} autoFocus />
                  <input style={{ ...inp, flex: 1, minWidth: 140 }} placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                  <input style={{ ...inp, flex: 1, minWidth: 140 }} placeholder="Teléfono / WhatsApp" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                <button style={{ ...saveBtn, opacity: name.trim() && !saving ? 1 : 0.5 }} onClick={createLead} disabled={!name.trim() || saving}>
                  {saving ? 'Guardando…' : 'Crear lead'}
                </button>
              </div>
            )}

            {!error && !loading && leads.length === 0 && (
              <div style={emptyBox}>No hay leads todavía. Crea el primero con &quot;+ Nuevo lead&quot;.</div>
            )}

            {(loading || leads.length > 0) && (
              <div style={tableWrap}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Contacto</th>
                      <th style={th}>Email</th>
                      <th style={th}>Teléfono</th>
                      <th style={th}>Fecha</th>
                      <th style={th}>Etapa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td style={td} colSpan={5}>Cargando leads…</td></tr>
                    ) : leads.map(l => (
                      <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(l)}>
                        <td style={{ ...td, fontWeight: 700 }}>{l.name}</td>
                        <td style={td}>{l.email || '—'}</td>
                        <td style={{ ...td, color: C.sub }}>{l.phone || '—'}</td>
                        <td style={{ ...td, color: C.sub }}>{fmtDate(l.created_at)}</td>
                        <td style={td} onClick={e => e.stopPropagation()}>
                          <select
                            style={{ ...statusStyle(l.status), border: 'none', cursor: 'pointer', appearance: 'none', paddingRight: 22 }}
                            value={l.status}
                            onChange={e => void changeStatus(l.id, e.target.value as Status)}
                          >
                            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const badgeBase: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, display: 'inline-block' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(20,24,27,0.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 9999 };
const panel: React.CSSProperties = { width: '100%', maxWidth: 980, background: '#fff', borderRadius: 18, padding: '24px 26px 22px', boxShadow: '0 30px 70px rgba(0,0,0,0.35)', fontFamily: "'Manrope', sans-serif", color: C.ink, maxHeight: '88vh', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' };
const head: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' };
const x: React.CSSProperties = { border: 'none', background: 'transparent', fontSize: 26, lineHeight: 1, color: C.sub, cursor: 'pointer', padding: 0 };
const newBtn: React.CSSProperties = { height: 40, padding: '0 15px', borderRadius: 11, background: C.teal, color: '#fff', fontWeight: 800, fontSize: 13.5, border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const backBtn: React.CSSProperties = { height: 40, padding: '0 14px', borderRadius: 11, background: '#f0f2f2', color: C.sub, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit' };
const formBox: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: '#fafdfc', border: `1px solid ${C.line}`, borderRadius: 14 };
const inp: React.CSSProperties = { height: 42, border: `1px solid ${C.line}`, borderRadius: 11, padding: '0 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff', color: C.ink };
const saveBtn: React.CSSProperties = { height: 44, border: 'none', borderRadius: 11, background: C.teal, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', padding: '0 20px' };
const tableWrap: React.CSSProperties = { border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'auto', flex: 1 };
const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 800, color: C.sub, textTransform: 'uppercase', letterSpacing: '.04em', padding: '12px 12px', position: 'sticky', top: 0, background: '#fff', borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '11px 12px', borderTop: `1px solid ${C.line}`, fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' };
const errBox: React.CSSProperties = { background: '#fdecec', color: C.bad, fontSize: 13, fontWeight: 600, padding: '10px 12px', borderRadius: 10, lineHeight: 1.45 };
const emptyBox: React.CSSProperties = { background: C.mist, color: C.tealDeep, fontSize: 13.5, fontWeight: 600, padding: '16px', borderRadius: 12 };
const metaLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 };
