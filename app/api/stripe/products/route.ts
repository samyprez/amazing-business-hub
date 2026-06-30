import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ products: [] });

  const [productsRes, pricesRes] = await Promise.all([
    fetch('https://api.stripe.com/v1/products?active=true&limit=100', {
      headers: { Authorization: `Bearer ${key}` },
    }),
    fetch('https://api.stripe.com/v1/prices?active=true&limit=100&expand[]=data.product', {
      headers: { Authorization: `Bearer ${key}` },
    }),
  ]);

  const [productsData, pricesData] = await Promise.all([
    productsRes.json() as Promise<{ data?: { id: string; name: string; description: string }[] }>,
    pricesRes.json() as Promise<{ data?: { id: string; product: string; unit_amount: number; currency: string }[] }>,
  ]);

  const pricesByProduct: Record<string, { id: string; unit_amount: number; currency: string }[]> = {};
  (pricesData.data || []).forEach((p) => {
    const prod = typeof p.product === 'string' ? p.product : (p.product as unknown as { id: string }).id;
    if (!pricesByProduct[prod]) pricesByProduct[prod] = [];
    pricesByProduct[prod].push({ id: p.id, unit_amount: p.unit_amount, currency: p.currency });
  });

  const products = (productsData.data || []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    prices: pricesByProduct[p.id] || [],
  }));

  return NextResponse.json({ products });
}
