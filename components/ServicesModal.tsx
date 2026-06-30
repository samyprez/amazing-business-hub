'use client';

// components/ServicesModal.tsx
// Hooks into "Services" sidebar link. Pulls catalog from Stripe /api/stripe/products.

import { useEffect, useRef, useState } from 'react';

const C = {
  teal: '#10BEB2', tealDeep: '#0E9E95', ink: '#222A2E', sub: '#697479',
  line: '#e7eded', mist: '#eafaf7', good: '#1a9f5e',
};

type Price = { id: string; unit_amount: number; currency: string };
type Product = { id: string; name: string; description: string | null; prices: Price[] };

function money(amount: number, currency: string): string {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100); }
  catch { return `$${(amount / 100).toFixed(2)}`; }
}

export default function ServicesModal() {
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError]       = useState<string | null>(null);
  const [q, setQ]               = useState('');
  const loadedRef = useRef(false);

  useEffect(() => {
    function findLink(): HTMLElement | null {
      const links = Array.from(document.querySelectorAll('.side a'));
      return (links.find((a) => {
        const t = (a.textContent || '').replace(/\d+/g, '').trim().toLowerCase();
        return t === 'services';
      }) as HTMLElement) || null;
    }
    let bound: HTMLElement | null = null;
    const onClick = (e: Event) => { e.preventDefault(); setOpen(true); };
    function ensure() {
      const link = findLink();
      if (!link || link === bound) return;
      bound = link; link.style.cursor = 'pointer';
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
      const res = await fetch('/api/stripe/products');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could not load services.');
      setProducts(Array.isArray(json.products) ? json.products : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.');
    } finally { setLoading(false); }
  }

  if (!open) return null;

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? products.filter((p) => p.name.toLowerCase().includes(needle) || (p.description || '').toLowerCase().includes(needle))
    : products;

  return (
    <div style={overlay} onClick={() => setOpen(false)}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <div>
            <h3 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em' }}>Services</h3>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>
              {loading ? 'Loading…' : `${products.length} services from Stripe catalog`}
            </div>
          </div>
          <button style={xBtn} onClick={() => setOpen(false)} aria-label="Close">×</button>
        </div>

        <input
          style={search}
          placeholder="Search services…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />

        {error && (
          <div style={{ background: '#fdecec', color: '#d2603a', fontSize: 13, fontWeight: 600, padding: '10px 14px', borderRadius: 10, marginBottom: 14 }}>
            {error.includes('STRIPE_SECRET_KEY') || error.includes('key')
              ? 'Stripe is not configured. Add STRIPE_SECRET_KEY to your Vercel environment variables.'
              : error}
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <div style={{ background: C.mist, color: C.tealDeep, fontSize: 13.5, fontWeight: 600, padding: 20, borderRadius: 12 }}>
            No services found in your Stripe catalog. Add products in your Stripe dashboard to see them here.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, flex: 1, overflowY: 'auto' }}>
          {loading
            ? [1, 2, 3].map((i) => <div key={i} style={{ ...card, background: '#f4f7f7', minHeight: 120 }} />)
            : filtered.map((p) => (
                <div key={p.id} style={card}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, marginBottom: 6 }}>{p.name}</div>
                  {p.description && (
                    <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 12, lineHeight: 1.5 }}>{p.description}</div>
                  )}
                  <div style={{ marginTop: 'auto' }}>
                    {p.prices.length === 0 ? (
                      <span style={{ fontSize: 12, color: C.sub }}>No price set</span>
                    ) : p.prices.map((pr) => (
                      <div key={pr.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                        <span style={{ fontSize: 13, color: C.sub, textTransform: 'uppercase', letterSpacing: '.04em' }}>{pr.currency}</span>
                        <span style={{ fontSize: 17, fontWeight: 800, color: C.tealDeep }}>{money(pr.unit_amount, pr.currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
          }
        </div>

        {needle && !loading && (
          <div style={{ fontSize: 12, color: C.sub, marginTop: 10 }}>
            Showing {filtered.length} of {products.length}
          </div>
        )}
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(20,24,27,0.55)', backdropFilter: 'blur(2px)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', zIndex: 9999, overflowY: 'auto',
};
const panel: React.CSSProperties = {
  width: '100%', maxWidth: 900, background: '#fff', borderRadius: 18, padding: '24px 26px 26px',
  boxShadow: '0 30px 70px rgba(0,0,0,0.35)', fontFamily: "'Manrope', sans-serif", color: C.ink,
  display: 'flex', flexDirection: 'column', gap: 16, minHeight: 300,
};
const head: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' };
const xBtn: React.CSSProperties = { border: 'none', background: 'transparent', fontSize: 26, lineHeight: 1, color: C.sub, cursor: 'pointer', padding: 0 };
const search: React.CSSProperties = { height: 42, border: `1px solid ${C.line}`, borderRadius: 11, padding: '0 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', color: C.ink };
const card: React.CSSProperties = {
  border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 18px',
  display: 'flex', flexDirection: 'column', background: '#fff',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
};
