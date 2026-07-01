import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import NewProjectButton from './NewProjectButton';
import DeleteProjectButton from './DeleteProjectButton';
import './projects.css';

export const dynamic = 'force-dynamic';

type Status = 'collecting' | 'processing' | 'finishing' | 'done';

type Project = {
  id: string;
  name: string;
  status: Status;
  start_date: string | null;
  completion_date: string | null;
  notes: string | null;
  created_at: string;
  client_id: string | null;
  clients: { company_name: string } | null;
  project_links: { id: string; title: string; url: string }[];
};

type ClientOption = { id: string; company_name: string };

const STATUS_LABEL: Record<Status, string> = {
  collecting: 'Collecting',
  processing: 'Processing',
  finishing: 'Finishing',
  done: 'Done',
};

function daysLeft(date: string | null): { text: string; urgent: boolean } {
  if (!date) return { text: '', urgent: false };
  const diff = Math.ceil((new Date(date + 'T00:00:00').getTime() - Date.now()) / 86400000);
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, urgent: true };
  if (diff === 0) return { text: 'Due today', urgent: true };
  if (diff <= 7) return { text: `${diff}d left`, urgent: true };
  return { text: `${diff}d left`, urgent: false };
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!['staff', 'admin', 'super_admin'].includes(profile?.role ?? '')) redirect('/portal');

  // Single query — projects joined with client name and links (no N+1)
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name, status, start_date, completion_date, notes, created_at, client_id, clients(company_name), project_links(id, title, url)')
    .order('completion_date', { ascending: true, nullsFirst: false });

  const { data: clients } = await supabase
    .from('clients')
    .select('id, company_name')
    .order('company_name', { ascending: true });

  const rows = (projects ?? []) as unknown as Project[];
  const clientList = (clients ?? []) as unknown as ClientOption[];

  const total = rows.length;
  const active = rows.filter(p => p.status !== 'done').length;
  const done = rows.filter(p => p.status === 'done').length;
  const overdue = rows.filter(p => {
    if (!p.completion_date || p.status === 'done') return false;
    return new Date(p.completion_date + 'T00:00:00') < new Date();
  }).length;

  return (
    <div className="pg-wrap">
      <header className="pg-header">
        <h1>Projects</h1>
        <div className="pg-header-actions">
          <Link href="/admin" className="pg-back">← Dashboard</Link>
          <NewProjectButton clients={clientList} />
        </div>
      </header>

      <main className="pg-content">
        {error && (
          <div style={{ background: '#fdecec', color: '#d2603a', padding: '12px 16px', borderRadius: 10, marginBottom: 24, fontSize: 13, fontWeight: 600 }}>
            ⚠️ {error.message}
            {(error.message.includes('relation') || error.message.includes('column')) && (
              <div style={{ marginTop: 6, fontWeight: 400, fontSize: 12 }}>
                Run <code>supabase/migrations/0003_add_projects.sql</code> in Supabase → SQL Editor.
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="pg-stats">
          <div className="pg-stat">
            <div className="pg-stat-num">{total}</div>
            <div className="pg-stat-label">Total</div>
          </div>
          <div className="pg-stat">
            <div className="pg-stat-num">{active}</div>
            <div className="pg-stat-label">Active</div>
          </div>
          <div className="pg-stat">
            <div className="pg-stat-num">{done}</div>
            <div className="pg-stat-label">Done</div>
          </div>
          <div className="pg-stat" style={{ borderColor: overdue > 0 ? '#d2603a' : undefined }}>
            <div className="pg-stat-num" style={{ color: overdue > 0 ? '#d2603a' : '#10BEB2' }}>{overdue}</div>
            <div className="pg-stat-label">Overdue</div>
          </div>
        </div>

        {/* Table */}
        <div className="pg-card">
          {rows.length === 0 && !error ? (
            <div className="pg-empty">
              No projects yet.{' '}
              <span style={{ color: '#10BEB2' }}>Click &quot;+ New Project&quot; to create one.</span>
            </div>
          ) : (
            <table className="pg-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Client</th>
                  <th>Start</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Links</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(p => {
                  const dl = daysLeft(p.completion_date);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#222a2e' }}>{p.name}</div>
                        {p.notes && (
                          <div style={{ fontSize: 12, color: '#697479', marginTop: 2, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.notes}
                          </div>
                        )}
                      </td>
                      <td className="sub">{p.clients?.company_name ?? '—'}</td>
                      <td className="sub">{fmt(p.start_date)}</td>
                      <td>
                        <span className={dl.urgent ? 'urgent' : undefined}>{fmt(p.completion_date)}</span>
                        {dl.text && (
                          <span style={{ marginLeft: 6, fontSize: 11 }} className={dl.urgent ? 'urgent' : 'sub'}>
                            ({dl.text})
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge badge-${p.status}`}>{STATUS_LABEL[p.status]}</span>
                      </td>
                      <td className="sub">
                        {p.project_links.length > 0 ? (
                          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {p.project_links.map(lk => (
                              <a
                                key={lk.id}
                                href={lk.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#10BEB2', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}
                              >
                                {lk.title}
                              </a>
                            ))}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <DeleteProjectButton id={p.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
