// app/api/webhooks/stripe/route.ts
//
// Webhook de Stripe. Stripe llama aqui cuando una factura se paga, y nosotros
// marcamos el registro como 'pagada'. NO usa sesion de usuario (lo llama
// Stripe), por eso usa la SERVICE ROLE key de Supabase para saltarse RLS.
//
// Variables necesarias (en Vercel):
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// En el panel de Stripe configura el endpoint:
//   https://amazing-business-hub.vercel.app/api/webhooks/stripe
//   eventos: invoice.paid

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret || !webhookSecret || !url || !serviceKey) {
    return NextResponse.json({ error: 'Webhook no configurado.' }, { status: 400 });
  }

  const stripe = new Stripe(secret);
  const sig = request.headers.get('stripe-signature');
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig || '', webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'firma invalida';
    return NextResponse.json({ error: `Firma invalida: ${msg}` }, { status: 400 });
  }

  if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice;
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
    await supabase
      .from('invoices')
      .update({ status: 'pagada' })
      .eq('stripe_invoice_id', invoice.id);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
