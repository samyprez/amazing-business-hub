﻿// app/admin/page.tsx
//
// Server component del dashboard de admin.
//  1. Verifica sesion + rol (staff o superior) -> redirige si no.
//  2. Trae los datos reales del dashboard desde Supabase.
//  3. Inyecta esos datos en el markup estatico ANTES de renderizar.
//
// Las llaves de Supabase nunca llegan al cliente: todo ocurre del lado
// del servidor y al navegador solo viaja HTML ya poblado.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import RawPage from '@/components/RawPage';
import NewClientModal from '@/components/NewClientModal';
import CsvImportModal from '@/components/CsvImportModal';
import ClientsListModal from '@/components/ClientsListModal';
import TicketsModal from '@/components/TicketsModal';
import LeadsModal from '@/components/LeadsModal';
import InvoicesModal from '@/components/InvoicesModal';
import { markup, script } from '@/content/admin';
import { getDashboardData } from '@/lib/queries/dashboard';
import { renderAdminMarkup } from '@/lib/render/admin';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role;
  if (!role || !['staff', 'admin', 'super_admin'].includes(role)) redirect('/portal');

  // Datos reales -> markup poblado.
  const data = await getDashboardData();
  const populatedMarkup = renderAdminMarkup(markup, data);

  return (
    <>
      <RawPage markup={populatedMarkup} script={script} />
      <NewClientModal />
      <CsvImportModal />
      <ClientsListModal />
      <TicketsModal />
      <LeadsModal />
      <InvoicesModal />
    </>
  );
}
