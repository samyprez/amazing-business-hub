// app/api/invoices/route.ts
//
// API de Facturas (registro). Corre server-side con la sesion del usuario.
//  GET   -> lista facturas (con datos del cliente)
//  POST  -> crea una factura  { client_id?, description?, amount*, currency? }
//  PATCH -> cambia estado manual  { id*, status }  (borrador/enviada/pagada/cancelada)
//
// El cobro online con Stripe vive en /api/invoices/stripe (se activa con llaves).

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const STATUSES = ['unpaid', 'paid', 'overdue'];

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
    .from('invoices')
    .select('id, number, amount, status, issued_at, due_date, stripe_invoice_id, created_at, client_id, clients(company_name, email)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ invoices: data ?? [] }, { status: 200 });
}

export async function POST(request: Request) {
  const gate = await requireStaff();
  if (gate.error || !gate.supabase) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let body: {
    client_id?: string | null;
    number?: string | null;
    amount?: number | string;
    due_date?: string | null;
    issued_at?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: 'El monto debe ser un número mayor o igual a 0.' }, { status: 400 });
  }

  const { data, error } = await gate.supabase
    .from('invoices')
    .insert({
      client_id: body.client_id || null,
      number: body.number || null,
      amount,
      status: 'unpaid',
      issued_at: body.issued_at || new Date().toISOString().split('T')[0],
      due_date: body.due_date || null,
    })
    .select('id, number, amount, status, issued_at, due_date, stripe_invoice_id, created_at, client_id, clients(company_name, email)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ invoice: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const gate = await requireStaff();
  if (gate.error || !gate.supabase) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let body: { id?: string; status?: string; number?: string | null; due_date?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  if (!body.id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: 'Estado invalido.' }, { status: 400 });
    patch.status = body.status;
  }
  if (body.number !== undefined) patch.number = body.number;
  if (body.due_date !== undefined) patch.due_date = body.due_date;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nada que actualizar.' }, { status: 400 });

  const { data, error } = await gate.supabase
    .from('invoices').update(patch).eq('id', body.id)
    .select('id, number, status, due_date').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ invoice: data }, { status: 200 });
}
