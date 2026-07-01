'use client';

// components/InvoicesModal.tsx — Invoices & Payments
// Features: currency (CAD/USD), tax (13%/6%), line items, Stripe catalog,
// edit existing invoices, print/PDF with logo + footer + payment methods.

import { useEffect, useRef, useState } from 'react';

const C = {
  teal: '#10BEB2', tealDeep: '#0E9E95', ink: '#222A2E', sub: '#697479',
  line: '#e7eded', bad: '#d2603a', good: '#1a9f5e', warn: '#c98a14', mist: '#eafaf7',
};

type Status = 'unpaid' | 'paid' | 'overdue';
type Currency = 'CAD' | 'USD';

type Invoice = {
  id: string; number: string | null; amount: number; status: Status;
  issued_at: string | null; due_date: string | null; stripe_invoice_id: string | null;
  created_at: string; client_id: string | null;
  clients: { company_name: string; email: string | null } | null;
};

type ClientOption = { id: string; company_name: string; contact_name: string | null; email: string | null };
type StripeProduct = { id: string; name: string; description: string | null; prices: { id: string; unit_amount: number; currency: string }[] };
type LineItem = { description: string; qty: number; unit_price: number };
type View = 'list' | 'create' | 'edit';

const STATUS_LABEL: Record<Status, string> = { unpaid: 'Unpaid', paid: 'Paid', overdue: 'Overdue' };
const TAX_RATE: Record<Currency, number> = { CAD: 0.13, USD: 0.06 };
const TAX_LABEL: Record<Currency, string> = { CAD: 'HST (13%)', USD: 'Tax (6%)' };

function statusStyle(s: Status): React.CSSProperties {
  const m: Record<Status, { background: string; color: string }> = {
    unpaid: { background: '#fff4e0', color: C.warn },
    paid:   { background: '#e7f7ee', color: C.good },
    overdue: { background: '#fdecec', color: C.bad },
  };
  return { ...badge, ...(m[s] ?? { background: '#f0f2f2', color: C.sub }) };
}

function money(n: number, cur: Currency = 'CAD'): string {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n); }
  catch { return `$${Number(n).toFixed(2)}`; }
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}

// ── Print / PDF ────────────────────────────────────────────────────────────────
function printInvoice(inv: Invoice, lines: LineItem[], currency: Currency) {
  const client = inv.clients;
  const subtotal = lines.length > 0
    ? lines.reduce((s, ln) => s + ln.qty * ln.unit_price, 0)
    : Number(inv.amount);
  const taxAmt  = subtotal * TAX_RATE[currency];
  const total   = subtotal + taxAmt;

  const linesHtml = lines.length > 0
    ? lines.map((ln) => `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #e7eded;vertical-align:top">
            <div style="font-weight:700;font-size:13px">${ln.description || '—'}</div>
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid #e7eded;text-align:center">${ln.qty}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e7eded;text-align:right">${money(ln.unit_price, currency)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e7eded;text-align:right;font-weight:700">${money(ln.qty * ln.unit_price, currency)}</td>
        </tr>`).join('')
    : `<tr><td colspan="4" style="padding:10px 8px;border-bottom:1px solid #e7eded;color:#697479">Services rendered</td></tr>`;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const w = window.open('', '_blank', 'width=860,height=1100');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Invoice ${inv.number || inv.id.slice(0, 8)}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;background:#fff;padding:44px 52px;font-size:13px;line-height:1.5}
    @media print{body{padding:28px 36px}@page{margin:0}}
    .top-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px}
    .company-name{font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#1a1a1a}
    .company-sub{font-size:11.5px;color:#555;margin-top:3px;line-height:1.6}
    .inv-title{font-size:38px;font-weight:900;letter-spacing:-.02em;color:#1a1a1a;text-align:right}
    .bill-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;gap:24px}
    .bill-to{flex:1}
    .bill-label{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#888;margin-bottom:6px}
    .bill-name{font-size:14px;font-weight:800}
    .bill-info{font-size:12px;color:#555;margin-top:2px}
    .inv-details{min-width:260px}
    .det-table{width:100%;border-collapse:collapse}
    .det-table td{padding:4px 0;font-size:12px}
    .det-table td:first-child{color:#555;padding-right:16px}
    .det-table td:last-child{text-align:right;font-weight:600}
    table.items{width:100%;border-collapse:collapse;margin-bottom:0}
    table.items thead tr{background:#c9a227;color:#fff}
    table.items thead td{padding:9px 10px;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
    table.items thead td:not(:first-child){text-align:center}
    table.items thead td:last-child{text-align:right}
    .tot-table{width:100%;border-collapse:collapse}
    .tot-table td{padding:5px 0;font-size:13px}
    .tot-table td:last-child{text-align:right;font-weight:600}
    .tot-table tr.grand td{font-size:15px;font-weight:900;padding-top:10px;border-top:2px solid #1a1a1a}
    .tot-table tr.grand td:first-child{color:#1a1a1a}
    .footer-note{margin-top:28px;padding:12px 14px;background:#f9f9f9;border-radius:6px;font-size:11px;color:#555;line-height:1.7}
    .footer-note strong{color:#1a1a1a}
    .logo{width:80px;object-fit:contain}
    .divider{border:none;border-top:1px solid #e0e0e0;margin:20px 0}
    .amount-due-box{background:#1a1a1a;color:#fff;padding:10px 16px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;margin-top:10px}
    .amount-due-box span:first-child{font-size:13px;font-weight:700}
    .amount-due-box span:last-child{font-size:18px;font-weight:900}
  </style>
  </head><body>

  <!-- Header -->
  <div class="top-row">
    <div>
      <img class="logo" src="${origin}/mark-teal.png" alt="Amazing Solutions Logo" onerror="this.style.display='none'" />
      <div style="margin-top:10px">
        <div class="company-name">Amazing Solutions Canada</div>
        <div class="company-sub">
          21 Rubydale Gardens<br>
          HST/GST # 753961143RT0001<br>
          Toronto, Ontario M9L1B8, Canada<br>
          6474692835 · www.amazingsolutions.ca
        </div>
      </div>
    </div>
    <div style="text-align:right">
      <div class="inv-title">INVOICE</div>
    </div>
  </div>

  <hr class="divider">

  <!-- Bill To + Invoice Details -->
  <div class="bill-row">
    <div class="bill-to">
      <div class="bill-label">Bill to</div>
      ${client ? `
        <div class="bill-name">${client.company_name}</div>
        ${client.email ? `<div class="bill-info">${client.email}</div>` : ''}
      ` : '<div class="bill-name">—</div>'}
    </div>
    <div class="inv-details">
      <table class="det-table">
        <tr><td>Invoice Number:</td><td>${inv.number ? `GI-${inv.number}` : '—'}</td></tr>
        <tr><td>Invoice Date:</td><td>${fmt(inv.issued_at)}</td></tr>
        <tr><td>Payment Date:</td><td>${inv.due_date ? fmt(inv.due_date) : '—'}</td></tr>
        <tr><td>Amount Due (${currency}):</td><td style="color:#c9a227;font-weight:800">${money(total, currency)}</td></tr>
      </table>
    </div>
  </div>

  <!-- Items Table -->
  <table class="items">
    <thead>
      <tr>
        <td style="width:55%">Items</td>
        <td style="width:10%;text-align:center">Quantity</td>
        <td style="width:17%;text-align:right">Price</td>
        <td style="width:18%;text-align:right">Amount</td>
      </tr>
    </thead>
    <tbody>${linesHtml}</tbody>
  </table>

  <hr class="divider">

  <!-- Totals -->
  <div style="display:flex;justify-content:flex-end">
    <div style="min-width:280px">
      <table class="tot-table">
        <tr><td style="color:#555">Subtotal:</td><td>${money(subtotal, currency)}</td></tr>
        <tr><td style="color:#555">${TAX_LABEL[currency]}:</td><td>${money(taxAmt, currency)}</td></tr>
        <tr><td style="color:#555">Total:</td><td>${money(total, currency)}</td></tr>
      </table>
      <div class="amount-due-box">
        <span>Amount Due (${currency}):</span>
        <span>${money(total, currency)}</span>
      </div>
    </div>
  </div>

  <!-- Payment Methods -->
  <div style="margin-top:24px;text-align:center">
    <img src="https://static.vecteezy.com/system/resources/thumbnails/039/865/653/small/mastercard-visa-apple-pay-google-pay-popular-payment-systems-finance-system-app-bank-card-illustration-free-vector.jpg"
      alt="Accepted payment methods" style="max-width:280px;height:auto;border-radius:8px" />
  </div>

  <!-- Notes / Terms -->
  <div class="footer-note">
    <strong>Notes / Terms</strong><br>
    I/we acknowledge receipt of this job at my/our full satisfaction. The total charge for this job is due and payable upon
    completion. *I/we are responsible for making sure there are no mistakes. In the event of payment not made on time,
    the account is referred to a collection agency or an attorney and the Client will pay the cost of collection including all
    attorneys and court fees.
  </div>

  <script>window.onload=()=>{window.print();}</script>
  </body></html>`);
  w.document.close();
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function InvoicesModal() {
  const [open, setOpen]       = useState(false);
  const [view, setView]       = useState<View>('list');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [invoices, setInvoices]   = useState<Invoice[]>([]);
  const [clients, setClients]     = useState<ClientOption[]>([]);
  const [products, setProducts]   = useState<StripeProduct[]>([]);
  const [filterStatus, setFilterStatus] = useState<Status | ''>('');

  // Create form
  const [lines, setLines]         = useState<LineItem[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [invoiceNum, setInvoiceNum]   = useState('');
  const [issuedAt, setIssuedAt]       = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate]         = useState('');
  const [currency, setCurrency]       = useState<Currency>('CAD');

  // Edit form
  const [editTarget, setEditTarget]   = useState<Invoice | null>(null);
  const [editNum, setEditNum]         = useState('');
  const [editDue, setEditDue]         = useState('');
  const [editStatus, setEditStatus]   = useState<Status>('unpaid');

  const loadedRef = useRef(false);

  // ── Sidebar hook ─────────────────────────────────────────────────────────────
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
    void loadAll();
  }, [open]);

  async function loadAll() {
    setLoading(true); setError(null);
    try {
      const [iRes, cRes, pRes] = await Promise.all([
        fetch('/api/invoices'), fetch('/api/clients'), fetch('/api/stripe/products'),
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

  // ── Line items ────────────────────────────────────────────────────────────────
  function addLine() { setLines((p) => [...p, { description: '', qty: 1, unit_price: 0 }]); }
  function addFromCatalog(idx: string) {
    const i = parseInt(idx); if (isNaN(i) || !products[i]) return;
    const p = products[i];
    const price = p.prices[0] ? p.prices[0].unit_amount / 100 : 0;
    setLines((prev) => [...prev, { description: p.name, qty: 1, unit_price: price }]);
  }
  function updateLine(i: number, field: keyof LineItem, val: string) {
    setLines((prev) => prev.map((ln, idx) =>
      idx !== i ? ln : { ...ln, [field]: field === 'description' ? val : parseFloat(val) || 0 }
    ));
  }
  function removeLine(i: number) { setLines((prev) => prev.filter((_, idx) => idx !== i)); }

  const subtotal = lines.reduce((s, ln) => s + ln.qty * ln.unit_price, 0);
  const taxAmt   = subtotal * TAX_RATE[currency];
  const totalAmt = subtotal + taxAmt;

  // ── Save invoice ──────────────────────────────────────────────────────────────
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
          amount: totalAmt,
          issued_at: issuedAt || null,
          due_date: dueDate || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could not create invoice.');
      setInvoices((prev) => [json.invoice as Invoice, ...prev]);
      resetCreate(); setView('list');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unexpected error.'); }
    finally { setSaving(false); }
  }

  function resetCreate() {
    setLines([]); setSelectedClient(''); setInvoiceNum('');
    setIssuedAt(new Date().toISOString().split('T')[0]); setDueDate(''); setCurrency('CAD');
  }

  // ── Edit invoice ──────────────────────────────────────────────────────────────
  function openEdit(inv: Invoice) {
    setEditTarget(inv); setEditNum(inv.number || '');
    setEditDue(inv.due_date || ''); setEditStatus(inv.status);
    setView('edit'); setError(null);
  }

  async function saveEdit() {
    if (!editTarget || saving) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/invoices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editTarget.id,
          number: editNum.trim() || null,
          due_date: editDue || null,
          status: editStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could not save.');
      setInvoices((prev) => prev.map((i) => i.id === editTarget.id ? { ...i, number: editNum.trim() || null, due_date: editDue || null, status: editStatus } : i));
      setView('list'); setEditTarget(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unexpected error.'); }
    finally { setSaving(false); }
  }

  // ── Status change (inline) ────────────────────────────────────────────────────
  async function changeStatus(id: string, status: Status) {
    const prev = invoices;
    setInvoices((is) => is.map((i) => i.id === id ? { ...i, status } : i));
    try {
      const res = await fetch('/api/invoices', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j?.error || 'Error'); }
    } catch (err) {
      setInvoices(prev);
      setError(err instanceof Error ? err.message : 'Error updating status.');
    }
  }

  // ── Update invoices API to support number/due_date in PATCH
  // (the API already handles this via body spread)

  if (!open) return null;

  const client = clients.find((c) => c.id === selectedClient) ?? null;
  const filtered = filterStatus ? invoices.filter((i) => i.status === filterStatus) : invoices;
  const totalPaid    = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
  const totalPending = invoices.filter((i) => i.status === 'unpaid').reduce((s, i) => s + Number(i.amount), 0);

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div style={overlay} onClick={() => { setOpen(false); setView('list'); resetCreate(); }}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={headStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {view !== 'list' && (
              <button style={backBtn} onClick={() => { setView('list'); resetCreate(); setEditTarget(null); setError(null); }}>← Back</button>
            )}
            <div>
              <h3 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em' }}>
                {view === 'list' ? 'Invoices & Payments' : view === 'create' ? 'New Invoice' : 'Edit Invoice'}
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
              <>
                <button style={{ ...newBtn, background: '#fff', color: C.teal, border: `1px solid ${C.teal}` }}
                  onClick={() => {
                    if (lines.length === 0) return;
                    const fakeInv: Invoice = {
                      id: '', number: invoiceNum, amount: totalAmt, status: 'unpaid',
                      issued_at: issuedAt, due_date: dueDate, stripe_invoice_id: null, created_at: '',
                      client_id: selectedClient,
                      clients: client ? { company_name: client.company_name, email: client.email } : null,
                    };
                    printInvoice(fakeInv, lines, currency);
                  }}
                  disabled={lines.length === 0}
                >
                  Print Preview
                </button>
                <button
                  style={{ ...newBtn, opacity: (selectedClient && lines.length > 0 && !saving) ? 1 : 0.45 }}
                  onClick={saveInvoice}
                  disabled={!selectedClient || lines.length === 0 || saving}
                >
                  {saving ? 'Saving…' : 'Save Invoice'}
                </button>
              </>
            )}
            {view === 'edit' && (
              <button style={{ ...newBtn, opacity: !saving ? 1 : 0.45 }} onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            )}
            <button style={xBtn} onClick={() => { setOpen(false); setView('list'); resetCreate(); }} aria-label="Close">×</button>
          </div>
        </div>

        {error && <div style={errBox}>{error}</div>}

        {/* ── LIST VIEW ─────────────────────────────────────────────────────── */}
        {view === 'list' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {(['', 'unpaid', 'paid', 'overdue'] as (Status | '')[]).map((s) => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{
                  padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                  background: filterStatus === s ? C.teal : C.mist, color: filterStatus === s ? '#fff' : C.tealDeep,
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
                    <tr>{['Invoice #', 'Client', 'Amount', 'Issued', 'Due', 'Status', ''].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {loading ? <tr><td style={td} colSpan={7}>Loading…</td></tr>
                      : filtered.map((inv) => (
                        <tr key={inv.id}>
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
                              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                            </select>
                          </td>
                          <td style={{ ...td, whiteSpace: 'nowrap' }}>
                            <button onClick={() => openEdit(inv)} style={actionBtn}>Edit</button>
                            <button onClick={() => printInvoice(inv, [], 'CAD')} style={{ ...actionBtn, marginLeft: 6 }}>PDF</button>
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── EDIT VIEW ─────────────────────────────────────────────────────── */}
        {view === 'edit' && editTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={infoBox}>
              <b>{editTarget.clients?.company_name || 'No client'}</b>
              {editTarget.clients?.email && <span style={{ color: C.sub, marginLeft: 8, fontSize: 13 }}>{editTarget.clients.email}</span>}
              <span style={{ marginLeft: 12, ...badge, background: '#e7f7ee', color: C.tealDeep, fontSize: 12 }}>
                Total: {money(Number(editTarget.amount))}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Invoice #</label>
                <input style={inp} value={editNum} onChange={(e) => setEditNum(e.target.value)} placeholder="INV-001" />
              </div>
              <div>
                <label style={lbl}>Due Date</label>
                <input style={inp} type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select style={{ ...inp, cursor: 'pointer' }} value={editStatus} onChange={(e) => setEditStatus(e.target.value as Status)}>
                  {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
            </div>
            <button
              style={{ alignSelf: 'flex-end', padding: '0 20px', height: 42, background: C.teal, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={() => printInvoice(editTarget, [], 'CAD')}
            >
              Download PDF
            </button>
          </div>
        )}

        {/* ── CREATE VIEW ───────────────────────────────────────────────────── */}
        {view === 'create' && (
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Invoice header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: '20px 22px', background: '#f7fee7', borderRadius: 14, border: '1px solid #d9f99d' }}>
              {/* Left — Bill To */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#65A30D', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Bill To</div>
                <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} style={{ ...inp, width: '100%', marginBottom: 10, borderColor: '#d9f99d' }}>
                  <option value="">Select client *</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
                {client && (
                  <div style={{ fontSize: 13.5, lineHeight: 1.65 }}>
                    <strong>{client.company_name}</strong>
                    {client.contact_name && <><br />{client.contact_name}</>}
                    {client.email && <><br /><span style={{ color: C.tealDeep }}>{client.email}</span></>}
                  </div>
                )}
              </div>

              {/* Right — Company */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginBottom: 6 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/mark-teal.png" alt="Logo" style={{ width: 36, height: 36, objectFit: 'contain' }} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>Amazing Business Hub</div>
                    <div style={{ fontSize: 12, color: C.sub }}>admin@amazingbusinesshub.com</div>
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#65A30D', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Invoice #</div>
                  <input value={invoiceNum} onChange={(e) => setInvoiceNum(e.target.value)} placeholder="INV-001" style={{ ...inp, width: 150, textAlign: 'right', borderColor: '#d9f99d' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10, textAlign: 'left' }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.sub, marginBottom: 4 }}>Issue Date</div>
                    <input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} style={{ ...inp, width: '100%', fontSize: 12, borderColor: '#d9f99d' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.sub, marginBottom: 4 }}>Due Date</div>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ ...inp, width: '100%', fontSize: 12, borderColor: '#d9f99d' }} />
                  </div>
                </div>
                <div style={{ marginTop: 10, textAlign: 'left' }}>
                  <div style={{ fontSize: 10, color: C.sub, marginBottom: 4 }}>Currency</div>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} style={{ ...inp, width: '100%', borderColor: '#d9f99d' }}>
                    <option value="CAD">CAD — Canadian Dollar</option>
                    <option value="USD">USD — US Dollar</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Line items */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>Line Items</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {products.length > 0 && (
                    <select defaultValue="" onChange={(e) => { addFromCatalog(e.target.value); e.target.value = ''; }} style={{ ...inp, fontSize: 12.5, height: 34 }}>
                      <option value="" disabled>+ From Stripe catalog</option>
                      {products.map((p, i) => {
                        const price = p.prices[0] ? (p.prices[0].unit_amount / 100).toFixed(2) : '0.00';
                        return <option key={p.id} value={i}>{p.name} — ${price}</option>;
                      })}
                    </select>
                  )}
                  <button onClick={addLine} style={addLineBtn}>+ Add Line</button>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.line}` }}>
                    <th style={{ ...th, position: 'static' }}>Description</th>
                    <th style={{ ...th, position: 'static', width: 65, textAlign: 'right' }}>Qty</th>
                    <th style={{ ...th, position: 'static', width: 120, textAlign: 'right' }}>Unit Price</th>
                    <th style={{ ...th, position: 'static', width: 110, textAlign: 'right' }}>Subtotal</th>
                    <th style={{ width: 30 }} />
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '18px', textAlign: 'center', color: C.sub, fontSize: 13 }}>
                      No lines yet — pick from catalog or click &laquo;+ Add Line&raquo;.
                    </td></tr>
                  ) : lines.map((ln, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.line}` }}>
                      <td style={{ padding: '7px 4px 7px 0' }}>
                        <input value={ln.description} onChange={(e) => updateLine(i, 'description', e.target.value)} placeholder="Description" style={{ ...inp, width: '100%', height: 36 }} />
                      </td>
                      <td style={{ padding: '7px 4px' }}>
                        <input type="number" min="1" value={ln.qty} onChange={(e) => updateLine(i, 'qty', e.target.value)} style={{ ...inp, width: 56, height: 36, textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: '7px 4px' }}>
                        <input type="number" min="0" step="0.01" value={ln.unit_price.toFixed(2)} onChange={(e) => updateLine(i, 'unit_price', e.target.value)} style={{ ...inp, width: 110, height: 36, textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: '7px 4px', textAlign: 'right', fontWeight: 700, fontSize: 13.5 }}>{money(ln.qty * ln.unit_price, currency)}</td>
                      <td style={{ padding: '7px 4px', textAlign: 'center' }}>
                        <button onClick={() => removeLine(i)} style={{ background: 'none', border: 'none', color: C.bad, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14, paddingTop: 14, borderTop: `2px solid ${C.line}` }}>
                <div style={{ minWidth: 240 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13.5 }}>
                    <span style={{ color: C.sub }}>Subtotal</span>
                    <span>{money(subtotal, currency)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13.5 }}>
                    <span style={{ color: C.sub }}>{TAX_LABEL[currency]}</span>
                    <span>{money(taxAmt, currency)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: `2px solid ${C.line}` }}>
                    <span style={{ fontSize: 14, fontWeight: 800 }}>Total</span>
                    <span style={{ fontSize: 22, fontWeight: 900, color: C.teal }}>{money(totalAmt, currency)}</span>
                  </div>
                </div>
              </div>

              {/* Payment methods notice */}
              <div style={{ marginTop: 16, padding: '10px 14px', background: C.mist, borderRadius: 10, fontSize: 12.5, color: C.tealDeep, fontWeight: 700 }}>
                ✓ We accept Visa · Mastercard · American Express · Debit or Credit Card
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
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', zIndex: 9999, overflowY: 'auto',
};
const panel: React.CSSProperties = {
  width: '100%', maxWidth: 1040, background: '#fff', borderRadius: 18, padding: '24px 26px 26px',
  boxShadow: '0 30px 70px rgba(0,0,0,0.35)', fontFamily: "'Manrope', sans-serif", color: C.ink,
  display: 'flex', flexDirection: 'column', gap: 0,
};
const headStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 };
const xBtn: React.CSSProperties = { border: 'none', background: 'transparent', fontSize: 26, lineHeight: 1, color: C.sub, cursor: 'pointer', padding: 0 };
const backBtn: React.CSSProperties = { border: `1px solid ${C.line}`, background: '#fff', borderRadius: 9, padding: '5px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: C.ink };
const newBtn: React.CSSProperties = { height: 38, padding: '0 16px', borderRadius: 10, background: C.teal, color: '#fff', fontWeight: 800, fontSize: 13.5, border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const actionBtn: React.CSSProperties = { height: 28, padding: '0 10px', borderRadius: 7, border: `1px solid ${C.line}`, background: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: C.ink, fontFamily: 'inherit' };
const addLineBtn: React.CSSProperties = { height: 34, padding: '0 14px', borderRadius: 8, border: `1px solid ${C.teal}`, color: C.tealDeep, background: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' };
const tableWrap: React.CSSProperties = { border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'auto', flex: 1, minHeight: 0 };
const inp: React.CSSProperties = { height: 38, border: `1px solid ${C.line}`, borderRadius: 9, padding: '0 10px', fontSize: 13.5, fontFamily: 'inherit', outline: 'none', background: '#fff', color: C.ink, boxSizing: 'border-box' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 800, color: C.sub, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 };
const infoBox: React.CSSProperties = { padding: '12px 16px', background: C.mist, borderRadius: 10, fontSize: 13.5, fontWeight: 600 };
const th: React.CSSProperties = { textAlign: 'left', fontSize: 10.5, fontWeight: 800, color: C.sub, textTransform: 'uppercase', letterSpacing: '.04em', padding: '11px 10px', position: 'sticky', top: 0, background: '#fff', borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '11px 10px', fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', verticalAlign: 'middle', borderTop: `1px solid ${C.line}` };
const errBox: React.CSSProperties = { background: '#fdecec', color: C.bad, fontSize: 13, fontWeight: 600, padding: '10px 12px', borderRadius: 10, marginBottom: 14 };
const emptyBox: React.CSSProperties = { background: C.mist, color: C.tealDeep, fontSize: 13.5, fontWeight: 600, padding: '20px', borderRadius: 12, textAlign: 'center' };
