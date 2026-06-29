// app/api/clients/route.ts
//
// Crea un cliente nuevo en Supabase.
//  - Corre del lado del servidor: lee la sesion desde las cookies, asi el
//    RLS ve al usuario (super_admin) y permite el insert. Las llaves nunca
//    llegan al navegador.
//  - Valida sesion + rol antes de insertar.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();

  // 1. Autenticacion
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  // 2. Rol (staff o superior)
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role;
  if (!role || !['staff', 'admin', 'super_admin'].includes(role)) {
    return NextResponse.json({ error: 'Sin permiso.' }, { status: 403 });
  }

  // 3. Leer y validar el cuerpo
  let body: {
    company_name?: string;
    contact_name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const companyName = (body.company_name || '').trim();
  if (!companyName) {
    return NextResponse.json(
      { error: 'El nombre de la empresa es obligatorio.' },
      { status: 400 }
    );
  }

  // 4. Insertar
  const { data, error } = await supabase
    .from('clients')
    .insert({
      company_name: companyName,
      contact_name: (body.contact_name || '').trim() || null,
      email: (body.email || '').trim() || null,
      phone: (body.phone || '').trim() || null,
      address: (body.address || '').trim() || null,
      is_active: true,
    })
    .select('id, company_name')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ client: data }, { status: 201 });
}

// Lista todos los clientes (para la vista de Clientes). Misma validacion de
// sesion + rol; la lectura corre server-side, las llaves no llegan al cliente.
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role;
  if (!role || !['staff', 'admin', 'super_admin'].includes(role)) {
    return NextResponse.json({ error: 'Sin permiso.' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('clients')
    .select('id, company_name, contact_name, email, phone, address, is_active')
    .order('company_name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ clients: data ?? [] }, { status: 200 });
}
