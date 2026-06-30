import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('*, clients(company_name, contact_name, email)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();
  const { data, error } = await supabase
    .from('invoices')
    .insert({
      client_id: body.client_id,
      number: body.number || null,
      amount: body.amount ?? 0,
      status: body.status || 'unpaid',
      issued_at: body.issued_at || new Date().toISOString().split('T')[0],
      due_date: body.due_date || null,
      stripe_invoice_id: body.stripe_invoice_id || null,
    })
    .select('*, clients(company_name)')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
