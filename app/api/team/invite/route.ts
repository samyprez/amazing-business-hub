import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdmin } from '@supabase/supabase-js';

export async function POST(req: Request) {
  // Only admins can invite
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!['admin', 'super_admin'].includes(profile?.role ?? ''))
    return NextResponse.json({ error: 'Only admins can invite team members' }, { status: 403 });

  const body = await req.json() as { email?: string; full_name?: string; role?: string };
  if (!body.email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl)
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured in Vercel env vars' }, { status: 500 });

  const admin = createAdmin(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data, error } = await admin.auth.admin.inviteUserByEmail(body.email.trim(), {
    data: { full_name: body.full_name || '', role: body.role || 'staff' },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Pre-fill profile if it exists
  if (data.user) {
    await admin.from('profiles').upsert({
      id: data.user.id,
      full_name: body.full_name || null,
      role: body.role || 'staff',
    }, { onConflict: 'id' });
  }

  return NextResponse.json({ ok: true, email: body.email });
}
