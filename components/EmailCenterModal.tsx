'use client';

import { useEffect, useRef, useState } from 'react';

const C = {
  teal: '#10BEB2', tealDeep: '#0E9E95', ink: '#222A2E', sub: '#697479',
  line: '#e7eded', bad: '#d2603a', good: '#1a9f5e', mist: '#eafaf7',
};

type SentEmail = { to: string; subject: string; sentAt: string };

export default function EmailCenterModal() {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sent, setSent] = useState<SentEmail[]>([]);
  const toRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function findLink(): HTMLElement | null {
      const links = Array.from(document.querySelectorAll('.side a'));
      return (links.find(
        (a) => (a.textContent || '').replace(/\d+/g, '').trim().toLowerCase() === 'email center'
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

  useEffect(() => {
    if (open) setTimeout(() => toRef.current?.focus(), 80);
  }, [open]);

  async function sendEmail() {
    if (!to.trim() || !subject.trim() || !body.trim() || sending) return;
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), html: bodyToHtml(body) }),
      });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || d.error) throw new Error(d.error || 'Failed to send.');
      setSent(prev => [{ to: to.trim(), subject: subject.trim(), sentAt: new Date().toISOString() }, ...prev]);
      setSuccess(`Email sent to ${to.trim()}`);
      setTo(''); setSubject(''); setBody('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error.');
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div style={overlay} onClick={() => setOpen(false)}>
      <div style={panel} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={head}>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em', margin: 0 }}>Email Center</h3>
            <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3 }}>From: info@amazingsolutions.ca</div>
          </div>
          <button style={xBtn} onClick={() => setOpen(false)} aria-label="Close">×</button>
        </div>

        <div style={twoCol}>
          {/* Compose */}
          <div style={compose}>
            <div style={sectionTitle}>Compose</div>

            {error && (
              <div style={errBox}>
                ⚠️ {error}
                {error.includes('RESEND_API_KEY') && (
                  <div style={{ fontWeight: 400, fontSize: 12, marginTop: 6 }}>
                    Add <code>RESEND_API_KEY</code> to Vercel → Environment Variables.
                    Get a free key at <strong>resend.com</strong>.
                    Also add <code>EMAIL_FROM</code> = <code>Amazing Solutions &lt;info@amazingsolutions.ca&gt;</code>.
                  </div>
                )}
              </div>
            )}

            {success && (
              <div style={{ background: '#e7f7ee', color: C.good, padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
                ✓ {success}
              </div>
            )}

            <div style={field}>
              <label style={lbl}>To *</label>
              <input
                ref={toRef}
                style={inp}
                type="email"
                placeholder="client@example.com"
                value={to}
                onChange={e => setTo(e.target.value)}
              />
            </div>

            <div style={field}>
              <label style={lbl}>Subject *</label>
              <input
                style={inp}
                placeholder="Your subject line"
                value={subject}
                onChange={e => setSubject(e.target.value)}
              />
            </div>

            <div style={field}>
              <label style={lbl}>Message *</label>
              <textarea
                style={{ ...inp, height: 180, resize: 'vertical', paddingTop: 10, paddingBottom: 10 }}
                placeholder="Write your message here…"
                value={body}
                onChange={e => setBody(e.target.value)}
              />
            </div>

            <button
              style={{ ...sendBtn, opacity: (to && subject && body && !sending) ? 1 : 0.5 }}
              onClick={sendEmail}
              disabled={!to.trim() || !subject.trim() || !body.trim() || sending}
            >
              {sending ? 'Sending…' : '✉ Send Email'}
            </button>
          </div>

          {/* Sent log */}
          <div style={sentCol}>
            <div style={sectionTitle}>Sent This Session</div>
            {sent.length === 0 ? (
              <div style={{ color: C.sub, fontSize: 13, marginTop: 12 }}>No emails sent yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sent.map((s, i) => (
                  <div key={i} style={sentCard}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.ink, marginBottom: 2 }}>{s.subject}</div>
                    <div style={{ fontSize: 12, color: C.sub }}>To: {s.to}</div>
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>{fmtTime(s.sentAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function bodyToHtml(text: string): string {
  return '<p>' + text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
}

function fmtTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

// ── Styles ───────────────────────────────────────────────────────────────────
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(20,24,27,0.55)', backdropFilter: 'blur(2px)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  padding: '40px 20px', zIndex: 9999, overflowY: 'auto',
};
const panel: React.CSSProperties = {
  width: '100%', maxWidth: 900, background: '#fff', borderRadius: 18,
  padding: '24px 26px 28px', boxShadow: '0 30px 70px rgba(0,0,0,0.3)',
  fontFamily: "'Manrope', sans-serif", color: C.ink,
  display: 'flex', flexDirection: 'column', gap: 20,
};
const head: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' };
const xBtn: React.CSSProperties = { border: 'none', background: 'transparent', fontSize: 26, lineHeight: 1, color: C.sub, cursor: 'pointer', padding: 0 };
const twoCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 };
const compose: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14 };
const sentCol: React.CSSProperties = { borderLeft: `1px solid ${C.line}`, paddingLeft: 24 };
const sectionTitle: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: C.sub, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 };
const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 };
const lbl: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: C.ink };
const inp: React.CSSProperties = {
  border: `1px solid ${C.line}`, borderRadius: 9, padding: '0 12px',
  fontSize: 13.5, fontFamily: "'Manrope', sans-serif", outline: 'none',
  color: C.ink, background: '#fff', height: 40,
};
const sendBtn: React.CSSProperties = {
  height: 44, border: 'none', borderRadius: 11, background: C.teal, color: '#fff',
  fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4,
};
const errBox: React.CSSProperties = {
  background: '#fdecec', color: C.bad, fontSize: 13, fontWeight: 600,
  padding: '10px 14px', borderRadius: 10, lineHeight: 1.5,
};
const sentCard: React.CSSProperties = {
  background: C.mist, borderRadius: 10, padding: '10px 12px', border: `1px solid ${C.line}`,
};
