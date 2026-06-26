// lib/queries/dashboard.ts
//
// Capa de queries tipada para el dashboard de admin.
// Corre del lado del servidor (usa lib/supabase/server.ts), así las llaves
// de Supabase nunca llegan al cliente.
//
// Esta versión usa el SCHEMA REAL de Amazing Business Hub:
//   clients(company_name, is_active, ...)
//   client_services(client_id, service_id, status, price, renewal_date)
//   invoices(client_id, amount, status: 'paid'|'unpaid'|'overdue')
//   payments(client_id, invoice_id, amount, method, paid_at)
//   tickets(status: 'open'|'waiting'|'closed')
//   leads(status: 'new'|'contacted'|'converted'|'lost')
//   services(name)
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

export type DashboardData = {
  totalClients: number;
  monthlyRevenue: number;
  outstanding: number;
  newLeads: number;
  openTickets: number;
  recentPayments: PaymentRow[];
  topClients: TopClientRow[];
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

  // Total de clientes activos.
  const totalClients = await safe(async () => {
    const { count, error } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    if (error) throw error;
    return count ?? 0;
  }, 0);

  // Leads nuevos (status = 'new').
  const newLeads = await safe(async () => {
    const { count, error } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new');
    if (error) throw error;
    return count ?? 0;
  }, 0);

  // Ingreso mensual recurrente: suma del price de los client_services activos.
  // (El precio efectivo del servicio contratado vive en client_services, no en clients.)
  const monthlyRevenue = await safe(async () => {
    const { data, error } = await supabase
      .from('client_services')
      .select('price')
      .eq('status', 'active');
    if (error) throw error;
    return (data ?? []).reduce((sum, r) => sum + Number(r.price ?? 0), 0);
  }, 0);

  // Outstanding: suma de facturas que NO están pagadas (unpaid + overdue).
  const outstanding = await safe(async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('amount')
      .neq('status', 'paid');
    if (error) throw error;
    return (data ?? []).reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  }, 0);

  // Tickets abiertos (badge en el sidebar).
  const openTickets = await safe(async () => {
    const { count, error } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');
    if (error) throw error;
    return count ?? 0;
  }, 0);

  // --- Tablas / listas ----------------------------------------------------

  // Pagos recientes. payments NO tiene status; el estado de cobro vive en
  // invoices, así que aquí solo mostramos cliente, monto y método.
  const recentPayments = await safe<PaymentRow[]>(async () => {
    const { data, error } = await supabase
      .from('payments')
      .select('amount, method, clients(company_name)')
      .order('paid_at', { ascending: false })
      .limit(5);
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      client_name: (r.clients as { company_name?: string } | null)?.company_name ?? '—',
      amount: Number(r.amount ?? 0),
      method: (r.method as string) ?? null,
    }));
  }, []);

  // Top clientes por valor del servicio contratado.
  // Salimos desde client_services (que tiene el price) y traemos el nombre
  // del cliente y del servicio por relación.
  const topClients = await safe<TopClientRow[]>(async () => {
    const { data, error } = await supabase
      .from('client_services')
      .select('price, status, clients(company_name), services(name)')
      .eq('status', 'active')
      .order('price', { ascending: false })
      .limit(4);
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      company_name: (r.clients as { company_name?: string } | null)?.company_name ?? '—',
      service_name: (r.services as { name?: string } | null)?.name ?? null,
      monthly: Number(r.price ?? 0),
      status: (r.status as string) ?? null,
    }));
  }, []);

  // Renovaciones próximas: client_services con renewal_date a futuro.
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
      client_name: (r.clients as { company_name?: string } | null)?.company_name ?? '—',
      service_name: (r.services as { name?: string } | null)?.name ?? null,
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
