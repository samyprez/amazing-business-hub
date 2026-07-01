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

export async function POST(req: Request) {
  const gate = await requireStaff();
  if (gate.error || !gate.supabase) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json() as { project_id?: string; title?: string; url?: string };
  if (!body.project_id || !body.title?.trim() || !body.url?.trim())
    return NextResponse.json({ error: 'project_id, title, url required' }, { status: 400 });

  const { data, error } = await gate.supabase
    .from('project_links')
    .insert({ project_id: body.project_id, title: body.title.trim(), url: body.url.trim() })
    .select('id, title, url')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ link: data }, { status: 201 });
}

export async function DELETE(req: Request) {
  const gate = await requireStaff();
  if (gate.error || !gate.supabase) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { id } = await req.json() as { id?: string };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await gate.supabase.from('project_links').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
