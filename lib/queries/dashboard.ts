// lib/queries/dashboard.ts
//
// Capa de queries tipada para el dashboard de admin.
// Corre del lado del servidor (usa lib/supabase/server.ts), así las llaves
// de Supabase nunca llegan al cliente.
//
// DISEÑO DEFENSIVO: cada query está envuelta en try/catch y cae a 0 / []
// si la tabla está vacía, no existe todavía, o falla. El dashboard nunca
// se rompe por falta de datos — simplemente muestra ceros.

import { createClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export type PaymentRow = {
  client_name: string;
  amount: number;
  method: string | null;
  status: string | null;
};

export type ClientRow = {
  name: string;
  plan: string | null;
  monthly_amount: number;
  status: string | null;
};

export type RenewalRow = {
  client_name: string;
  plan: string | null;
  renewal_date: string | null;
};

export type DashboardData = {
  totalClients: number;
  monthlyRevenue: number;
  outstanding: number;
  newLeads: number;
  openTickets: number;
  recentPayments: PaymentRow[];
  topClients: ClientRow[];
  upcomingRenewals: RenewalRow[];
};

// Valor por defecto: todo en cero. Es lo que se renderiza si todo falla.
const EMPTY: DashboardData = {
  totalClients: 0,
  monthlyRevenue: 0,
  outstanding: 0,
  newLeads: 0,
  openTickets: 0,
  recentPayments: [],
  topClients: [],
  upcomingRenewals: [],
};

// Helper: corre una promesa y devuelve un fallback si lanza o si Supabase
// reporta error. Nunca propaga la excepción hacia arriba.
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Query principal
// ---------------------------------------------------------------------------
export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  // --- KPIs ---------------------------------------------------------------
  const totalClients = await safe(async () => {
    const { count, error } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'lead');
    if (error) throw error;
    return count ?? 0;
  }, 0);

  const newLeads = await safe(async () => {
    const { count, error } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'lead');
    if (error) throw error;
    return count ?? 0;
  }, 0);

  const monthlyRevenue = await safe(async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('monthly_amount')
      .eq('status', 'active');
    if (error) throw error;
    return (data ?? []).reduce((sum, r) => sum + Number(r.monthly_amount ?? 0), 0);
  }, 0);

  const outstanding = await safe(async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('amount')
      .neq('status', 'paid');
    if (error) throw error;
    return (data ?? []).reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  }, 0);

  const openTickets = await safe(async () => {
    const { count, error } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');
    if (error) throw error;
    return count ?? 0;
  }, 0);

  // --- Tablas / listas ----------------------------------------------------
  const recentPayments = await safe<PaymentRow[]>(async () => {
    const { data, error } = await supabase
      .from('payments')
      .select('amount, method, status, clients(name)')
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      client_name: (r.clients as { name?: string } | null)?.name ?? '—',
      amount: Number(r.amount ?? 0),
      method: (r.method as string) ?? null,
      status: (r.status as string) ?? null,
    }));
  }, []);

  const topClients = await safe<ClientRow[]>(async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('name, plan, monthly_amount, status')
      .eq('status', 'active')
      .order('monthly_amount', { ascending: false })
      .limit(4);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      name: r.name as string,
      plan: (r.plan as string) ?? null,
      monthly_amount: Number(r.monthly_amount ?? 0),
      status: (r.status as string) ?? null,
    }));
  }, []);

  const upcomingRenewals = await safe<RenewalRow[]>(async () => {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('plan, renewal_date, clients(name)')
      .gte('renewal_date', new Date().toISOString().slice(0, 10))
      .order('renewal_date', { ascending: true })
      .limit(4);
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      client_name: (r.clients as { name?: string } | null)?.name ?? '—',
      plan: (r.plan as string) ?? null,
      renewal_date: (r.renewal_date as string) ?? null,
    }));
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
  };
}

export { EMPTY as EMPTY_DASHBOARD_DATA };
