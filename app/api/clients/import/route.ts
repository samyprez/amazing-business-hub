// app/api/clients/import/route.ts
//
// Importa clientes en LOTE desde un CSV ya parseado en el navegador.
//  - Corre del lado del servidor: lee la sesion desde las cookies, asi el RLS
//    ve al usuario (super_admin) y permite el insert. Las llaves nunca llegan
//    al navegador.
//  - Valida sesion + rol antes de insertar.
//  - Regla TODO-O-NADA: si alguna fila no trae company_name, NO se inserta
//    nada y se devuelve el numero de fila para avisar.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Incoming = {
  company_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

const MAX_ROWS = 2000;

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
  let body: { clients?: Incoming[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const list = Array.isArray(body.clients) ? body.clients : null;
  if (!list || list.length === 0) {
    return NextResponse.json({ error: 'No hay filas para importar.' }, { status: 400 });
  }
  if (list.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Demasiadas filas (máximo ${MAX_ROWS} por importación).` },
      { status: 400 }
    );
  }

  // 4. Regla todo-o-nada: validar TODAS antes de insertar.
  const rows = [];
  for (let i = 0; i < list.length; i++) {
    const company = (list[i]?.company_name || '').toString().trim();
    if (!company) {
      return NextResponse.json(
        { error: `La fila ${i + 1} no tiene empresa. No se importó nada.` },
        { status: 400 }
      );
    }
    rows.push({
      company_name: company,
      contact_name: (list[i].contact_name || '').toString().trim() || null,
      email: (list[i].email || '').toString().trim() || null,
      phone: (list[i].phone || '').toString().trim() || null,
      address: (list[i].address || '').toString().trim() || null,
      is_active: true,
    });
  }

  // 5. Insertar en un solo statement.
  const { data, error } = await supabase
    .from('clients')
    .insert(rows)
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ inserted: data?.length ?? rows.length }, { status: 201 });
}
