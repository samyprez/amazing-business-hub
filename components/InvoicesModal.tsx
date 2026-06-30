'use client';

// components/InvoicesModal.tsx
//
// Panel Facturas. Se engancha al link "Invoices & Payments" del sidebar.
// Schema real: invoices(id, number, amount, status, issued_at, due_date,
//              stripe_invoice_id, created_at, client_id)
// Enum invoice_state: 'unpaid' | 'paid' | 'overdue'

import { useEffect, useRef, useState } from 'react';

const C = {
  teal: '#10BEB2', tealDeep: '#0E9E95', ink: '#222A2E', sub: '#697479',
  line: '#e7eded', bad: '#d2603a', good: '#1a9f5e', warn: '#c98a14', mist: '#eafaf7',
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

type ClientOption = { id: string; company_name: string };

const STATUS_LABEL: Record<Status, string> = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  overdue: 'Overdue',
};

function statusStyle(s: Status): React.CSSProperties {
  const map: Record<Status, { background: string; color: string }> = {
    unpaid: { background: '#fff4e0', color: C.warn },
    paid:   { background: '#e7f7ee', color: C.good },
    overdue: { background: '#fdecec', color: C.bad },
  };
  return { ...badgeBase, ...(map[s] ?? { background: '#f0f2f2', color: C.sub }) };
}

function money(amount: number): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  } catch {
    return `$${Number(amount).toFixed(2)}`;
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

  const [clientId, setClientId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');

  const loadedRef = useRef(false);

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

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [iRes, cRes] = await Promise.all([
        fetch('/api/invoices'),
        fetch('/api/clients'),
      ]);
      const iJson = await iRes.json();
      if (!iRes.ok) throw new Error(iJson?.error || 'Could not load invoices.');
      setInvoices(Array.isArray(iJson.invoices) ? iJson.invoices : []);
      if (cRes.ok) {
        const cJson = await cRes.json();
        setClients(Array.isArray(cJson.clients) ? cJson.clients : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.');
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
          number: invoiceNumber.trim() || null,
          amount: amt,
          due_date: dueDate || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could not create invoice.');
      setInvoices((prev) => [json.invoice as Invoice, ...prev]);
      setClientId(''); setInvoiceNumber(''); setAmount(''); setDueDate('');
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.');
    } finally {
      setSaving(false);
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
        throw new Error(json?.error || 'Could not update.');
      }
    } catch (err) {
      setInvoices(prev);
      setError(err instanceof Error ? err.message : 'Error updating status.');
    }
  }

  if (!open) return null;

  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
  const totalPending = invoices.filter((i) => i.status === 'unpaid').reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div style={overlay} onClick={() => setOpen(false)}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <div>
            <h3 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em' }}>Invoices & Payments</h3>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>
              {loading ? 'Loading…' : `${invoices.length} invoices · ${money(totalPaid)} collected · ${money(totalPending)} pending`}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button style={newBtn} onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Close' : '+ New Invoice'}
            </button>
            <button style={x} onClick={() => setOpen(false)} aria-label="Close">×</button>
          </div>
        </div>

        {showForm && (
          <div style={formBox}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <select style={{ ...input, flex: 1, minWidth: 180 }} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">— Client (optional) —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
              <input style={{ ...input, width: 130 }} placeholder="Invoice # (optional)" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input style={{ ...input, width: 150 }} type="number" min="0" step="0.01" placeholder="Amount (USD) *" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 12.5, color: C.sub, whiteSpace: 'nowrap' }}>Due date:</label>
                <input style={{ ...input, width: 160 }} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            <button
              style={{ ...saveBtn, opacity: Number(amount) > 0 && !saving ? 1 : 0.5 }}
              onClick={createInvoice}
              disabled={!(Number(amount) > 0) || saving}
            >
              {saving ? 'Saving…' : 'Create Invoice'}
            </button>
          </div>
        )}

        {error && <div style={errBox}>{error}</div>}

        {!error && !loading && invoices.length === 0 && (
          <div style={emptyBox}>No invoices yet. Create the first one with &quot;+ New Invoice&quot;.</div>
        )}

        {(loading || invoices.length > 0) && (
          <div style={tableWrap}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Invoice #</th>
                  <th style={th}>Client</th>
                  <th style={th}>Amount</th>
                  <th style={th}>Issued</th>
                  <th style={th}>Due</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td style={td} colSpan={6}>Loading…</td></tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td style={{ ...td, fontWeight: 700 }}>{inv.number || '—'}</td>
                      <td style={{ ...td }}>{inv.clients?.company_name || '—'}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{money(Number(inv.amount))}</td>
                      <td style={{ ...td, color: C.sub }}>{fmtDate(inv.issued_at)}</td>
                      <td style={{ ...td, color: C.sub }}>{fmtDate(inv.due_date)}</td>
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

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(20,24,27,0.55)', backdropFilter: 'blur(2px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 9999,
};

const panel: React.CSSProperties = {
  width: '100%', maxWidth: 980, background: '#fff', borderRadius: 18, padding: '24px 26px 22px',
  boxShadow: '0 30px 70px rgba(0,0,0,0.35)', fontFamily: "'Manrope', sans-serif", color: C.ink,
  maxHeight: '88vh', display: 'flex', flexDirection: 'column',
};

const head: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 };
const x: React.CSSProperties = { border: 'none', background: 'transparent', fontSize: 26, lineHeight: 1, color: C.sub, cursor: 'pointer', padding: 0 };
const newBtn: React.CSSProperties = { height: 40, padding: '0 15px', borderRadius: 11, background: C.teal, color: '#fff', fontWeight: 800, fontSize: 13.5, border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const formBox: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: '#fafdfc', border: `1px solid ${C.line}`, borderRadius: 14, marginBottom: 16 };
const input: React.CSSProperties = { height: 42, border: `1px solid ${C.line}`, borderRadius: 11, padding: '0 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff', color: C.ink };
const saveBtn: React.CSSProperties = { height: 44, border: 'none', borderRadius: 11, background: C.teal, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' };
const tableWrap: React.CSSProperties = { border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'auto', flex: 1, minHeight: 0 };
const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 800, color: C.sub, textTransform: 'uppercase', letterSpacing: '.04em', padding: '12px 12px', position: 'sticky', top: 0, background: '#fff', borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '11px 12px', borderTop: `1px solid ${C.line}`, fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' };
const errBox: React.CSSProperties = { background: '#fdecec', color: C.bad, fontSize: 13, fontWeight: 600, padding: '10px 12px', borderRadius: 10, marginBottom: 14, lineHeight: 1.45 };
const emptyBox: React.CSSProperties = { background: C.mist, color: C.tealDeep, fontSize: 13.5, fontWeight: 600, padding: '16px', borderRadius: 12, lineHeight: 1.5 };
const linkBtn: React.CSSProperties = { color: C.tealDeep, fontWeight: 700, textDecoration: 'none', fontSize: 12.5 };
