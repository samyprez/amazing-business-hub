'use client';

// components/TicketsModal.tsx
//
// Seccion Tickets. Mismo patron que ClientsListModal:
//  - Se engancha al link "Tickets" del sidebar (un <a> sin href) por DOM,
//    sin tocar content/admin.ts.
//  - Trae los tickets desde /api/tickets, permite crear uno nuevo y cambiar
//    su estado en linea. La lectura/escritura corre server-side.

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
  mist: '#eafaf7',
};

type Ticket = {
  id: string;
  subject: string;
  description: string | null;
  status: 'open' | 'waiting' | 'closed';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  client_id: string | null;
  clients: { company_name: string } | null;
};

type ClientOption = { id: string; company_name: string };

const STATUS_LABEL: Record<Ticket['status'], string> = {
  open: 'Open',
  waiting: 'Waiting',
  closed: 'Closed',
};

const PRIORITY_LABEL: Record<Ticket['priority'], string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

function statusStyle(s: Ticket['status']): React.CSSProperties {
  const map = {
    open: { background: '#e7f7ee', color: C.good },
    waiting: { background: '#fff4e0', color: C.warn },
    closed: { background: '#f0f2f2', color: C.sub },
  };
  return { ...badgeBase, ...map[s] };
}

function priorityStyle(p: Ticket['priority']): React.CSSProperties {
  const map = {
    high: { background: '#fdecec', color: C.bad },
    medium: { background: C.mist, color: C.tealDeep },
    low: { background: '#f0f2f2', color: C.sub },
  };
  return { ...badgeBase, ...map[p] };
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function TicketsModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Ticket | null>(null);

  // Form
  const [subject, setSubject] = useState('');
  const [clientId, setClientId] = useState('');
  const [priority, setPriority] = useState<Ticket['priority']>('medium');
  const [description, setDescription] = useState('');

  const loadedRef = useRef(false);

  // Enganchar el link "Tickets" del sidebar.
  useEffect(() => {
    function findLink(): HTMLElement | null {
      const links = Array.from(document.querySelectorAll('.side a'));
      return (links.find(
        (a) => (a.textContent || '').replace(/\d+/g, '').trim().toLowerCase() === 'tickets'
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
    void loadAll();
  }, [open]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [tRes, cRes] = await Promise.all([
        fetch('/api/tickets', { method: 'GET' }),
        fetch('/api/clients', { method: 'GET' }),
      ]);
      const tJson = await tRes.json();
      if (!tRes.ok) throw new Error(tJson?.error || 'No se pudieron cargar los tickets.');
      setTickets(Array.isArray(tJson.tickets) ? tJson.tickets : []);
      if (cRes.ok) {
        const cJson = await cRes.json();
        setClients(Array.isArray(cJson.clients) ? cJson.clients : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  }

  async function createTicket() {
    if (!subject.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          client_id: clientId || null,
          priority,
          description: description.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'No se pudo crear el ticket.');
      setTickets((prev) => [json.ticket as Ticket, ...prev]);
      setSubject('');
      setClientId('');
      setPriority('medium');
      setDescription('');
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id: string, status: Ticket['status']) {
    const prev = tickets;
    setTickets((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      const res = await fetch('/api/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error || 'No se pudo actualizar.');
      }
    } catch (err) {
      setTickets(prev); // revertir
      setError(err instanceof Error ? err.message : 'Error al actualizar el estado.');
    }
  }

  if (!open) return null;

  const openCount = tickets.filter((t) => t.status !== 'closed').length;

  return (
    <>
    <div style={overlay} onClick={() => setOpen(false)}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <div>
            <h3 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em' }}>Tickets</h3>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>
              {loading ? 'Cargando…' : `${tickets.length} en total · ${openCount} sin cerrar`}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button style={newBtn} onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Cerrar' : '+ Nuevo ticket'}
            </button>
            <button style={x} onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
          </div>
        </div>

        {showForm && (
          <div style={formBox}>
            <input
              style={input}
              placeholder="Asunto del ticket *"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <select style={{ ...input, flex: 1 }} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">— Cliente (opcional) —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
              <select
                style={{ ...input, width: 150 }}
                value={priority}
                onChange={(e) => setPriority(e.target.value as Ticket['priority'])}
              >
                <option value="low">Priority: Low</option>
                <option value="medium">Priority: Medium</option>
                <option value="high">Priority: High</option>
              </select>
            </div>
            <textarea
              style={{ ...input, height: 70, paddingTop: 10, resize: 'vertical' }}
              placeholder="Descripción (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button
              style={{ ...saveBtn, opacity: subject.trim() && !saving ? 1 : 0.5 }}
              onClick={createTicket}
              disabled={!subject.trim() || saving}
            >
              {saving ? 'Guardando…' : 'Crear ticket'}
            </button>
          </div>
        )}

        {error && <div style={errBox}>{error}</div>}

        {!error && !loading && tickets.length === 0 && (
          <div style={emptyBox}>No hay tickets todavía. Crea el primero con "+ Nuevo ticket".</div>
        )}

        {(loading || tickets.length > 0) && (
          <div style={tableWrap}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Asunto</th>
                  <th style={th}>Cliente</th>
                  <th style={th}>Prioridad</th>
                  <th style={th}>Fecha</th>
                  <th style={th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td style={td} colSpan={5}>Cargando tickets…</td></tr>
                ) : (
                  tickets.map((t) => (
                    <tr
                      key={t.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelected(t)}
                    >
                      <td style={{ ...td, fontWeight: 700, whiteSpace: 'normal', maxWidth: 260 }}>{t.subject}</td>
                      <td style={td}>{t.clients?.company_name || '—'}</td>
                      <td style={td}><span style={priorityStyle(t.priority)}>{PRIORITY_LABEL[t.priority]}</span></td>
                      <td style={{ ...td, color: C.sub }}>{fmtDate(t.created_at)}</td>
                      <td style={td} onClick={e => e.stopPropagation()}>
                        <select
                          style={{ ...statusStyle(t.status), border: 'none', cursor: 'pointer', appearance: 'none', paddingRight: 22 }}
                          value={t.status}
                          onChange={(e) => changeStatus(t.id, e.target.value as Ticket['status'])}
                        >
                          {(Object.keys(STATUS_LABEL) as Ticket['status'][]).map((s) => (
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

    {/* ── Ticket Detail Drawer ─────────────────────────────────────────────── */}
    {selected && (
      <div style={drawerOverlay} onClick={() => setSelected(null)}>
        <div style={drawer} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: C.sub, marginBottom: 6 }}>Ticket Detail</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.3 }}>{selected.subject}</h3>
            </div>
            <button style={x} onClick={() => setSelected(null)}>×</button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            <span style={priorityStyle(selected.priority)}>{PRIORITY_LABEL[selected.priority]}</span>
            <span style={statusStyle(selected.status)}>{STATUS_LABEL[selected.status]}</span>
            {selected.clients && <span style={{ ...badgeBase, background: C.mist, color: C.tealDeep }}>{selected.clients.company_name}</span>}
          </div>

          {selected.description && (
            <div style={{ background: '#f4f7f7', borderRadius: 10, padding: '12px 14px', fontSize: 13.5, lineHeight: 1.7, color: C.ink, marginBottom: 20 }}>
              {selected.description}
            </div>
          )}

          <div style={{ fontSize: 12, color: C.sub, marginBottom: 20 }}>Created: {fmtDate(selected.created_at)}</div>

          <div style={{ marginBottom: 8, fontSize: 12.5, fontWeight: 700 }}>Change Status:</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(Object.keys(STATUS_LABEL) as Ticket['status'][]).map(s => (
              <button
                key={s}
                onClick={() => { changeStatus(selected.id, s); setSelected({ ...selected, status: s }); }}
                style={{
                  ...statusStyle(s), border: 'none', cursor: 'pointer',
                  opacity: selected.status === s ? 1 : 0.45,
                  transform: selected.status === s ? 'scale(1.05)' : 'scale(1)',
                  transition: 'all .15s',
                }}
              >{STATUS_LABEL[s]}</button>
            ))}
          </div>
        </div>
      </div>
    )}
  </>
  );
}

const badgeBase: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  padding: '4px 10px',
  borderRadius: 999,
  display: 'inline-block',
};

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(20,24,27,0.55)', backdropFilter: 'blur(2px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 9999,
};

const panel: React.CSSProperties = {
  width: '100%', maxWidth: 920, background: '#fff', borderRadius: 18, padding: '24px 26px 22px',
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

const drawerOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(20,24,27,0.35)',
  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
  zIndex: 10000,
};

const drawer: React.CSSProperties = {
  width: 420, height: '100vh', background: '#fff', padding: '32px 28px',
  boxShadow: '-20px 0 60px rgba(0,0,0,0.2)', fontFamily: "'Manrope', sans-serif",
  color: C.ink, overflowY: 'auto', display: 'flex', flexDirection: 'column',
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
