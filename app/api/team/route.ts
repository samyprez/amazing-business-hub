import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdmin } from '@supabase/supabase-js';

async function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!serviceKey) return null;
  return createAdmin(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', status: 401 as const, user: null, supabase: null };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!['staff', 'admin', 'super_admin'].includes(profile?.role ?? ''))
    return { error: 'Forbidden', status: 403 as const, user: null, supabase: null };
  return { error: null, status: 200 as const, user, supabase };
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error || !gate.supabase) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const adminClient = await getAdminClient();
  const client = adminClient ?? gate.supabase;

  const { data, error } = await client
    .from('profiles')
    .select('id, full_name, role, created_at')
    .in('role', ['super_admin', 'admin', 'staff'])
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ members: data ?? [] });
}

export async function DELETE(req: Request) {
  const gate = await requireAdmin();
  if (gate.error || !gate.supabase) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { data: callerProfile } = await gate.supabase.from('profiles').select('role').eq('id', gate.user!.id).single();
  if (!['admin', 'super_admin'].includes(callerProfile?.role ?? ''))
    return NextResponse.json({ error: 'Only admins can remove team members' }, { status: 403 });

  const { id } = await req.json() as { id?: string };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (id === gate.user!.id) return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });

  const adminClient = await getAdminClient();
  if (!adminClient) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY required to remove users' }, { status: 500 });

  // Delete from auth (cascades to profiles via trigger, or delete profile manually)
  const { error } = await adminClient.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
