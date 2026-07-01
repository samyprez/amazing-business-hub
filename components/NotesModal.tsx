'use client';

// components/NotesModal.tsx
// "Tareas" button in the top bar — hooks into #tareas-btn in admin.ts.
// Displays a shared Google Doc (read-only) fetched via /api/notes.

import { useEffect, useState } from 'react';

const C = {
  teal: '#10BEB2', tealDeep: '#0E9E95', ink: '#222A2E', sub: '#697479',
  line: '#e7eded', mist: '#eafaf7', warn: '#c98a14', bad: '#d2603a',
};

type NoteData = { configured: boolean; title: string; html: string; error?: string };

export default function NotesModal() {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote]       = useState<NoteData | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  // Hook into the #tareas-btn button injected in admin.ts top bar
  useEffect(() => {
    function attach() {
      const btn = document.getElementById('tareas-btn');
      if (!btn) return false;
      btn.addEventListener('click', () => setOpen(true));
      return true;
    }
    if (attach()) return;
    const obs = new MutationObserver(() => { if (attach()) obs.disconnect(); });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch('/api/notes');
      const data = await res.json() as NoteData;
      setNote(data);
      setLastFetch(new Date());
    } catch {
      setNote({ configured: false, title: '', html: '', error: 'Could not reach /api/notes.' });
    } finally { setLoading(false); }
  }

  useEffect(() => { if (open && !note) void load(); }, [open]);

  return (
    <>
      {/* ── Modal ───────────────────────────────────────────────────────────── */}
      {open && (
        <div style={overlay} onClick={() => setOpen(false)}>
          <div style={panel} onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div style={head}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  <h3 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' }}>
                    {loading ? 'Loading…' : (note?.title || '⚠️ To Do Today')}
                  </h3>
                </div>
                {lastFetch && (
                  <div style={{ fontSize: 11.5, color: C.sub, marginTop: 3 }}>
                    Last synced {lastFetch.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} · Refreshes every 60 s
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button style={iconBtn} onClick={load} disabled={loading} title="Refresh">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                </button>
                {note?.configured && !note?.error && (
                  <a href="https://docs.google.com/document/d/113p0XXhl-UjebF7is-NM4fPJMuYc6u1YbXI-L5KQ1Uc/edit" target="_blank" rel="noopener noreferrer" style={openBtn}>
                    Open in Google Docs ↗
                  </a>
                )}
                <button style={xBtn} onClick={() => setOpen(false)} aria-label="Close">×</button>
              </div>
            </div>

            {/* Content */}
            <div style={body}>
              {loading && (
                <div style={{ padding: '40px 0', textAlign: 'center', color: C.sub, fontSize: 13.5 }}>
                  Fetching from Google Docs…
                </div>
              )}

              {!loading && note && !note.configured && (
                <div style={setupBox}>
                  <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Connect a Google Doc</div>
                  <p style={{ lineHeight: 1.65, marginBottom: 16 }}>Add these two environment variables in <b>Vercel → Settings → Environment Variables</b> and redeploy:</p>
                  <div style={codeBlock}>
                    <div><span style={{ color: C.tealDeep }}>GOOGLE_DOCS_API_KEY</span> = <span style={{ color: C.warn }}>your-api-key</span></div>
                    <div style={{ marginTop: 6 }}><span style={{ color: C.tealDeep }}>GOOGLE_DOC_ID</span> = <span style={{ color: C.warn }}>the-doc-id-from-the-url</span></div>
                  </div>
                </div>
              )}

              {!loading && note?.configured && note.error && (
                <div style={{ background: '#fdecec', color: C.bad, padding: '14px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
                  <strong>Error:</strong> {note.error}
                </div>
              )}

              {!loading && note?.configured && !note.error && note.html && (
                <div
                  style={{ lineHeight: 1.7, fontSize: 14.5, color: C.ink }}
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: content from own Google Doc
                  dangerouslySetInnerHTML={{ __html: note.html }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(20,24,27,0.5)', backdropFilter: 'blur(2px)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  padding: '40px 20px', zIndex: 9999, overflowY: 'auto',
};

const panel: React.CSSProperties = {
  width: '100%', maxWidth: 760, background: '#fff', borderRadius: 18,
  padding: '24px 26px 28px', boxShadow: '0 30px 70px rgba(0,0,0,0.32)',
  fontFamily: "'Manrope', sans-serif", color: C.ink,
  display: 'flex', flexDirection: 'column', gap: 16,
};

const head: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
};

const body: React.CSSProperties = {
  flex: 1, overflow: 'auto', maxHeight: '65vh',
};

const xBtn: React.CSSProperties = {
  border: 'none', background: 'transparent', fontSize: 26, lineHeight: 1,
  color: C.sub, cursor: 'pointer', padding: 0,
};

const iconBtn: React.CSSProperties = {
  border: `1px solid ${C.line}`, background: '#fff', borderRadius: 8,
  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: C.sub,
};

const openBtn: React.CSSProperties = {
  height: 34, padding: '0 14px', borderRadius: 9, border: `1px solid ${C.teal}`,
  color: C.tealDeep, background: '#fff', fontWeight: 700, fontSize: 12.5,
  textDecoration: 'none', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
};

const setupBox: React.CSSProperties = {
  background: C.mist, borderRadius: 14, padding: '20px 22px', fontSize: 13.5, lineHeight: 1.6,
};

const codeBlock: React.CSSProperties = {
  background: '#1a2023', color: '#e2e8f0', borderRadius: 10, padding: '12px 16px',
  fontFamily: 'monospace', fontSize: 13, lineHeight: 1.8,
};
