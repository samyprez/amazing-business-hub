'use client';

// components/ClientsListModal.tsx
//
// Vista de Clientes (lista real). Sigue el MISMO patron que los otros
// componentes:
//  - Se engancha al link "Clients" del sidebar (que en el markup es un <a>
//    sin href ni handler) por DOM, sin tocar content/admin.ts.
//  - Al abrir, trae TODOS los clientes desde GET /api/clients y los muestra
//    en una tabla con buscador. La lectura corre server-side; las llaves de
//    Supabase no llegan al navegador.
//
// Resuelve el "no encuentro el cliente que cree": aqui aparecen todos los de
// la tabla `clients`, tengan o no servicios asociados.

import { useEffect, useRef, useState } from 'react';

const C = {
  teal: '#10BEB2',
  tealDeep: '#0E9E95',
  ink: '#222A2E',
  sub: '#697479',
  line: '#e7eded',
  bad: '#d2603a',
  good: '#1a9f5e',
  mist: '#eafaf7',
};

type Client = {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
};

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] || '')
      .join('')
      .toUpperCase() || '?'
  );
}

export default function ClientsListModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const loadedRef = useRef(false);

  // Enganchar el link "Clients" del sidebar (es un <a> sin href).
  useEffect(() => {
    function findClientsLink(): HTMLElement | null {
      const links = Array.from(document.querySelectorAll('.side a'));
      return (links.find(
        (a) => (a.textContent || '').trim().toLowerCase() === 'clients'
      ) as HTMLElement) || null;
    }

    let bound: HTMLElement | null = null;
    const onClick = (e: Event) => {
      e.preventDefault();
      setOpen(true);
    };

    function ensureBinding() {
      const link = findClientsLink();
      if (!link || link === bound) return;
      bound = link;
      link.style.cursor = 'pointer';
      link.addEventListener('click', onClick);
    }

    ensureBinding();
    const obs = new MutationObserver(() => ensureBinding());
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      obs.disconnect();
      if (bound) bound.removeEventListener('click', onClick);
    };
  }, []);

  // Cargar clientes la primera vez que se abre.
  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    void load();
  }, [open]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/clients', { method: 'GET' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'No se pudieron cargar los clientes.');
      setClients(Array.isArray(json.clients) ? json.clients : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  }

  function refresh() {
    loadedRef.current = true;
    void load();
  }

  if (!open) return null;

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? clients.filter((c) =>
        [c.company_name, c.contact_name, c.email]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle))
      )
    : clients;

  return (
    <div style={overlay} onClick={() => setOpen(false)}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <div>
            <h3 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em' }}>
              Clientes
            </h3>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>
              {loading
                ? 'Cargando…'
                : `${clients.length} cliente${clients.length === 1 ? '' : 's'} en total`}
            </div>
          </div>
          <button style={x} onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
        </div>

        <div style={toolbar}>
          <input
            style={search}
            placeholder="Buscar por empresa, contacto, email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <button style={refreshBtn} onClick={refresh} disabled={loading}>
            Actualizar
          </button>
        </div>

        {error && <div style={errBox}>{error}</div>}

        {!error && !loading && clients.length === 0 && (
          <div style={emptyBox}>
            Todavía no hay clientes en la base de datos. Si acabas de crear uno y
            no aparece aquí, es un problema de guardado (revisa las políticas RLS
            de la tabla <b>clients</b> en Supabase).
          </div>
        )}

        {!error && (loading || clients.length > 0) && (
          <div style={tableWrap}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Empresa</th>
                  <th style={th}>Contacto</th>
                  <th style={th}>Email</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td style={td} colSpan={3}>
                      Cargando clientes…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td style={{ ...td, color: C.sub }} colSpan={3}>
                      Ningún cliente coincide con &quot;{q}&quot;.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id}>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <span style={avatar}>{initials(c.company_name)}</span>
                          <span style={{ fontWeight: 700 }}>{c.company_name}</span>
                        </div>
                      </td>
                      <td style={td}>{c.contact_name || '—'}</td>
                      <td style={td}>{c.email || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && needle && clients.length > 0 && (
          <div style={{ fontSize: 12, color: C.sub, marginTop: 10 }}>
            Mostrando {filtered.length} de {clients.length}.
          </div>
        )}
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(20,24,27,0.55)',
  backdropFilter: 'blur(2px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  zIndex: 9999,
};

const panel: React.CSSProperties = {
  width: '100%',
  maxWidth: 880,
  background: '#fff',
  borderRadius: 18,
  padding: '24px 26px 22px',
  boxShadow: '0 30px 70px rgba(0,0,0,0.35)',
  fontFamily: "'Manrope', sans-serif",
  color: C.ink,
  maxHeight: '88vh',
  display: 'flex',
  flexDirection: 'column',
};

const head: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  marginBottom: 16,
};

const x: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  fontSize: 26,
  lineHeight: 1,
  color: C.sub,
  cursor: 'pointer',
  padding: 0,
};

const toolbar: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  marginBottom: 14,
};

const search: React.CSSProperties = {
  flex: 1,
  height: 44,
  border: `1px solid ${C.line}`,
  borderRadius: 12,
  padding: '0 14px',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
};

const refreshBtn: React.CSSProperties = {
  height: 44,
  padding: '0 16px',
  border: `1px solid ${C.line}`,
  borderRadius: 12,
  background: C.mist,
  color: C.tealDeep,
  fontWeight: 700,
  fontSize: 13.5,
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
};

const tableWrap: React.CSSProperties = {
  border: `1px solid ${C.line}`,
  borderRadius: 12,
  overflow: 'auto',
  flex: 1,
  minHeight: 0,
};

const th: React.CSSProperties = {
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 800,
  color: C.sub,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  padding: '12px 12px',
  position: 'sticky',
  top: 0,
  background: '#fff',
  borderBottom: `1px solid ${C.line}`,
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '11px 12px',
  borderTop: `1px solid ${C.line}`,
  fontSize: 13.5,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  maxWidth: 220,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const avatar: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: '50%',
  background: 'linear-gradient(135deg,#10BEB2,#0E9E95)',
  color: '#fff',
  fontSize: 11,
  fontWeight: 800,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
};

const stOn: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  padding: '4px 10px',
  borderRadius: 999,
  background: '#e7f7ee',
  color: C.good,
};

const stOff: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  padding: '4px 10px',
  borderRadius: 999,
  background: '#f0f2f2',
  color: C.sub,
};

const errBox: React.CSSProperties = {
  background: '#fdecec',
  color: C.bad,
  fontSize: 13,
  fontWeight: 600,
  padding: '10px 12px',
  borderRadius: 10,
  marginBottom: 14,
  lineHeight: 1.45,
};

const emptyBox: React.CSSProperties = {
  background: C.mist,
  color: C.tealDeep,
  fontSize: 13.5,
  fontWeight: 600,
  padding: '16px 16px',
  borderRadius: 12,
  lineHeight: 1.5,
};
