import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const STATUSES = ['new', 'contacted', 'converted', 'lost'];
const SELECT = 'id, name, email, phone, status, created_at';

async function requireStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado.', status: 401 as const, supabase: null };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!['staff', 'admin', 'super_admin'].includes(profile?.role ?? ''))
    return { error: 'Sin permiso.', status: 403 as const, supabase: null };
  return { error: null, status: 200 as const, supabase };
}

export async function GET() {
  const gate = await requireStaff();
  if (gate.error || !gate.supabase) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { data, error } = await gate.supabase.from('leads').select(SELECT).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ leads: data ?? [] });
}

export async function POST(request: Request) {
  const gate = await requireStaff();
  if (gate.error || !gate.supabase) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const body = await request.json() as { name?: string; email?: string | null; phone?: string | null };
  const name = (body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 });
  const { data, error } = await gate.supabase
    .from('leads')
    .insert({ name, email: (body.email || '').trim() || null, phone: (body.phone || '').trim() || null, status: 'new' })
    .select(SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ lead: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const gate = await requireStaff();
  if (gate.error || !gate.supabase) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const body = await request.json() as { id?: string; name?: string; email?: string | null; phone?: string | null; status?: string };
  if (!body.id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.email !== undefined) patch.email = (body.email || '').trim() || null;
  if (body.phone !== undefined) patch.phone = (body.phone || '').trim() || null;
  if (body.status && STATUSES.includes(body.status)) patch.status = body.status;

  const { data, error } = await gate.supabase
    .from('leads').update(patch).eq('id', body.id).select(SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ lead: data });
}

export async function DELETE(request: Request) {
  const gate = await requireStaff();
  if (gate.error || !gate.supabase) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id } = await request.json() as { id?: string };
  if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
  const { error } = await gate.supabase.from('leads').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
