'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr('');
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setErr('Email o contraseña incorrectos.');
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();
    const role = profile?.role;
    router.push(role === 'client' ? '/portal' : '/admin');
    router.refresh();
  }

  const wrap: React.CSSProperties = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    background:
      'radial-gradient(700px 420px at 80% 10%, rgba(16,190,178,.28), transparent 60%), linear-gradient(160deg,#222A2E,#14181b)',
  };
  const card: React.CSSProperties = {
    width: '100%', maxWidth: 380, background: '#fff', borderRadius: 22, padding: '34px 30px',
    boxShadow: '0 30px 70px rgba(0,0,0,.35)', textAlign: 'center',
  };
  const mk: React.CSSProperties = {
    width: 60, height: 60, borderRadius: 16, background: '#1c2225', display: 'flex',
    alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
  };
  const label: React.CSSProperties = { display: 'block', textAlign: 'left', fontWeight: 700, fontSize: 12.5, margin: '0 0 6px' };
  const input: React.CSSProperties = {
    width: '100%', height: 48, border: '1px solid #e7eded', borderRadius: 12, padding: '0 14px',
    fontSize: 15, fontFamily: 'inherit', outline: 'none', marginBottom: 14,
  };
  const button: React.CSSProperties = {
    width: '100%', height: 50, border: 'none', borderRadius: 12, background: '#10BEB2', color: '#fff',
    fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1,
  };

  return (
    <div style={wrap}>
      <form style={card} onSubmit={onSubmit}>
        <div style={mk}><img src="/mark-teal.png" alt="" style={{ width: 38 }} /></div>
        <h1 style={{ fontSize: 21, letterSpacing: '-.02em' }}>Iniciar sesión</h1>
        <div style={{ color: '#697479', fontSize: 14, margin: '4px 0 22px' }}>Amazing Business Solutions</div>
        <label style={label}>Email</label>
        <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label style={label}>Contraseña</label>
        <input style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {err && <div style={{ color: '#d2603a', fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <button style={button} type="submit" disabled={loading}>{loading ? 'Entrando…' : 'Entrar →'}</button>
      </form>
    </div>
  );
}
