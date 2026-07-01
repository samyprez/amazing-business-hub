'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function SetupProfilePage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      setUserEmail(user.email ?? '');
      // Pre-fill name from invite metadata
      const meta = user.user_metadata as { full_name?: string };
      if (meta?.full_name) setFullName(meta.full_name);
      setLoading(false);
    }
    void init();
  }, []);

  async function save() {
    if (!password || password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSaving(true);
    setError(null);

    // Set password
    const { error: pwErr } = await supabase.auth.updateUser({ password });
    if (pwErr) { setError(pwErr.message); setSaving(false); return; }

    // Update profile name
    if (fullName.trim()) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', user.id);
      }
    }

    setSuccess(true);
    setTimeout(() => router.replace('/admin'), 1500);
  }

  if (loading) return (
    <div style={wrap}>
      <div style={card}><p style={{ color: '#697479' }}>Loading…</p></div>
    </div>
  );

  if (success) return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
        <h2 style={{ color: '#1a9f5e', marginBottom: 8 }}>Profile ready!</h2>
        <p style={{ color: '#697479' }}>Taking you to the dashboard…</p>
      </div>
    </div>
  );

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div style={logo}>AS</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '12px 0 4px' }}>Welcome to Amazing Solutions</h1>
          <p style={{ color: '#697479', fontSize: 14 }}>Set up your account to get started</p>
          {userEmail && <p style={{ color: '#10BEB2', fontSize: 13, fontWeight: 600, marginTop: 4 }}>{userEmail}</p>}
        </div>

        {error && (
          <div style={errBox}>{error}</div>
        )}

        <div style={field}>
          <label style={lbl}>Your Name</label>
          <input
            style={inp}
            placeholder="Full name"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            autoFocus
          />
        </div>

        <div style={field}>
          <label style={lbl}>Create Password *</label>
          <input
            style={inp}
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        <div style={field}>
          <label style={lbl}>Confirm Password *</label>
          <input
            style={inp}
            type="password"
            placeholder="Repeat your password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void save(); }}
          />
        </div>

        <button
          style={{ ...btn, opacity: (password && confirm && !saving) ? 1 : 0.5, marginTop: 8 }}
          onClick={save}
          disabled={!password || !confirm || saving}
        >
          {saving ? 'Saving…' : 'Set Password & Enter Dashboard →'}
        </button>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  minHeight: '100vh', background: '#f4f7f7', display: 'flex',
  alignItems: 'center', justifyContent: 'center', padding: 20,
  fontFamily: "'Manrope', 'Inter', sans-serif",
};
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 20, padding: '36px 32px',
  width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
  display: 'flex', flexDirection: 'column', gap: 14,
};
const logo: React.CSSProperties = {
  width: 56, height: 56, borderRadius: 14, margin: '0 auto',
  background: 'linear-gradient(135deg,#10BEB2,#0E9E95)',
  color: '#fff', fontWeight: 900, fontSize: 20,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 };
const lbl: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: '#222A2E' };
const inp: React.CSSProperties = {
  height: 42, border: '1px solid #e7eded', borderRadius: 10,
  padding: '0 13px', fontSize: 14, fontFamily: 'inherit',
  outline: 'none', color: '#222A2E', background: '#fff',
};
const btn: React.CSSProperties = {
  height: 46, border: 'none', borderRadius: 12,
  background: '#10BEB2', color: '#fff', fontWeight: 800,
  fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
};
const errBox: React.CSSProperties = {
  background: '#fdecec', color: '#d2603a', padding: '10px 14px',
  borderRadius: 10, fontSize: 13, fontWeight: 600,
};
