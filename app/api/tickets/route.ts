// app/api/tickets/route.ts
//
// API de Tickets. Corre server-side con la sesion del usuario (RLS aplica;
// las llaves no llegan al navegador). Misma validacion de sesion + rol que
// el resto de las rutas.
//
//  GET   -> lista todos los tickets (con el nombre de la empresa del cliente)
//  POST  -> crea un ticket  { subject*, client_id?, priority?, description? }
//  PATCH -> actualiza estado/prioridad de un ticket  { id*, status?, priority? }

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const STATUSES = ['open', 'waiting', 'closed'];
const PRIORITIES = ['low', 'medium', 'high'];

async function requireStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado.', status: 401 as const, supabase: null };

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role;
  if (!role || !['staff', 'admin', 'super_admin'].includes(role)) {
    return { error: 'Sin permiso.', status: 403 as const, supabase: null };
  }
  return { error: null, status: 200 as const, supabase };
}

export async function GET() {
  const gate = await requireStaff();
  if (gate.error || !gate.supabase) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { data, error } = await gate.supabase
    .from('tickets')
    .select('id, subject, description, status, priority, created_at, client_id, clients(company_name)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ tickets: data ?? [] }, { status: 200 });
}

export async function POST(request: Request) {
  const gate = await requireStaff();
  if (gate.error || !gate.supabase) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let body: {
    subject?: string;
    client_id?: string | null;
    priority?: string;
    description?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const subject = (body.subject || '').trim();
  if (!subject) {
    return NextResponse.json({ error: 'El asunto es obligatorio.' }, { status: 400 });
  }
  const priority = PRIORITIES.includes(body.priority || '') ? body.priority : 'medium';

  const { data, error } = await gate.supabase
    .from('tickets')
    .insert({
      subject,
      client_id: body.client_id || null,
      priority,
      description: (body.description || '').toString().trim() || null,
      status: 'open',
    })
    .select('id, subject, description, status, priority, created_at, client_id, clients(company_name)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ticket: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const gate = await requireStaff();
  if (gate.error || !gate.supabase) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let body: { id?: string; status?: string; priority?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: 'Falta el id del ticket.' }, { status: 400 });
  }

  const patch: { status?: string; priority?: string } = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'Estado invalido.' }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (body.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority)) {
      return NextResponse.json({ error: 'Prioridad invalida.' }, { status: 400 });
    }
    patch.priority = body.priority;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar.' }, { status: 400 });
  }

  const { data, error } = await gate.supabase
    .from('tickets')
    .update(patch)
    .eq('id', body.id)
    .select('id, status, priority')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ticket: data }, { status: 200 });
}
