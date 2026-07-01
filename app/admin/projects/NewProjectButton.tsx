'use client';

import { useRef, useState } from 'react';
import { createProject } from './actions';

type ClientOption = { id: string; company_name: string };

export default function NewProjectButton({ clients }: { clients: ClientOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    const fd = new FormData(e.currentTarget);
    await createProject(fd);
    formRef.current?.reset();
    setPending(false);
    setOpen(false);
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + New Project
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>New Project</h2>
              <button className="modal-x" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label htmlFor="np-name">Project Name *</label>
                <input id="np-name" name="name" required placeholder="e.g. Website Redesign" autoFocus />
              </div>

              <div className="field">
                <label htmlFor="np-client">Client</label>
                <select id="np-client" name="client_id">
                  <option value="">— No client —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="np-start">Start Date</label>
                  <input id="np-start" name="start_date" type="date" />
                </div>
                <div className="field">
                  <label htmlFor="np-due">Due Date</label>
                  <input id="np-due" name="completion_date" type="date" />
                </div>
              </div>

              <div className="field">
                <label htmlFor="np-status">Status</label>
                <select id="np-status" name="status">
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="np-notes">Notes</label>
                <textarea id="np-notes" name="notes" rows={3} placeholder="Optional project notes…" />
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ marginTop: 4, opacity: pending ? 0.6 : 1 }}
                disabled={pending}
              >
                {pending ? 'Creating…' : 'Create Project'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
