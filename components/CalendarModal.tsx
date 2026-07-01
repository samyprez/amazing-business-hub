'use client';

import { useEffect, useState } from 'react';

const C = { teal: '#10BEB2', ink: '#222A2E', sub: '#697479', line: '#e7eded' };

const CALENDAR_ID = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ID ?? '';

export default function CalendarModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function findLink(): HTMLElement | null {
      const links = Array.from(document.querySelectorAll('.side a'));
      return (links.find(
        (a) => (a.textContent || '').replace(/\d+/g, '').trim().toLowerCase() === 'calendar'
      ) as HTMLElement) || null;
    }
    let bound: HTMLElement | null = null;
    const onClick = (e: Event) => { e.preventDefault(); setOpen(true); };
    function ensure() {
      const link = findLink();
      if (!link || link === bound) return;
      bound = link; link.addEventListener('click', onClick);
    }
    ensure();
    const obs = new MutationObserver(() => ensure());
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  if (!open) return null;

  const calendarSrc = CALENDAR_ID
    ? `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(CALENDAR_ID)}&ctz=America%2FToronto&mode=MONTH&showTitle=0&showNav=1&showPrint=0&showTabs=1&showCalendars=0&color=%2310BEB2`
    : '';

  return (
    <div style={overlay} onClick={() => setOpen(false)}>
      <div style={panel} onClick={e => e.stopPropagation()}>
        <div style={head}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2.2" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <h3 style={{ fontSize: 20, fontWeight: 800 }}>Calendar</h3>
          </div>
          <button style={xBtn} onClick={() => setOpen(false)}>×</button>
        </div>

        {!CALENDAR_ID ? (
          <div style={setupBox}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Connect Google Calendar</div>
            <p style={{ fontSize: 13.5, lineHeight: 1.65, marginBottom: 16 }}>
              Add this environment variable to <b>Vercel → Settings → Environment Variables</b> and redeploy:
            </p>
            <div style={codeBlock}>
              <span style={{ color: '#10BEB2' }}>NEXT_PUBLIC_GOOGLE_CALENDAR_ID</span> = <span style={{ color: '#e0a32a' }}>your-calendar-id@group.calendar.google.com</span>
            </div>
            <p style={{ fontSize: 12.5, color: C.sub, marginTop: 14, lineHeight: 1.65 }}>
              <b>How to find it:</b> Google Calendar → Settings → click your calendar → Integrate calendar → Calendar ID.<br />
              The calendar must be set to <b>Public</b> or you must share it.
            </p>
          </div>
        ) : (
          <iframe
            src={calendarSrc}
            style={{ width: '100%', height: 580, border: 'none', borderRadius: 12 }}
            title="Google Calendar"
          />
        )}
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(20,24,27,0.55)', backdropFilter: 'blur(2px)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  padding: '40px 20px', zIndex: 9999, overflowY: 'auto',
};
const panel: React.CSSProperties = {
  width: '100%', maxWidth: 900, background: '#fff', borderRadius: 18,
  padding: '24px 26px 28px', boxShadow: '0 30px 70px rgba(0,0,0,0.3)',
  fontFamily: "'Manrope', sans-serif", color: C.ink,
  display: 'flex', flexDirection: 'column', gap: 18,
};
const head: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const xBtn: React.CSSProperties = { border: 'none', background: 'transparent', fontSize: 26, lineHeight: 1, color: C.sub, cursor: 'pointer', padding: 0 };
const setupBox: React.CSSProperties = { background: '#eafaf7', borderRadius: 14, padding: '20px 22px', fontSize: 13.5 };
const codeBlock: React.CSSProperties = { background: '#1a2023', color: '#e2e8f0', borderRadius: 10, padding: '12px 16px', fontFamily: 'monospace', fontSize: 13 };
