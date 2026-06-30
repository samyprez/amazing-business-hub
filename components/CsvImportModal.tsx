'use client';

// components/CsvImportModal.tsx
//
// Importador de clientes por CSV. Sigue el MISMO patron que NewClientModal:
//  - Se monta junto al dashboard (que se renderiza por innerHTML en RawPage).
//  - INYECTA un boton "Importar CSV" junto al boton existente ".nb"
//    (New Client) por DOM, sin tocar el markup de content/admin.ts.
//  - Lee un .csv en el navegador, DETECTA encabezados automaticamente, arma
//    una vista previa y manda las filas en lote a /api/clients/import.
//  - Regla de filas sin empresa: TODO-O-NADA. Si alguna fila no trae empresa
//    (campo obligatorio), se detiene y se avisa; no se importa nada.
//
// Las llaves de Supabase nunca llegan al navegador: el insert ocurre del lado
// del servidor en la API route, igual que en /api/clients.

import { useEffect, useRef, useState } from 'react';

const C = {
  teal: '#10BEB2',
  tealDeep: '#0E9E95',
  ink: '#222A2E',
  sub: '#697479',
  line: '#e7eded',
  bad: '#d2603a',
  mist: '#eafaf7',
};

type Field = 'company_name' | 'contact_name' | 'email' | 'phone' | 'address';

type ClientRow = {
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

// Sinonimos de encabezados (ES/EN), normalizados sin acentos y en minuscula.
const HEADERS: Record<Field, string[]> = {
  company_name: ['empresa', 'company', 'companyname', 'company name', 'negocio', 'cliente', 'nombre', 'name', 'razon social'],
  contact_name: ['contacto', 'contact', 'persona', 'persona de contacto', 'contact name', 'contactname', 'nombre de contacto'],
  email: ['email', 'correo', 'e-mail', 'mail', 'correo electronico', 'e mail'],
  phone: ['telefono', 'phone', 'tel', 'celular', 'movil', 'whatsapp', 'numero'],
  address: ['direccion', 'address', 'domicilio', 'ubicacion', 'dir'],
};

const ORDER: Field[] = ['company_name', 'contact_name', 'email', 'phone', 'address'];
const LABELS: Record<Field, string> = {
  company_name: 'Empresa',
  contact_name: 'Contacto',
  email: 'Email',
  phone: 'Teléfono',
  address: 'Dirección',
};

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function fieldForHeader(cell: string): Field | null {
  const n = normalize(cell);
  for (const f of ORDER) {
    if (HEADERS[f].includes(n)) return f;
  }
  return null;
}

// Parser CSV minimo: maneja comillas dobles, comas dentro de comillas,
// comillas escapadas ("") y saltos CRLF/LF. Devuelve filas de celdas.
function parseCsv(input: string): string[][] {
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // quitar BOM

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch === '\r') {
      // ignorar; el \n hace el salto de linea
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);

  // Quitar filas totalmente vacias.
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function looksLikeHeader(cells: string[]): boolean {
  const norm = cells.map(normalize);
  if (norm.some((c) => c.includes('@'))) return false; // emails => son datos
  let matches = 0;
  for (const c of norm) if (fieldForHeader(c)) matches++;
  return matches >= 2;
}

type Parsed = {
  hasHeader: boolean;
  mapping: (Field | null)[];
  rows: ClientRow[];
  firstMissingRow: number | null; // numero de fila en el archivo (1-based)
  total: number;
};

function buildParsed(text: string): Parsed | { error: string } {
  const grid = parseCsv(text);
  if (grid.length === 0) return { error: 'El archivo está vacío.' };

  const hasHeader = looksLikeHeader(grid[0]);
  const headerCells = hasHeader ? grid[0] : [];
  const dataRows = hasHeader ? grid.slice(1) : grid;

  if (dataRows.length === 0) {
    return { error: 'El archivo no tiene filas de datos.' };
  }

  const colCount = Math.max(...grid.map((r) => r.length));
  let mapping: (Field | null)[];
  if (hasHeader) {
    mapping = [];
    for (let i = 0; i < colCount; i++) {
      mapping.push(headerCells[i] ? fieldForHeader(headerCells[i]) : null);
    }
    // Si no se reconocio la columna de empresa, caemos a orden fijo.
    if (!mapping.includes('company_name')) {
      mapping = ORDER.slice(0, colCount) as (Field | null)[];
    }
  } else {
    mapping = ORDER.slice(0, colCount) as (Field | null)[];
  }
  while (mapping.length < colCount) mapping.push(null);

  const rows: ClientRow[] = [];
  let firstMissingRow: number | null = null;
  dataRows.forEach((cells, idx) => {
    const obj: ClientRow = {
      company_name: '',
      contact_name: null,
      email: null,
      phone: null,
      address: null,
    };
    mapping.forEach((field, col) => {
      if (!field) return;
      const raw = (cells[col] ?? '').trim();
      if (field === 'company_name') obj.company_name = raw;
      else obj[field] = raw || null;
    });
    if (!obj.company_name && firstMissingRow === null) {
      firstMissingRow = idx + 1 + (hasHeader ? 1 : 0);
    }
    rows.push(obj);
  });

  return { hasHeader, mapping, rows, firstMissingRow, total: rows.length };
}

const PREVIEW_LIMIT = 100;

export default function CsvImportModal() {
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Inyectar el boton "Importar CSV" junto al boton ".nb" del markup.
  useEffect(() => {
    function ensureButton() {
      const nb = document.querySelector('.nb');
      if (!nb || !nb.parentNode) return;
      if (document.querySelector('.nb-import')) return;
      const btn = document.createElement('button');
      btn.className = 'nb-import';
      btn.type = 'button';
      btn.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="display:block"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><span>Importar CSV</span>';
      btn.style.cssText =
        'height:42px;padding:0 14px;border-radius:12px;background:#fff;color:#0E9E95;font-weight:700;font-size:13.5px;border:1px solid #10BEB2;display:flex;align-items:center;gap:7px;cursor:pointer;font-family:inherit;white-space:nowrap;transition:.2s';
      btn.addEventListener('click', () => setOpen(true));
      nb.parentNode.insertBefore(btn, nb);
    }

    ensureButton();
    const obs = new MutationObserver(() => ensureButton());
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      obs.disconnect();
      document.querySelector('.nb-import')?.remove();
    };
  }, []);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ''; // permitir re-seleccionar el mismo archivo
    if (!f) return;
    setFileName(f.name);
    setDone(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = buildParsed(String(reader.result || ''));
      if ('error' in result) {
        setParsed(null);
        setError(result.error);
      } else {
        setParsed(result);
        setError(
          result.firstMissingRow !== null
            ? `La fila ${result.firstMissingRow} no tiene empresa (campo obligatorio). Corrige el archivo y vuelve a subirlo — no se importó nada.`
            : null
        );
      }
    };
    reader.onerror = () => setError('No se pudo leer el archivo.');
    reader.readAsText(f);
  }

  async function handleImport() {
    if (!parsed || parsed.firstMissingRow !== null || parsed.total === 0) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch('/api/clients/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clients: parsed.rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'No se pudo importar.');
      setDone(typeof json.inserted === 'number' ? json.inserted : parsed.total);
      setTimeout(() => window.location.reload(), 1300);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
      setImporting(false);
    }
  }

  function close() {
    if (importing) return;
    setOpen(false);
    setParsed(null);
    setError(null);
    setFileName('');
    setDone(null);
  }

  if (!open) return null;

  const canImport =
    !!parsed && parsed.firstMissingRow === null && parsed.total > 0 && !importing;
  const previewRows = parsed ? parsed.rows.slice(0, PREVIEW_LIMIT) : [];
  const extra = parsed ? parsed.total - previewRows.length : 0;

  return (
    <div style={overlay} onClick={close}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <h3 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' }}>
            Importar clientes (CSV)
          </h3>
          <button style={x} onClick={close} aria-label="Cerrar">×</button>
        </div>

        {done !== null ? (
          <div style={successBox}>
            ✓ Se importaron {done} cliente{done === 1 ? '' : 's'}. Actualizando el
            dashboard…
          </div>
        ) : (
          <>
            <div style={hint}>
              Sube un archivo <b>.csv</b> con columnas: empresa, contacto, email,
              teléfono, dirección. Detecto los encabezados automáticamente (si no
              hay, uso ese orden). Solo <b>empresa</b> es obligatoria.
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onFile}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <button style={pickBtn} onClick={() => fileRef.current?.click()}>
                {fileName ? 'Cambiar archivo' : 'Elegir archivo .csv'}
              </button>
              {fileName && <span style={{ fontSize: 13, color: C.sub }}>{fileName}</span>}
            </div>

            {parsed && (
              <>
                <div style={metaRow}>
                  <span style={badge}>
                    {parsed.hasHeader
                      ? 'Encabezados detectados'
                      : 'Sin encabezados · orden: empresa, contacto, email, teléfono, dirección'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>
                    {parsed.total} fila{parsed.total === 1 ? '' : 's'}
                  </span>
                </div>

                <div style={tableWrap}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {ORDER.map((f) => (
                          <th key={f} style={th}>{LABELS[f]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r, i) => {
                        const bad = !r.company_name;
                        return (
                          <tr key={i} style={bad ? { background: '#fdecec' } : undefined}>
                            <td style={td}>{r.company_name || <em style={emBad}>(vacío)</em>}</td>
                            <td style={td}>{r.contact_name || '—'}</td>
                            <td style={td}>{r.email || '—'}</td>
                            <td style={td}>{r.phone || '—'}</td>
                            <td style={td}>{r.address || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {extra > 0 && (
                  <div style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>
                    … y {extra} fila{extra === 1 ? '' : 's'} más (no mostradas).
                  </div>
                )}
              </>
            )}

            {error && <div style={errBox}>{error}</div>}

            <div style={actions}>
              <button style={ghost} onClick={close} disabled={importing}>
                Cancelar
              </button>
              <button
                style={{ ...primary, opacity: canImport ? 1 : 0.5, cursor: canImport ? 'pointer' : 'not-allowed' }}
                onClick={handleImport}
                disabled={!canImport}
              >
                {importing
                  ? 'Importando…'
                  : parsed
                    ? `Importar ${parsed.total} cliente${parsed.total === 1 ? '' : 's'}`
                    : 'Importar'}
              </button>
            </div>
          </>
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

const modal: React.CSSProperties = {
  width: '100%',
  maxWidth: 640,
  background: '#fff',
  borderRadius: 18,
  padding: '24px 26px 22px',
  boxShadow: '0 30px 70px rgba(0,0,0,0.35)',
  fontFamily: "'Manrope', sans-serif",
  color: C.ink,
  maxHeight: '88vh',
  overflowY: 'auto',
};

const head: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
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

const hint: React.CSSProperties = {
  fontSize: 13,
  color: C.sub,
  lineHeight: 1.5,
  marginBottom: 16,
};

const pickBtn: React.CSSProperties = {
  height: 42,
  padding: '0 16px',
  border: `1px solid ${C.line}`,
  borderRadius: 11,
  background: C.mist,
  color: C.tealDeep,
  fontWeight: 700,
  fontSize: 13.5,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const metaRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  marginBottom: 10,
};

const badge: React.CSSProperties = {
  display: 'inline-block',
  background: C.mist,
  color: C.tealDeep,
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: '.02em',
  padding: '5px 11px',
  borderRadius: 999,
};

const tableWrap: React.CSSProperties = {
  border: `1px solid ${C.line}`,
  borderRadius: 12,
  overflow: 'auto',
  maxHeight: 260,
  marginBottom: 12,
};

const th: React.CSSProperties = {
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 800,
  color: C.sub,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  padding: '10px 10px',
  position: 'sticky',
  top: 0,
  background: '#fff',
  borderBottom: `1px solid ${C.line}`,
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '9px 10px',
  borderTop: `1px solid ${C.line}`,
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  maxWidth: 180,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const emBad: React.CSSProperties = { color: C.bad, fontWeight: 700, fontStyle: 'italic' };

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

const successBox: React.CSSProperties = {
  background: '#e7f7ee',
  color: '#1a9f5e',
  fontSize: 14,
  fontWeight: 700,
  padding: '14px 14px',
  borderRadius: 12,
  lineHeight: 1.45,
};

const actions: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  marginTop: 4,
};

const ghost: React.CSSProperties = {
  flex: 1,
  height: 46,
  border: `1px solid ${C.line}`,
  borderRadius: 11,
  background: '#fff',
  color: C.ink,
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const primary: React.CSSProperties = {
  flex: 1.6,
  height: 46,
  border: 'none',
  borderRadius: 11,
  background: C.teal,
  color: '#fff',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
