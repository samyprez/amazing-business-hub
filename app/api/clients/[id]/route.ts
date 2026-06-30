// app/api/clients/[id]/route.ts — PATCH to update a client
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function requireStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado.', status: 401 as const, supabase: null };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role;
  if (!role || !['staff', 'admin', 'super_admin'].includes(role)) {
    return { error: 'Sin permiso.', status: 403 as const, supabase: null };
  }
  return { error: null, status: 200 as const, supabase };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff();
  if (gate.error || !gate.supabase) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { id } = await params;
  let body: { company_name?: string; contact_name?: string | null; email?: string | null; is_active?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 }); }

  const patch: Record<string, unknown> = {};
  if (body.company_name !== undefined) patch.company_name = (body.company_name || '').trim() || null;
  if (body.contact_name !== undefined) patch.contact_name = (body.contact_name || '').toString().trim() || null;
  if (body.email !== undefined) patch.email = (body.email || '').toString().trim() || null;
  if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);

  const { data, error } = await gate.supabase
    .from('clients').update(patch).eq('id', id)
    .select('id, company_name, contact_name, email, is_active').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ client: data });
}
