import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function requireStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', status: 401 as const, supabase: null };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!['staff', 'admin', 'super_admin'].includes(profile?.role ?? ''))
    return { error: 'Forbidden', status: 403 as const, supabase: null };
  return { error: null, status: 200 as const, supabase };
}

const STATUSES = ['collecting', 'processing', 'finishing', 'done'];

export async function GET() {
  const gate = await requireStaff();
  if (gate.error || !gate.supabase) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { data, error } = await gate.supabase
    .from('projects')
    .select('id, name, status, completion_date, created_at, client_id, clients(company_name), project_links(id, title, url)')
    .order('completion_date', { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ projects: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireStaff();
  if (gate.error || !gate.supabase) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json() as { name?: string; client_id?: string; completion_date?: string; status?: string };
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const { data, error } = await gate.supabase
    .from('projects')
    .insert({ name: body.name.trim(), client_id: body.client_id || null, completion_date: body.completion_date || null, status: body.status || 'collecting' })
    .select('id, name, status, completion_date, created_at, client_id, clients(company_name), project_links(id, title, url)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ project: data }, { status: 201 });
}

export async function PATCH(req: Request) {
  const gate = await requireStaff();
  if (gate.error || !gate.supabase) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json() as { id?: string; name?: string; status?: string; completion_date?: string; client_id?: string };
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body.name) patch.name = body.name;
  if (body.status && STATUSES.includes(body.status)) patch.status = body.status;
  if (body.completion_date !== undefined) patch.completion_date = body.completion_date || null;
  if (body.client_id !== undefined) patch.client_id = body.client_id || null;

  const { data, error } = await gate.supabase
    .from('projects').update(patch).eq('id', body.id)
    .select('id, name, status, completion_date, client_id, clients(company_name), project_links(id, title, url)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ project: data });
}

export async function DELETE(req: Request) {
  const gate = await requireStaff();
  if (gate.error || !gate.supabase) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { id } = await req.json() as { id?: string };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await gate.supabase.from('projects').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
