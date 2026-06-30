'use client';

// components/InvoicesModal.tsx
//
// Panel Facturas con rediseño completo:
//  - Lista de facturas existentes con filtro por estado
//  - Creación: template empresa (derecha) / cliente (izquierda), line items
//    con qty × precio, total auto-calculado y catálogo Stripe
// Schema: invoices(id, number, amount, status, issued_at, due_date,
//         stripe_invoice_id, created_at, client_id)
// Enum invoice_state: 'unpaid' | 'paid' | 'overdue'

import { useEffect, useRef, useState } from 'react';

const C = {
  teal: '#10BEB2', tealDeep: '#0E9E95', ink: '#222A2E', sub: '#697479',
  line: '#e7eded', bad: '#d2603a', good: '#1a9f5e', warn: '#c98a14',
  mist: '#eafaf7', paper: '#f7fee7',
};

type Status = 'unpaid' | 'paid' | 'overdue';

type Invoice = {
  id: string;
  number: string | null;
  amount: number;
  status: Status;
  issued_at: string | null;
  due_date: string | null;
  stripe_invoice_id: string | null;
  created_at: string;
  client_id: string | null;
  clients: { company_name: string; email: string | null } | null;
};

type ClientOption = {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
};

type StripeProduct = {
  id: string;
  name: string;
  description: string | null;
  prices: { id: string; unit_amount: number; currency: string }[];
};

type LineItem = { description: string; qty: number; unit_price: number };

const STATUS_LABEL: Record<Status, string> = { unpaid: 'Unpaid', paid: 'Paid', overdue: 'Overdue' };

function statusStyle(s: Status): React.CSSProperties {
  const m: Record<Status, { background: string; color: string }> = {
    unpaid: { background: '#fff4e0', color: C.warn },
    paid:   { background: '#e7f7ee', color: C.good },
    overdue: { background: '#fdecec', color: C.bad },
  };
  return { ...badge, ...(m[s] ?? { background: '#f0f2f2', color: C.sub }) };
}

function money(n: number): string {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n); }
  catch { return `$${Number(n).toFixed(2)}`; }
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}

// ── Views ─────────────────────────────────────────────────────────────────────
type View = 'list' | 'create';

export default function InvoicesModal() {
  const [open, setOpen]       = useState(false);
  const [view, setView]       = useState<View>('list');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Data
  const [invoices, setInvoices]   = useState<Invoice[]>([]);
  const [clients, setClients]     = useState<ClientOption[]>([]);
  const [products, setProducts]   = useState<StripeProduct[]>([]);
  const [filterStatus, setFilterStatus] = useState<Status | ''>('');

  // New invoice form
  const [lines, setLines]           = useState<LineItem[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [invoiceNum, setInvoiceNum] = useState('');
  const [issuedAt, setIssuedAt]     = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate]       = useState('');
  const [catalogIdx, setCatalogIdx] = useState('');

  const loadedRef = useRef(false);

  // ── Sidebar hook ────────────────────────────────────────────────────────────
  useEffect(() => {
    function findLink(): HTMLElement | null {
      const links = Array.from(document.querySelectorAll('.side a'));
      return (links.find((a) => {
        const t = (a.textContent || '').replace(/\d+/g, '').trim().toLowerCase();
        return t === 'invoices & payments' || t === 'invoices';
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

  // ── Data loading ────────────────────────────────────────────────────────────
  async function loadAll() {
    setLoading(true); setError(null);
    try {
      const [iRes, cRes, pRes] = await Promise.all([
        fetch('/api/invoices'),
        fetch('/api/clients'),
        fetch('/api/stripe/products'),
      ]);
      const iJson = await iRes.json();
      if (!iRes.ok) throw new Error(iJson?.error || 'Could not load invoices.');
      setInvoices(Array.isArray(iJson.invoices) ? iJson.invoices : []);
      if (cRes.ok) { const j = await cRes.json(); setClients(Array.isArray(j.clients) ? j.clients : []); }
      if (pRes.ok) { const j = await pRes.json(); setProducts(Array.isArray(j.products) ? j.products : []); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.');
    } finally { setLoading(false); }
  }

  // ── Line items ───────────────────────────────────────────────────────────────
  function addEmptyLine() {
    setLines((prev) => [...prev, { description: '', qty: 1, unit_price: 0 }]);
  }

  function addFromCatalog(idx: string) {
    const i = parseInt(idx);
    if (isNaN(i) || !products[i]) return;
    const p = products[i];
    const price = p.prices[0] ? p.prices[0].unit_amount / 100 : 0;
    setLines((prev) => [...prev, { description: p.name, qty: 1, unit_price: price }]);
    setCatalogIdx('');
  }

  function updateLine(i: number, field: keyof LineItem, val: string) {
    setLines((prev) => prev.map((ln, idx) =>
      idx !== i ? ln : { ...ln, [field]: field === 'description' ? val : parseFloat(val) || 0 }
    ));
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const total = lines.reduce((s, ln) => s + ln.qty * ln.unit_price, 0);

  // ── Save invoice ─────────────────────────────────────────────────────────────
  async function saveInvoice() {
    if (!selectedClient || lines.length === 0 || saving) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClient,
          number: invoiceNum.trim() || null,
          amount: total,
          issued_at: issuedAt || null,
          due_date: dueDate || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could not create invoice.');
      setInvoices((prev) => [json.invoice as Invoice, ...prev]);
      resetForm();
      setView('list');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.');
    } finally { setSaving(false); }
  }

  function resetForm() {
    setLines([]); setSelectedClient(''); setInvoiceNum('');
    setIssuedAt(new Date().toISOString().split('T')[0]); setDueDate(''); setCatalogIdx('');
  }

  // ── Status change ────────────────────────────────────────────────────────────
  async function changeStatus(id: string, status: Status) {
    const prev = invoices;
    setInvoices((is) => is.map((i) => (i.id === id ? { ...i, status } : i)));
    try {
      const res = await fetch('/api/invoices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j?.error || 'Could not update.'); }
    } catch (err) {
      setInvoices(prev);
      setError(err instanceof Error ? err.message : 'Error updating status.');
    }
  }

  if (!open) return null;

  const client = clients.find((c) => c.id === selectedClient) ?? null;
  const filtered = filterStatus ? invoices.filter((i) => i.status === filterStatus) : invoices;
  const totalPaid    = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
  const totalPending = invoices.filter((i) => i.status === 'unpaid').reduce((s, i) => s + Number(i.amount), 0);

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div style={overlay} onClick={() => { setOpen(false); setView('list'); resetForm(); }}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>

        {/* ─── Header ─────────────────────────────────────────────────────── */}
        <div style={head}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {view === 'create' && (
              <button style={backBtn} onClick={() => { setView('list'); resetForm(); setError(null); }}>← Back</button>
            )}
            <div>
              <h3 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em' }}>
                {view === 'list' ? 'Invoices & Payments' : 'New Invoice'}
              </h3>
              {view === 'list' && (
                <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>
                  {loading ? 'Loading…' : `${invoices.length} invoices · ${money(totalPaid)} collected · ${money(totalPending)} pending`}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {view === 'list' && (
              <button style={newBtn} onClick={() => { setView('create'); setError(null); }}>+ New Invoice</button>
            )}
            {view === 'create' && (
              <button
                style={{ ...newBtn, opacity: (selectedClient && lines.length > 0 && !saving) ? 1 : 0.45 }}
                onClick={saveInvoice}
                disabled={!selectedClient || lines.length === 0 || saving}
              >
                {saving ? 'Saving…' : 'Save Invoice'}
              </button>
            )}
            <button style={xBtn} onClick={() => { setOpen(false); setView('list'); resetForm(); }} aria-label="Close">×</button>
          </div>
        </div>

        {error && <div style={errBox}>{error}</div>}

        {/* ─── LIST VIEW ───────────────────────────────────────────────────── */}
        {view === 'list' && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              {(['', 'unpaid', 'paid', 'overdue'] as (Status | '')[]).map((s) => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{
                  padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                  background: filterStatus === s ? C.teal : C.mist,
                  color: filterStatus === s ? '#fff' : C.tealDeep,
                }}>
                  {s === '' ? 'All' : STATUS_LABEL[s]}
                </button>
              ))}
            </div>

            {!loading && filtered.length === 0 && (
              <div style={emptyBox}>No invoices yet. Click &quot;+ New Invoice&quot; to create one.</div>
            )}

            {(loading || filtered.length > 0) && (
              <div style={tableWrap}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Invoice #', 'Client', 'Amount', 'Issued', 'Due', 'Status'].map((h) => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td style={td} colSpan={6}>Loading…</td></tr>
                    ) : filtered.map((inv) => (
                      <tr key={inv.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                        <td style={{ ...td, fontWeight: 700 }}>{inv.number || '—'}</td>
                        <td style={td}>{inv.clients?.company_name || '—'}</td>
                        <td style={{ ...td, fontWeight: 700 }}>{money(Number(inv.amount))}</td>
                        <td style={{ ...td, color: C.sub }}>{fmt(inv.issued_at)}</td>
                        <td style={{ ...td, color: C.sub }}>{fmt(inv.due_date)}</td>
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ─── CREATE VIEW ─────────────────────────────────────────────────── */}
        {view === 'create' && (
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Invoice header: client left, company right */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24,
              padding: '20px 22px', background: C.paper,
              borderRadius: 14, border: `1px solid #d9f99d`,
            }}>
              {/* Left — Bill To */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#65A30D', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Bill To</div>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  style={{ ...inp, width: '100%', marginBottom: 10, borderColor: '#d9f99d' }}
                >
                  <option value="">Select client *</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
                {client && (
                  <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.65 }}>
                    <strong>{client.company_name}</strong>
                    {client.contact_name && <><br />{client.contact_name}</>}
                    {client.email && <><br /><span style={{ color: C.tealDeep }}>{client.email}</span></>}
                  </div>
                )}
              </div>

              {/* Right — Company */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: C.ink, marginBottom: 2 }}>Amazing Business Hub</div>
                <div style={{ fontSize: 12.5, color: C.sub }}>admin@amazingbusinesshub.com</div>
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#65A30D', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Invoice #</div>
                  <input
                    value={invoiceNum}
                    onChange={(e) => setInvoiceNum(e.target.value)}
                    placeholder="INV-001"
                    style={{ ...inp, width: 150, textAlign: 'right', borderColor: '#d9f99d' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12, textAlign: 'left' }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.sub, marginBottom: 4 }}>Issue Date</div>
                    <input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} style={{ ...inp, width: '100%', fontSize: 12, borderColor: '#d9f99d' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.sub, marginBottom: 4 }}>Due Date</div>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ ...inp, width: '100%', fontSize: 12, borderColor: '#d9f99d' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Line items */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>Line Items</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {products.length > 0 && (
                    <select
                      value={catalogIdx}
                      onChange={(e) => { addFromCatalog(e.target.value); }}
                      style={{ ...inp, fontSize: 12.5, height: 34 }}
                    >
                      <option value="">+ From Stripe catalog</option>
                      {products.map((p, i) => {
                        const price = p.prices[0] ? (p.prices[0].unit_amount / 100).toFixed(2) : '0.00';
                        return <option key={p.id} value={i}>{p.name} — ${price}</option>;
                      })}
                    </select>
                  )}
                  <button onClick={addEmptyLine} style={addLineBtn}>+ Add Line</button>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.line}` }}>
                    <th style={{ ...th, position: 'static' }}>Description</th>
                    <th style={{ ...th, position: 'static', width: 65, textAlign: 'right' }}>Qty</th>
                    <th style={{ ...th, position: 'static', width: 115, textAlign: 'right' }}>Unit Price</th>
                    <th style={{ ...th, position: 'static', width: 100, textAlign: 'right' }}>Subtotal</th>
                    <th style={{ width: 30 }} />
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: C.sub, fontSize: 13 }}>
                      No lines yet. Click &laquo;+ Add Line&raquo; or pick from the Stripe catalog.
                    </td></tr>
                  ) : lines.map((ln, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.line}` }}>
                      <td style={{ padding: '7px 4px 7px 0' }}>
                        <input
                          value={ln.description}
                          onChange={(e) => updateLine(i, 'description', e.target.value)}
                          placeholder="Service or item description"
                          style={{ ...inp, width: '100%', height: 36 }}
                        />
                      </td>
                      <td style={{ padding: '7px 4px' }}>
                        <input
                          type="number" min="1" value={ln.qty}
                          onChange={(e) => updateLine(i, 'qty', e.target.value)}
                          style={{ ...inp, width: 56, height: 36, textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ padding: '7px 4px' }}>
                        <input
                          type="number" min="0" step="0.01" value={ln.unit_price.toFixed(2)}
                          onChange={(e) => updateLine(i, 'unit_price', e.target.value)}
                          style={{ ...inp, width: 100, height: 36, textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ padding: '7px 4px', textAlign: 'right', fontWeight: 700, fontSize: 13.5, color: C.ink }}>
                        {money(ln.qty * ln.unit_price)}
                      </td>
                      <td style={{ padding: '7px 4px', textAlign: 'center' }}>
                        <button onClick={() => removeLine(i)} style={{ background: 'none', border: 'none', color: C.bad, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14, paddingTop: 14, borderTop: `2px solid ${C.line}` }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10.5, color: C.sub, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>Total</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em' }}>{money(total)}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const badge: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, display: 'inline-block' };

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(20,24,27,0.55)', backdropFilter: 'blur(2px)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  padding: '40px 20px', zIndex: 9999, overflowY: 'auto',
};

const panel: React.CSSProperties = {
  width: '100%', maxWidth: 1020, background: '#fff', borderRadius: 18,
  padding: '24px 26px 26px', boxShadow: '0 30px 70px rgba(0,0,0,0.35)',
  fontFamily: "'Manrope', sans-serif", color: C.ink,
  display: 'flex', flexDirection: 'column', gap: 0,
  minHeight: 0,
};

const head: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 };
const xBtn: React.CSSProperties = { border: 'none', background: 'transparent', fontSize: 26, lineHeight: 1, color: C.sub, cursor: 'pointer', padding: 0 };
const backBtn: React.CSSProperties = { border: `1px solid ${C.line}`, background: '#fff', borderRadius: 9, padding: '5px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: C.ink };
const newBtn: React.CSSProperties = { height: 38, padding: '0 16px', borderRadius: 10, background: C.teal, color: '#fff', fontWeight: 800, fontSize: 13.5, border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'opacity .15s' };
const addLineBtn: React.CSSProperties = { height: 34, padding: '0 14px', borderRadius: 8, border: `1px solid ${C.teal}`, color: C.tealDeep, background: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const tableWrap: React.CSSProperties = { border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'auto', flex: 1, minHeight: 0 };
const inp: React.CSSProperties = { height: 38, border: `1px solid ${C.line}`, borderRadius: 9, padding: '0 10px', fontSize: 13.5, fontFamily: 'inherit', outline: 'none', background: '#fff', color: C.ink, boxSizing: 'border-box' };
const th: React.CSSProperties = { textAlign: 'left', fontSize: 10.5, fontWeight: 800, color: C.sub, textTransform: 'uppercase', letterSpacing: '.04em', padding: '11px 10px', position: 'sticky', top: 0, background: '#fff', borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '11px 10px', fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', verticalAlign: 'middle' };
const errBox: React.CSSProperties = { background: '#fdecec', color: C.bad, fontSize: 13, fontWeight: 600, padding: '10px 12px', borderRadius: 10, marginBottom: 14, lineHeight: 1.45 };
const emptyBox: React.CSSProperties = { background: C.mist, color: C.tealDeep, fontSize: 13.5, fontWeight: 600, padding: '20px', borderRadius: 12, lineHeight: 1.5, textAlign: 'center' };
