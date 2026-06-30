'use client';

// components/InvoicesModal.tsx
//
// Seccion Facturas. Mismo patron que los demas paneles:
//  - Se engancha al link "Invoices & Payments" del sidebar.
//  - Lista facturas desde /api/invoices, permite crear, cambiar estado, y
//    generar el link de pago de Stripe (boton que se activa con las llaves).

import { useEffect, useRef, useState } from 'react';

const C = {
  teal: '#10BEB2', tealDeep: '#0E9E95', ink: '#222A2E', sub: '#697479',
  line: '#e7eded', bad: '#d2603a', good: '#1a9f5e', warn: '#c98a14', mist: '#eafaf7',
};

type Status = 'borrador' | 'enviada' | 'pagada' | 'cancelada';

type Invoice = {
  id: string;
  description: string | null;
  amount: number;
  currency: string;
  status: Status;
  hosted_invoice_url: string | null;
  created_at: string;
  client_id: string | null;
  clients: { company_name: string; email: string | null } | null;
};

type ClientOption = { id: string; company_name: string };

const STATUS_LABEL: Record<Status, string> = {
  borrador: 'Borrador', enviada: 'Enviada', pagada: 'Pagada', cancelada: 'Cancelada',
};

function statusStyle(s: Status): React.CSSProperties {
  const map: Record<Status, { background: string; color: string }> = {
    borrador: { background: '#f0f2f2', color: C.sub },
    enviada: { background: '#fff4e0', color: C.warn },
    pagada: { background: '#e7f7ee', color: C.good },
    cancelada: { background: '#fdecec', color: C.bad },
  };
  return { ...badgeBase, ...map[s] };
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es', { style: 'currency', currency: (currency || 'usd').toUpperCase() }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function InvoicesModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [clientId, setClientId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('usd');

  const loadedRef = useRef(false);

  useEffect(() => {
    function findLink(): HTMLElement | null {
      const links = Array.from(document.querySelectorAll('.side a'));
      return (links.find((a) => {
        const t = (a.textContent || '').trim().toLowerCase();
        return t === 'invoices & payments' || t === 'invoices' || t.startsWith('invoices');
      }) as HTMLElement) || null;
    }
    let bound: HTMLElement | null = null;
    const onClick = (e: Event) => { e.preventDefault(); setOpen(true); };
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
    return () => { obs.disconnect(); if (bound) bound.removeEventListener('click', onClick); };
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
      const [iRes, cRes] = await Promise.all([
        fetch('/api/invoices', { method: 'GET' }),
        fetch('/api/clients', { method: 'GET' }),
      ]);
      const iJson = await iRes.json();
      if (!iRes.ok) throw new Error(iJson?.error || 'No se pudieron cargar las facturas.');
      setInvoices(Array.isArray(iJson.invoices) ? iJson.invoices : []);
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

  async function createInvoice() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId || null,
          description: description.trim() || null,
          amount: amt,
          currency,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'No se pudo crear la factura.');
      setInvoices((prev) => [json.invoice as Invoice, ...prev]);
      setClientId(''); setDescription(''); setAmount(''); setCurrency('usd');
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setSaving(false);
    }
  }

  async function generateLink(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch('/api/invoices/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'No se pudo generar el link.');
      setInvoices((prev) => prev.map((inv) =>
        inv.id === id ? { ...inv, hosted_invoice_url: json.hosted_invoice_url, status: json.status || 'enviada' } : inv
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error con Stripe.');
    } finally {
      setBusyId(null);
    }
  }

  async function changeStatus(id: string, status: Status) {
    const prev = invoices;
    setInvoices((is) => is.map((i) => (i.id === id ? { ...i, status } : i)));
    try {
      const res = await fetch('/api/invoices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error || 'No se pudo actualizar.');
      }
    } catch (err) {
      setInvoices(prev);
      setError(err instanceof Error ? err.message : 'Error al actualizar.');
    }
  }

  if (!open) return null;

  const totalPagado = invoices.filter((i) => i.status === 'pagada').reduce((s, i) => s + Number(i.amount), 0);
  const pendiente = invoices.filter((i) => i.status === 'enviada').reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div style={overlay} onClick={() => setOpen(false)}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <div>
            <h3 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em' }}>Facturas y Pagos</h3>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>
              {loading ? 'Cargando…' : `${invoices.length} facturas · ${money(totalPagado, 'usd')} cobrado · ${money(pendiente, 'usd')} pendiente`}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button style={newBtn} onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Cerrar' : '+ Nueva factura'}
            </button>
            <button style={x} onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
          </div>
        </div>

        {showForm && (
          <div style={formBox}>
            <div style={{ display: 'flex', gap: 10 }}>
              <select style={{ ...input, flex: 1 }} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">— Cliente (opcional) —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
              <input style={{ ...input, width: 140 }} type="number" min="0" step="0.01" placeholder="Monto *" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <select style={{ ...input, width: 110 }} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="usd">USD</option>
                <option value="cad">CAD</option>
                <option value="eur">EUR</option>
                <option value="mxn">MXN</option>
              </select>
            </div>
            <input style={input} placeholder="Descripción (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <button style={{ ...saveBtn, opacity: Number(amount) > 0 && !saving ? 1 : 0.5 }} onClick={createInvoice} disabled={!(Number(amount) > 0) || saving}>
              {saving ? 'Guardando…' : 'Crear factura'}
            </button>
          </div>
        )}

        {error && <div style={errBox}>{error}</div>}

        {!error && !loading && invoices.length === 0 && (
          <div style={emptyBox}>No hay facturas todavía. Crea la primera con "+ Nueva factura".</div>
        )}

        {(loading || invoices.length > 0) && (
          <div style={tableWrap}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Cliente</th>
                  <th style={th}>Descripción</th>
                  <th style={th}>Monto</th>
                  <th style={th}>Fecha</th>
                  <th style={th}>Pago</th>
                  <th style={th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td style={td} colSpan={6}>Cargando…</td></tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td style={{ ...td, fontWeight: 700 }}>{inv.clients?.company_name || '—'}</td>
                      <td style={{ ...td, color: C.sub, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.description || '—'}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{money(Number(inv.amount), inv.currency)}</td>
                      <td style={{ ...td, color: C.sub }}>{fmtDate(inv.created_at)}</td>
                      <td style={td}>
                        {inv.hosted_invoice_url ? (
                          <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" style={linkBtn}>Ver link ↗</a>
                        ) : inv.status === 'pagada' || inv.status === 'cancelada' ? (
                          <span style={{ color: C.sub, fontSize: 12.5 }}>—</span>
                        ) : (
                          <button style={payBtn} onClick={() => generateLink(inv.id)} disabled={busyId === inv.id}>
                            {busyId === inv.id ? 'Generando…' : 'Generar link'}
                          </button>
                        )}
                      </td>
                      <td style={td}>
                        <select
                          style={{ ...statusStyle(inv.status), border: 'none', cursor: 'pointer', appearance: 'none', paddingRight: 22 }}
                          value={inv.status}
                          onChange={(e) => changeStatus(inv.id, e.target.value as Status)}
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

const badgeBase: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, display: 'inline-block' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(20,24,27,0.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 9999 };
const panel: React.CSSProperties = { width: '100%', maxWidth: 980, background: '#fff', borderRadius: 18, padding: '24px 26px 22px', boxShadow: '0 30px 70px rgba(0,0,0,0.35)', fontFamily: "'Manrope', sans-serif", color: C.ink, maxHeight: '88vh', display: 'flex', flexDirection: 'column' };
const head: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 };
const x: React.CSSProperties = { border: 'none', background: 'transparent', fontSize: 26, lineHeight: 1, color: C.sub, cursor: 'pointer', padding: 0 };
const newBtn: React.CSSProperties = { height: 40, padding: '0 15px', borderRadius: 11, background: C.teal, color: '#fff', fontWeight: 800, fontSize: 13.5, border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const formBox: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: '#fafdfc', border: `1px solid ${C.line}`, borderRadius: 14, marginBottom: 16 };
const input: React.CSSProperties = { height: 42, border: `1px solid ${C.line}`, borderRadius: 11, padding: '0 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff', color: C.ink };
const saveBtn: React.CSSProperties = { height: 44, border: 'none', borderRadius: 11, background: C.teal, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' };
const tableWrap: React.CSSProperties = { border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'auto', flex: 1, minHeight: 0 };
const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 800, color: C.sub, textTransform: 'uppercase', letterSpacing: '.04em', padding: '12px 12px', position: 'sticky', top: 0, background: '#fff', borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '11px 12px', borderTop: `1px solid ${C.line}`, fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' };
const payBtn: React.CSSProperties = { height: 32, padding: '0 12px', borderRadius: 9, background: '#635bff', color: '#fff', fontWeight: 700, fontSize: 12.5, border: 'none', cursor: 'pointer', fontFamily: 'inherit' };
const linkBtn: React.CSSProperties = { color: '#635bff', fontWeight: 700, fontSize: 12.5, textDecoration: 'none' };
const errBox: React.CSSProperties = { background: '#fdecec', color: C.bad, fontSize: 13, fontWeight: 600, padding: '10px 12px', borderRadius: 10, marginBottom: 14, lineHeight: 1.45 };
const emptyBox: React.CSSProperties = { background: C.mist, color: C.tealDeep, fontSize: 13.5, fontWeight: 600, padding: '16px', borderRadius: 12, lineHeight: 1.5 };
