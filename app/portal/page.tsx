import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import RawPage from '@/components/RawPage';
import { markup, script } from '@/content/portal';

export const dynamic = 'force-dynamic';

export default async function PortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role;
  if (role && ['staff', 'admin', 'super_admin'].includes(role)) redirect('/admin');
  return <RawPage markup={markup} script={script} />;
}
