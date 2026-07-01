'use client';

import { useEffect, useRef, useState } from 'react';

type Note = { id: string; content: string; checked: boolean; position: number };

function renderContent(raw: string): string {
  let s = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // # Title at start of line
  s = s.replace(/^# (.+)$/gm, '<strong style="font-size:13.5px;display:block;margin-bottom:2px">$1</strong>');
  // ## Subtitle
  s = s.replace(/^## (.+)$/gm, '<span style="font-size:12px;font-weight:700;display:block">$1</span>');
  // **bold**
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // URLs
  s = s.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#b45309;word-break:break-all">$1</a>'
  );
  // newlines
  s = s.replace(/\n/g, '<br/>');

  return s;
}

export default function PersonalNotesWidget() {
  const [notes, setNotes]     = useState<Note[]>([]);
  const [input, setInput]     = useState('');
  const [open, setOpen]       = useState(true);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId]   = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/personal-notes');
      const d = await res.json() as { notes?: Note[] };
      setNotes(d.notes ?? []);
    } finally { setLoading(false); }
  }

  async function add() {
    const text = input.trim();
    if (!text) return;
    // Optimistic update immediately
    const tempId = `tmp-${Date.now()}`;
    const tempNote: Note = { id: tempId, content: text, checked: false, position: 0 };
    setNotes(prev => [tempNote, ...prev]);
    setInput('');
    try {
      const res = await fetch('/api/personal-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      const d = await res.json() as { note?: Note };
      if (d.note) {
        setNotes(prev => prev.map(n => n.id === tempId ? d.note! : n));
      }
    } catch {
      setNotes(prev => prev.filter(n => n.id !== tempId));
    }
  }

  async function toggle(note: Note) {
    const updated = { ...note, checked: !note.checked };
    setNotes(prev => {
      const rest = prev.filter(n => n.id !== note.id);
      const unchecked = rest.filter(n => !n.checked);
      const checked   = rest.filter(n =>  n.checked);
      return updated.checked
        ? [...unchecked, updated, ...checked]
        : [updated, ...unchecked, ...checked];
    });
    await fetch('/api/personal-notes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: note.id, checked: !note.checked }),
    });
  }

  async function remove(id: string) {
    setNotes(prev => prev.filter(n => n.id !== id));
    await fetch('/api/personal-notes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }

  async function saveEdit(id: string) {
    if (!editVal.trim()) return;
    setNotes(prev => prev.map(n => n.id === id ? { ...n, content: editVal.trim() } : n));
    setEditId(null);
    await fetch('/api/personal-notes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, content: editVal.trim() }),
    });
  }

  const unchecked = notes.filter(n => !n.checked);
  const checked   = notes.filter(n =>  n.checked);

  return (
    <div style={widget}>
      {/* Header */}
      <div style={header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>📝</span>
          <span style={{ fontWeight: 800, fontSize: 14, color: '#78350f', letterSpacing: '-0.01em' }}>My Notes</span>
          {notes.length > 0 && (
            <span style={badge}>{unchecked.length}</span>
          )}
        </div>
        <button style={toggleBtn} onClick={() => setOpen(o => !o)} title={open ? 'Collapse' : 'Expand'}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            {open ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
          </svg>
        </button>
      </div>

      {open && (
        <>
          {/* Input */}
          <div style={inputRow}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void add(); } }}
              placeholder="Add a note… (Enter to save)"
              rows={2}
              style={inputBox}
            />
            <button style={addBtn} onClick={add} disabled={!input.trim()}>+</button>
          </div>

          {/* Notes list */}
          <div style={list}>
            {loading && <div style={empty}>Loading…</div>}
            {!loading && notes.length === 0 && (
              <div style={empty}>No notes yet — add your first one above ✨</div>
            )}

            {unchecked.map(note => (
              <NoteItem
                key={note.id}
                note={note}
                editId={editId}
                editVal={editVal}
                onToggle={toggle}
                onRemove={remove}
                onEdit={(n) => { setEditId(n.id); setEditVal(n.content); }}
                onEditChange={setEditVal}
                onEditSave={saveEdit}
                onEditCancel={() => setEditId(null)}
              />
            ))}

            {checked.length > 0 && unchecked.length > 0 && (
              <div style={divider}>
                <span style={{ padding: '0 8px', background: '#fef9c3', color: '#a16207', fontSize: 10.5, fontWeight: 700 }}>
                  DONE ({checked.length})
                </span>
              </div>
            )}

            {checked.map(note => (
              <NoteItem
                key={note.id}
                note={note}
                editId={editId}
                editVal={editVal}
                onToggle={toggle}
                onRemove={remove}
                onEdit={(n) => { setEditId(n.id); setEditVal(n.content); }}
                onEditChange={setEditVal}
                onEditSave={saveEdit}
                onEditCancel={() => setEditId(null)}
              />
            ))}
          </div>

          {notes.length > 0 && (
            <div style={{ padding: '6px 12px 10px', fontSize: 10.5, color: '#a16207', opacity: 0.7 }}>
              Tip: **bold**, # Title, paste links, use emojis 🎯
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NoteItem({ note, editId, editVal, onToggle, onRemove, onEdit, onEditChange, onEditSave, onEditCancel }: {
  note: Note;
  editId: string | null;
  editVal: string;
  onToggle: (n: Note) => void;
  onRemove: (id: string) => void;
  onEdit: (n: Note) => void;
  onEditChange: (v: string) => void;
  onEditSave: (id: string) => void;
  onEditCancel: () => void;
}) {
  const isEditing = editId === note.id;

  return (
    <div style={{ ...noteRow, opacity: note.checked ? 0.5 : 1 }}>
      <button
        style={{ ...checkbox, ...(note.checked ? checkboxDone : {}) }}
        onClick={() => onToggle(note)}
        title="Toggle done"
      >
        {note.checked && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <textarea
              autoFocus
              value={editVal}
              onChange={e => onEditChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEditSave(note.id); } if (e.key === 'Escape') onEditCancel(); }}
              rows={3}
              style={{ ...inputBox, fontSize: 12.5, padding: '6px 8px' }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={saveBtn} onClick={() => onEditSave(note.id)}>Save</button>
              <button style={cancelBtn} onClick={onEditCancel}>Cancel</button>
            </div>
          </div>
        ) : (
          <div
            style={{
              fontSize: 12.5,
              lineHeight: 1.55,
              color: '#3d2b00',
              textDecoration: note.checked ? 'line-through' : 'none',
              wordBreak: 'break-word',
              cursor: 'text',
            }}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: content is user's own notes
            dangerouslySetInnerHTML={{ __html: renderContent(note.content) }}
            onDoubleClick={() => onEdit(note)}
            title="Double-click to edit"
          />
        )}
      </div>

      {!isEditing && (
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button style={iconBtn} onClick={() => onEdit(note)} title="Edit">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button style={{ ...iconBtn, color: '#c05252' }} onClick={() => onRemove(note.id)} title="Delete">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────
const widget: React.CSSProperties = {
  position: 'fixed', bottom: 28, right: 110, zIndex: 8000,
  width: 300, maxHeight: '70vh',
  background: '#fef9c3',
  border: '1.5px solid #fde68a',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(180,150,0,0.18)',
  fontFamily: "'Manrope', sans-serif",
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
};

const header: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '10px 12px 10px 14px',
  background: '#fef08a',
  borderBottom: '1px solid #fde68a',
  flexShrink: 0,
};

const badge: React.CSSProperties = {
  background: '#f59e0b', color: '#fff', borderRadius: 9,
  fontSize: 10, fontWeight: 800, padding: '1px 6px', minWidth: 18, textAlign: 'center',
};

const toggleBtn: React.CSSProperties = {
  border: 'none', background: 'transparent', cursor: 'pointer',
  color: '#92400e', padding: 4, display: 'flex', alignItems: 'center',
};

const inputRow: React.CSSProperties = {
  display: 'flex', gap: 6, padding: '10px 10px 6px',
  flexShrink: 0,
};

const inputBox: React.CSSProperties = {
  flex: 1, resize: 'none', border: '1.5px solid #fde68a',
  borderRadius: 8, padding: '7px 9px', fontSize: 13,
  fontFamily: "'Manrope', sans-serif", lineHeight: 1.5,
  background: '#fffde7', color: '#3d2b00', outline: 'none',
};

const addBtn: React.CSSProperties = {
  border: 'none', background: '#f59e0b', color: '#fff',
  borderRadius: 8, width: 34, fontSize: 20, fontWeight: 700,
  cursor: 'pointer', flexShrink: 0, alignSelf: 'flex-end', height: 34,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const list: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: '2px 0',
};

const empty: React.CSSProperties = {
  padding: '18px 16px', textAlign: 'center', color: '#a16207',
  fontSize: 12.5, lineHeight: 1.6,
};

const noteRow: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 8,
  padding: '7px 10px 7px 12px',
  borderBottom: '1px solid #fde68a22',
  transition: 'opacity .2s',
};

const checkbox: React.CSSProperties = {
  width: 16, height: 16, borderRadius: 4, border: '1.5px solid #d97706',
  background: '#fff', flexShrink: 0, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  marginTop: 2,
};

const checkboxDone: React.CSSProperties = {
  background: '#f59e0b', border: '1.5px solid #f59e0b',
};

const divider: React.CSSProperties = {
  display: 'flex', alignItems: 'center', margin: '4px 0',
  borderTop: '1px solid #fde68a',
  textAlign: 'center', fontSize: 10.5, color: '#a16207',
};

const iconBtn: React.CSSProperties = {
  border: 'none', background: 'transparent', cursor: 'pointer',
  color: '#a16207', padding: 3, opacity: 0.6, display: 'flex',
  alignItems: 'center', borderRadius: 4,
};

const saveBtn: React.CSSProperties = {
  border: 'none', background: '#f59e0b', color: '#fff',
  borderRadius: 6, padding: '3px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
};

const cancelBtn: React.CSSProperties = {
  border: '1px solid #fde68a', background: 'transparent', color: '#92400e',
  borderRadius: 6, padding: '3px 10px', fontSize: 11.5, cursor: 'pointer',
};
