import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function requireStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', status: 401 as const };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!['staff', 'admin', 'super_admin'].includes(profile?.role ?? ''))
    return { error: 'Forbidden', status: 403 as const };
  return { error: null, status: 200 as const };
}

export async function POST(req: Request) {
  const gate = await requireStaff();
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json() as { to?: string; subject?: string; html?: string; text?: string };
  const { to, subject, html, text } = body;

  if (!to?.trim() || !subject?.trim() || (!html && !text))
    return NextResponse.json({ error: 'to, subject, and body are required.' }, { status: 400 });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey)
    return NextResponse.json({ error: 'RESEND_API_KEY not configured in Vercel env vars.' }, { status: 500 });

  const from = process.env.EMAIL_FROM || 'Amazing Solutions <info@amazingsolutions.ca>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to.trim()],
      subject: subject.trim(),
      html: html || `<p>${text}</p>`,
    }),
  });

  const data = await res.json() as { id?: string; message?: string; name?: string };
  if (!res.ok) return NextResponse.json({ error: data.message || 'Failed to send email.' }, { status: 400 });
  return NextResponse.json({ ok: true, id: data.id });
}
