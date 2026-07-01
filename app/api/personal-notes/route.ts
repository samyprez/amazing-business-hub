import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('personal_notes')
    .select('id, content, checked, position, created_at')
    .eq('user_id', user.id)
    .order('checked', { ascending: true })
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(req: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { content?: string };
  if (!body.content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 });

  const { data: last } = await supabase
    .from('personal_notes')
    .select('position')
    .eq('user_id', user.id)
    .order('position', { ascending: false })
    .limit(1)
    .single();

  const position = (last?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from('personal_notes')
    .insert({ user_id: user.id, content: body.content.trim(), position })
    .select('id, content, checked, position, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ note: data }, { status: 201 });
}

export async function PATCH(req: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { id?: string; checked?: boolean; content?: string };
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body.checked !== undefined) patch.checked = body.checked;
  if (body.content !== undefined) patch.content = body.content;

  const { data, error } = await supabase
    .from('personal_notes')
    .update(patch)
    .eq('id', body.id)
    .eq('user_id', user.id)
    .select('id, content, checked, position')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ note: data });
}

export async function DELETE(req: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json() as { id?: string };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase
    .from('personal_notes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
