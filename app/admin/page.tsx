import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import RawPage from '@/components/RawPage';
import { markup, script } from '@/admin';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role;
  if (!role || !['staff', 'admin', 'super_admin'].includes(role)) redirect('/portal');
  return <RawPage markup={markup} script={script} />;
}
