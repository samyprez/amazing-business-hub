'use client';

import { useEffect, useState } from 'react';

const C = {
  teal: '#10BEB2', tealDeep: '#0E9E95', ink: '#222A2E', sub: '#697479',
  line: '#e7eded', bad: '#d2603a', good: '#1a9f5e', warn: '#c98a14', mist: '#eafaf7',
};

type Status = 'collecting' | 'processing' | 'finishing' | 'done';
type ProjectLink = { id: string; title: string; url: string };
type Project = {
  id: string; name: string; status: Status; completion_date: string | null;
  created_at: string; client_id: string | null;
  clients: { company_name: string } | null;
  project_links: ProjectLink[];
};
type ClientOption = { id: string; company_name: string };

const STATUS_LABEL: Record<Status, string> = {
  collecting: 'Collecting', processing: 'Processing', finishing: 'Finishing', done: 'Done',
};
const STATUSES: Status[] = ['collecting', 'processing', 'finishing', 'done'];

function statusStyle(s: Status): React.CSSProperties {
  const m: Record<Status, { bg: string; color: string }> = {
    collecting: { bg: '#fff4e0', color: C.warn },
    processing: { bg: '#e8f0fe', color: '#1a73e8' },
    finishing:  { bg: '#eafaf7', color: C.tealDeep },
    done:       { bg: '#e7f7ee', color: C.good },
  };
  return { ...badge, ...m[s] };
}

function daysLeft(date: string | null): { text: string; urgent: boolean } {
  if (!date) return { text: 'No date', urgent: false };
  const diff = Math.ceil((new Date(date + 'T00:00:00').getTime() - Date.now()) / 86400000);
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, urgent: true };
  if (diff === 0) return { text: 'Due today', urgent: true };
  if (diff <= 7) return { text: `${diff}d left`, urgent: true };
  return { text: `${diff}d left`, urgent: false };
};

function fmt(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}

export default function ProjectsModal() {
  const [open, setOpen]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [view, setView] = useState<'list' | 'detail' | 'create'>('list');

  // Form state
  const [fName, setFName] = useState('');
  const [fClient, setFClient] = useState('');
  const [fDate, setFDate] = useState('');
  const [fStatus, setFStatus] = useState<Status>('collecting');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Link form
  const [lTitle, setLTitle] = useState('');
  const [lUrl, setLUrl] = useState('');
  const [addingLink, setAddingLink] = useState(false);

  useEffect(() => {
    function findLink(): HTMLElement | null {
      const links = Array.from(document.querySelectorAll('.side a'));
      return (links.find(
        (a) => (a.textContent || '').replace(/\d+/g, '').trim().toLowerCase() === 'projects'
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
    return () => obs.disconnect();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/clients'),
      ]);
      const pData = await pRes.json() as { projects?: Project[]; error?: string };
      const cData = await cRes.json() as { clients?: ClientOption[] };
      if (pData.error) { setError(pData.error); return; }
      setProjects(pData.projects ?? []);
      setClients(cData.clients ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading projects');
    } finally { setLoading(false); }
  }

  useEffect(() => { if (open) void load(); }, [open]);

  async function createProject() {
    if (!fName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fName.trim(), client_id: fClient || null, completion_date: fDate || null, status: fStatus }),
      });
      const d = await res.json() as { project?: Project; error?: string };
      if (d.error) { setError(d.error); return; }
      if (d.project) {
        setProjects(prev => [d.project!, ...prev]);
        setView('list');
        setFName(''); setFClient(''); setFDate(''); setFStatus('collecting');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error creating project');
    } finally { setSaving(false); }
  }

  async function changeStatus(p: Project, status: Status) {
    setProjects(prev => prev.map(x => x.id === p.id ? { ...x, status } : x));
    if (selected?.id === p.id) setSelected({ ...p, status });
    await fetch('/api/projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, status }),
    });
  }

  async function deleteProject(id: string) {
    if (!confirm('Delete this project?')) return;
    setProjects(prev => prev.filter(p => p.id !== id));
    setView('list'); setSelected(null);
    await fetch('/api/projects', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
  }

  async function addLink() {
    if (!selected || !lTitle.trim() || !lUrl.trim()) return;
    setAddingLink(true);
    try {
      const res = await fetch('/api/projects/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: selected.id, title: lTitle.trim(), url: lUrl.trim() }),
      });
      const d = await res.json() as { link?: ProjectLink };
      if (d.link) {
        const updated = { ...selected, project_links: [...selected.project_links, d.link] };
        setSelected(updated);
        setProjects(prev => prev.map(p => p.id === selected.id ? updated : p));
        setLTitle(''); setLUrl('');
      }
    } finally { setAddingLink(false); }
  }

  async function deleteLink(linkId: string) {
    if (!selected) return;
    const updated = { ...selected, project_links: selected.project_links.filter(l => l.id !== linkId) };
    setSelected(updated);
    setProjects(prev => prev.map(p => p.id === selected.id ? updated : p));
    await fetch('/api/projects/links', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: linkId }) });
  }

  if (!open) return null;

  return (
    <div style={overlay} onClick={() => setOpen(false)}>
      <div style={panel} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={head}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {(view === 'detail' || view === 'create') && (
              <button style={backBtn} onClick={() => { setView('list'); setSelected(null); }}>← Back</button>
            )}
            <h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' }}>
              {view === 'list' ? 'Projects' : view === 'create' ? 'New Project' : selected?.name}
            </h3>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {view === 'list' && (
              <button style={primaryBtn} onClick={() => setView('create')}>+ New Project</button>
            )}
            <button style={xBtn} onClick={() => setOpen(false)}>×</button>
          </div>
        </div>

        {/* Content */}
        <div style={body}>
          {/* LIST VIEW */}
          {view === 'list' && (
            <>
              {error && (
                <div style={{ background: '#fdecec', color: '#d2603a', padding: '12px 16px', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
                  ⚠️ {error}
                  {error.includes('relation') || error.includes('column') || error.includes('schema') ? (
                    <div style={{ marginTop: 8, fontWeight: 400, fontSize: 12 }}>
                      Run the projects SQL migration in Supabase → SQL Editor first.
                    </div>
                  ) : null}
                </div>
              )}
              {loading && <div style={emptyMsg}>Loading projects…</div>}
              {!loading && !error && projects.length === 0 && (
                <div style={emptyMsg}>No projects yet. Click &ldquo;+ New Project&rdquo; to create one.</div>
              )}
              {!loading && projects.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f4f7f7' }}>
                      <th style={th}>Project</th>
                      <th style={th}>Client</th>
                      <th style={th}>Due Date</th>
                      <th style={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map(p => {
                      const dl = daysLeft(p.completion_date);
                      return (
                        <tr
                          key={p.id}
                          style={{ borderBottom: `1px solid ${C.line}`, cursor: 'pointer' }}
                          onClick={() => { setSelected(p); setView('detail'); }}
                        >
                          <td style={td}>
                            <span style={{ fontWeight: 700, color: C.ink }}>{p.name}</span>
                          </td>
                          <td style={td}>{p.clients?.company_name ?? <span style={{ color: C.sub }}>—</span>}</td>
                          <td style={td}>
                            <span style={{ fontWeight: 600, color: dl.urgent ? C.bad : C.ink }}>{fmt(p.completion_date)}</span>
                            {p.completion_date && (
                              <span style={{ marginLeft: 6, fontSize: 11, color: dl.urgent ? C.bad : C.sub }}>({dl.text})</span>
                            )}
                          </td>
                          <td style={td}><span style={statusStyle(p.status)}>{STATUS_LABEL[p.status]}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          )}

          {/* CREATE VIEW */}
          {view === 'create' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && <div style={{ background: '#fdecec', color: '#d2603a', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>⚠️ {error}</div>}
              <div style={fieldRow}>
                <label style={label}>Project Name *</label>
                <input style={input} value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. Website Redesign" />
              </div>
              <div style={fieldRow}>
                <label style={label}>Client</label>
                <select style={input} value={fClient} onChange={e => setFClient(e.target.value)}>
                  <option value="">— Select client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <div style={fieldRow}>
                <label style={label}>Completion Date</label>
                <input type="date" style={input} value={fDate} onChange={e => setFDate(e.target.value)} />
              </div>
              <div style={fieldRow}>
                <label style={label}>Status</label>
                <select style={input} value={fStatus} onChange={e => setFStatus(e.target.value as Status)}>
                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <button style={{ ...primaryBtn, alignSelf: 'flex-start', marginTop: 8 }} onClick={createProject} disabled={saving || !fName.trim()}>
                {saving ? 'Saving…' : 'Create Project'}
              </button>
            </div>
          )}

          {/* DETAIL VIEW */}
          {view === 'detail' && selected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Info row */}
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', padding: '14px 16px', background: C.mist, borderRadius: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Client</div>
                  <div style={{ fontWeight: 700 }}>{selected.clients?.company_name ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Due Date</div>
                  <div style={{ fontWeight: 700, color: daysLeft(selected.completion_date).urgent ? C.bad : C.ink }}>
                    {fmt(selected.completion_date)}
                    {selected.completion_date && <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 6, color: C.sub }}>({daysLeft(selected.completion_date).text})</span>}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Status</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {STATUSES.map(s => (
                      <button
                        key={s}
                        onClick={() => void changeStatus(selected, s)}
                        style={{
                          ...badge,
                          cursor: 'pointer', border: 'none',
                          opacity: selected.status === s ? 1 : 0.45,
                          transform: selected.status === s ? 'scale(1.05)' : 'scale(1)',
                          ...(statusStyle(s)),
                        }}
                      >{STATUS_LABEL[s]}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Links section */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginBottom: 12 }}>Links & Documents</div>
                {selected.project_links.length === 0 && (
                  <div style={{ color: C.sub, fontSize: 13, marginBottom: 12 }}>No links yet. Add Google Docs, Drive folders, references below.</div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selected.project_links.map(lk => (
                    <div key={lk.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f4f7f7', borderRadius: 10 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2.2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      <div style={{ flex: 1 }}>
                        <a href={lk.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: C.tealDeep, fontSize: 13.5, textDecoration: 'none' }}>
                          {lk.title}
                        </a>
                        <div style={{ fontSize: 11, color: C.sub, marginTop: 2, wordBreak: 'break-all' }}>{lk.url}</div>
                      </div>
                      <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.bad, padding: 4, opacity: 0.7 }}
                        onClick={() => void deleteLink(lk.id)}>✕</button>
                    </div>
                  ))}
                </div>

                {/* Add link form */}
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <input style={{ ...input, flex: 1, minWidth: 120 }} placeholder="Link title (e.g. Design Doc)" value={lTitle} onChange={e => setLTitle(e.target.value)} />
                  <input style={{ ...input, flex: 2, minWidth: 200 }} placeholder="https://docs.google.com/…" value={lUrl} onChange={e => setLUrl(e.target.value)} />
                  <button style={{ ...primaryBtn, flexShrink: 0 }} onClick={addLink} disabled={addingLink || !lTitle.trim() || !lUrl.trim()}>
                    {addingLink ? '…' : '+ Add'}
                  </button>
                </div>
              </div>

              {/* Delete */}
              <div style={{ paddingTop: 8, borderTop: `1px solid ${C.line}` }}>
                <button style={{ border: `1px solid ${C.bad}`, background: 'transparent', color: C.bad, borderRadius: 8, padding: '6px 14px', fontSize: 12.5, cursor: 'pointer', fontWeight: 700 }}
                  onClick={() => void deleteProject(selected.id)}>Delete Project</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────────
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(20,24,27,0.55)', backdropFilter: 'blur(2px)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  padding: '40px 20px', zIndex: 9999, overflowY: 'auto',
};
const panel: React.CSSProperties = {
  width: '100%', maxWidth: 820, background: '#fff', borderRadius: 18,
  padding: '24px 26px 28px', boxShadow: '0 30px 70px rgba(0,0,0,0.3)',
  fontFamily: "'Manrope', sans-serif", color: C.ink,
  display: 'flex', flexDirection: 'column', gap: 18,
};
const head: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const body: React.CSSProperties = { flex: 1, minHeight: 200 };
const th: React.CSSProperties = { padding: '10px 14px', fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: C.sub, textAlign: 'left' };
const td: React.CSSProperties = { padding: '12px 14px', fontSize: 13.5, verticalAlign: 'middle' };
const badge: React.CSSProperties = { display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700 };
const emptyMsg: React.CSSProperties = { textAlign: 'center', padding: '40px 0', color: C.sub, fontSize: 13.5 };
const primaryBtn: React.CSSProperties = { border: 'none', background: C.teal, color: '#fff', borderRadius: 10, padding: '8px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' };
const xBtn: React.CSSProperties = { border: 'none', background: 'transparent', fontSize: 26, lineHeight: 1, color: C.sub, cursor: 'pointer', padding: 0 };
const backBtn: React.CSSProperties = { border: `1px solid ${C.line}`, background: '#fff', borderRadius: 8, padding: '5px 12px', fontSize: 13, cursor: 'pointer', color: C.sub, fontWeight: 600 };
const fieldRow: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: C.ink };
const input: React.CSSProperties = { height: 40, border: `1px solid ${C.line}`, borderRadius: 9, padding: '0 12px', fontSize: 13.5, fontFamily: "'Manrope', sans-serif", outline: 'none', color: C.ink, background: '#fff' };
