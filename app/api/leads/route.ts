// app/api/leads/route.ts
//
// API de Leads. Corre server-side con la sesion del usuario (RLS aplica).
//  GET   -> lista todos los leads
//  POST  -> crea un lead  { name*, company?, email?, phone?, source?, notes? }
//  PATCH -> actualiza estado  { id*, status }

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const STATUSES = ['nuevo', 'contactado', 'calificado', 'propuesta', 'ganado', 'perdido'];

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
    .from('leads')
    .select('id, name, company, email, phone, source, status, notes, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ leads: data ?? [] }, { status: 200 });
}

export async function POST(request: Request) {
  const gate = await requireStaff();
  if (gate.error || !gate.supabase) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let body: {
    name?: string;
    company?: string | null;
    email?: string | null;
    phone?: string | null;
    source?: string | null;
    notes?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const name = (body.name || '').trim();
  if (!name) {
    return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 });
  }

  const clean = (v: string | null | undefined) => (v || '').toString().trim() || null;

  const { data, error } = await gate.supabase
    .from('leads')
    .insert({
      name,
      company: clean(body.company),
      email: clean(body.email),
      phone: clean(body.phone),
      source: clean(body.source),
      notes: clean(body.notes),
      status: 'nuevo',
    })
    .select('id, name, company, email, phone, source, status, notes, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ lead: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const gate = await requireStaff();
  if (gate.error || !gate.supabase) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let body: { id?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: 'Falta el id del lead.' }, { status: 400 });
  }
  if (!body.status || !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Estado invalido.' }, { status: 400 });
  }

  const { data, error } = await gate.supabase
    .from('leads')
    .update({ status: body.status })
    .eq('id', body.id)
    .select('id, status')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ lead: data }, { status: 200 });
}
