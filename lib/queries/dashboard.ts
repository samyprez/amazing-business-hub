// lib/queries/dashboard.ts
//
// Capa de queries tipada para el dashboard de admin (server-side).
// Schema real de Amazing Business Hub:
//   clients(company_name, is_active, ...)
//   client_services(client_id, service_id, status, price, renewal_date)
//   invoices(client_id, amount, status: 'paid'|'unpaid'|'overdue')
//   payments(client_id, invoice_id, amount, method, paid_at)
//   tickets(status: 'open'|'waiting'|'closed')
//   leads(name, service_interest, status, created_at)
//   services(name, category)
//
// DISENO DEFENSIVO: cada query cae a 0 / [] si la tabla esta vacia, no
// existe, o falla. El dashboard nunca se rompe por falta de datos.

import { createClient } from '@/lib/supabase/server';

export type PaymentRow = {
  client_name: string;
  amount: number;
  method: string | null;
};

export type TopClientRow = {
  company_name: string;
  service_name: string | null;
  monthly: number;
  status: string | null;
};

export type RenewalRow = {
  client_name: string;
  service_name: string | null;
  renewal_date: string | null;
};

export type LeadRow = {
  name: string | null;
  service_interest: string | null;
  created_at: string | null;
};

// Nuevo (Nivel 2): punto de la grafica mensual y rebanada del donut.
export type RevenuePoint = {
  label: string; // 'Jan', 'Feb', ...
  amount: number;
};

export type ServiceSlice = {
  label: string; // categoria o nombre del servicio
  amount: number;
};

export type DashboardData = {
  totalClients: number;
  monthlyRevenue: number;
  outstanding: number;
  newLeads: number;
  openTickets: number;
  recentPayments: PaymentRow[];
  topClients: TopClientRow[];
  upcomingRenewals: RenewalRow[];
  recentLeads: LeadRow[];
  revenueSeries: RevenuePoint[];
  revenueByService: ServiceSlice[];
};

const EMPTY: DashboardData = {
  totalClients: 0,
  monthlyRevenue: 0,
  outstanding: 0,
  newLeads: 0,
  openTickets: 0,
  recentPayments: [],
  topClients: [],
  upcomingRenewals: [],
  recentLeads: [],
  revenueSeries: [],
  revenueByService: [],
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  const totalClients = await safe(async () => {
    const { count, error } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    if (error) throw error;
    return count ?? 0;
  }, 0);

  const newLeads = await safe(async () => {
    const { count, error } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new');
    if (error) throw error;
    return count ?? 0;
  }, 0);

  const monthlyRevenue = await safe(async () => {
    const { data, error } = await supabase
      .from('client_services')
      .select('price')
      .eq('status', 'active');
    if (error) throw error;
    const rows = (data ?? []) as { price: number | null }[];
    return rows.reduce((sum, r) => sum + Number(r.price ?? 0), 0);
  }, 0);

  const outstanding = await safe(async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('amount')
      .neq('status', 'paid');
    if (error) throw error;
    const rows = (data ?? []) as { amount: number | null }[];
    return rows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  }, 0);

  const openTickets = await safe(async () => {
    const { count, error } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');
    if (error) throw error;
    return count ?? 0;
  }, 0);

  const recentPayments = await safe<PaymentRow[]>(async () => {
    const { data, error } = await supabase
      .from('payments')
      .select('amount, method, clients(company_name)')
      .order('paid_at', { ascending: false })
      .limit(5);
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      client_name: (r.clients as { company_name?: string } | null)?.company_name ?? '\u2014',
      amount: Number(r.amount ?? 0),
      method: (r.method as string) ?? null,
    }));
  }, []);

  const topClients = await safe<TopClientRow[]>(async () => {
    const { data, error } = await supabase
      .from('client_services')
      .select('price, status, clients(company_name), services(name)')
      .eq('status', 'active')
      .order('price', { ascending: false })
      .limit(4);
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      company_name: (r.clients as { company_name?: string } | null)?.company_name ?? '\u2014',
      service_name: (r.services as { name?: string } | null)?.name ?? null,
      monthly: Number(r.price ?? 0),
      status: (r.status as string) ?? null,
    }));
  }, []);

  const upcomingRenewals = await safe<RenewalRow[]>(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('client_services')
      .select('renewal_date, clients(company_name), services(name)')
      .gte('renewal_date', today)
      .order('renewal_date', { ascending: true })
      .limit(4);
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      client_name: (r.clients as { company_name?: string } | null)?.company_name ?? '\u2014',
      service_name: (r.services as { name?: string } | null)?.name ?? null,
      renewal_date: (r.renewal_date as string) ?? null,
    }));
  }, []);

  const recentLeads = await safe<LeadRow[]>(async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('name, service_interest, created_at')
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(4);
    if (error) throw error;
    const rows = (data ?? []) as { name: string | null; service_interest: string | null; created_at: string | null }[];
    return rows.map((r) => ({
      name: r.name ?? null,
      service_interest: r.service_interest ?? null,
      created_at: r.created_at ?? null,
    }));
  }, []);

  // --- Nivel 2: serie mensual de ingresos (ultimos 6 meses, desde payments) ---
  const revenueSeries = await safe<RevenuePoint[]>(async () => {
    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const { data, error } = await supabase
      .from('payments')
      .select('amount, paid_at')
      .gte('paid_at', since.toISOString());
    if (error) throw error;

    const buckets: { label: string; key: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        label: d.toLocaleString('en-US', { month: 'short' }),
        key: `${d.getFullYear()}-${d.getMonth()}`,
        amount: 0,
      });
    }
    const rows = (data ?? []) as { amount: number | null; paid_at: string | null }[];
    for (const r of rows) {
      if (!r.paid_at) continue;
      const d = new Date(r.paid_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const b = buckets.find((x) => x.key === key);
      if (b) b.amount += Number(r.amount ?? 0);
    }
    return buckets.map((b) => ({ label: b.label, amount: b.amount }));
  }, []);

  // --- Nivel 2: ingresos por servicio (client_services activos, agrupado) ---
  const revenueByService = await safe<ServiceSlice[]>(async () => {
    const { data, error } = await supabase
      .from('client_services')
      .select('price, status, services(name, category)')
      .eq('status', 'active');
    if (error) throw error;
    const rows = (data ?? []) as {
      price: number | null;
      services: { name?: string; category?: string } | null;
    }[];
    const map = new Map<string, number>();
    for (const r of rows) {
      const label = r.services?.category || r.services?.name || 'Other';
      map.set(label, (map.get(label) ?? 0) + Number(r.price ?? 0));
    }
    return [...map.entries()]
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, []);

  return {
    totalClients,
    monthlyRevenue,
    outstanding,
    newLeads,
    openTickets,
    recentPayments,
    topClients,
    upcomingRenewals,
    recentLeads,
    revenueSeries,
    revenueByService,
  };
}

export { EMPTY as EMPTY_DASHBOARD_DATA };
