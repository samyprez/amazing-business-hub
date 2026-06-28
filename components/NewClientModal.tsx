'use client';

// components/NewClientModal.tsx
//
// Modal para crear un cliente nuevo. Se monta junto al dashboard (que se
// renderiza por innerHTML en RawPage) y se "engancha" al boton existente
// ".nb" (New Client) por delegacion de eventos, sin tocar el markup.

import { useEffect, useState } from 'react';

const C = {
  teal: '#10BEB2',
  tealDeep: '#0E9E95',
  ink: '#222A2E',
  sub: '#697479',
  line: '#e7eded',
  bad: '#d2603a',
};

export default function NewClientModal() {
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Engancharse al boton "New Client" del markup inyectado.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('.nb')) {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  function reset() {
    setCompanyName('');
    setContactName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setError(null);
  }

  function close() {
    if (saving) return;
    setOpen(false);
    reset();
  }

  async function handleSubmit() {
    if (!companyName.trim()) {
      setError('El nombre de la empresa es obligatorio.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName.trim(),
          contact_name: contactName.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'No se pudo crear el cliente.');
      }
      // Exito: recargar para que el dashboard muestre el dato nuevo.
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div style={overlay} onClick={close}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <h3 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' }}>
            Nuevo cliente
          </h3>
          <button style={x} onClick={close} aria-label="Cerrar">×</button>
        </div>

        <label style={label}>
          Empresa <span style={{ color: C.bad }}>*</span>
        </label>
        <input
          style={input}
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Ej. La Cocina"
          autoFocus
        />

        <label style={label}>Persona de contacto</label>
        <input
          style={input}
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          placeholder="Ej. Maria Lopez"
        />

        <label style={label}>Email</label>
        <input
          style={input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Ej. maria@lacocina.com"
        />

        <label style={label}>Teléfono</label>
        <input
          style={input}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Ej. (416) 555-0199"
        />

        <label style={label}>Dirección</label>
        <input
          style={input}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Ej. 123 Yonge St, Toronto, ON"
        />

        {error && <div style={errBox}>{error}</div>}

        <div style={actions}>
          <button style={ghost} onClick={close} disabled={saving}>
            Cancelar
          </button>
          <button style={primary} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando…' : 'Crear cliente'}
          </button>
        </div>
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
  maxWidth: 420,
  background: '#fff',
  borderRadius: 18,
  padding: '24px 26px 22px',
  boxShadow: '0 30px 70px rgba(0,0,0,0.35)',
  fontFamily: "'Manrope', sans-serif",
  color: C.ink,
};

const head: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 18,
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

const label: React.CSSProperties = {
  display: 'block',
  fontWeight: 700,
  fontSize: 12.5,
  margin: '0 0 6px',
};

const input: React.CSSProperties = {
  width: '100%',
  height: 46,
  border: `1px solid ${C.line}`,
  borderRadius: 11,
  padding: '0 13px',
  fontSize: 14.5,
  fontFamily: 'inherit',
  outline: 'none',
  marginBottom: 14,
  boxSizing: 'border-box',
};

const errBox: React.CSSProperties = {
  background: '#fdecec',
  color: C.bad,
  fontSize: 13,
  fontWeight: 600,
  padding: '10px 12px',
  borderRadius: 10,
  marginBottom: 14,
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
  flex: 1.4,
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
