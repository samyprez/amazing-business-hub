import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tickets')
    .select('*, clients(company_name, contact_name)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();
  const { data, error } = await supabase
    .from('tickets')
    .insert({
      client_id: body.client_id,
      subject: body.subject,
      description: body.description || null,
      priority: body.priority || 'medium',
      status: body.status || 'open',
    })
    .select('*, clients(company_name)')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
