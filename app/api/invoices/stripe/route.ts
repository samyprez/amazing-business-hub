// app/api/invoices/stripe/route.ts
//
// Genera la factura en Stripe para un registro de `invoices` y devuelve el
// link de pago (hosted_invoice_url). Se ACTIVA solo cuando STRIPE_SECRET_KEY
// existe en las variables de entorno (Vercel). Sin la llave, responde un
// mensaje claro y no rompe nada.
//
// Flujo Stripe: customer -> invoice item -> invoice -> finalize -> link.

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { error: 'Stripe no está configurado todavía. Agrega STRIPE_SECRET_KEY en Vercel.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['staff', 'admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sin permiso.' }, { status: 403 });
  }

  let body: { invoice_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }
  if (!body.invoice_id) {
    return NextResponse.json({ error: 'Falta el id de la factura.' }, { status: 400 });
  }

  // Trae el registro + datos del cliente
  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .select('id, amount, currency, description, status, stripe_invoice_id, hosted_invoice_url, clients(company_name, email)')
    .eq('id', body.invoice_id)
    .single();

  if (invErr || !inv) {
    return NextResponse.json({ error: 'Factura no encontrada.' }, { status: 404 });
  }
  if (inv.hosted_invoice_url) {
    // ya tiene link; lo devolvemos sin recrear
    return NextResponse.json({ hosted_invoice_url: inv.hosted_invoice_url, status: inv.status }, { status: 200 });
  }

  const client = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
  const stripe = new Stripe(secret);

  try {
    const customer = await stripe.customers.create({
      name: client?.company_name || 'Cliente',
      email: client?.email || undefined,
    });

    await stripe.invoiceItems.create({
      customer: customer.id,
      amount: Math.round(Number(inv.amount) * 100),
      currency: inv.currency || 'usd',
      description: inv.description || 'Factura',
    });

    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: 30,
      auto_advance: true,
    });

    const finalized = await stripe.invoices.finalizeInvoice(invoice.id as string);

    await supabase
      .from('invoices')
      .update({
        stripe_invoice_id: finalized.id,
        stripe_customer_id: customer.id,
        hosted_invoice_url: finalized.hosted_invoice_url,
        status: 'enviada',
      })
      .eq('id', inv.id);

    return NextResponse.json(
      { hosted_invoice_url: finalized.hosted_invoice_url, status: 'enviada' },
      { status: 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error con Stripe.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
