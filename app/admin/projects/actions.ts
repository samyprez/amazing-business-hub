'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

type Status = 'not_started' | 'in_progress' | 'review' | 'done';

async function requireStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!['staff', 'admin', 'super_admin'].includes(profile?.role ?? '')) redirect('/portal');
  return supabase;
}

export async function createProject(formData: FormData) {
  const supabase = await requireStaff();
  const name = (formData.get('name') as string | null)?.trim();
  if (!name) return;

  const { error } = await supabase.from('projects').insert({
    name,
    client_id: (formData.get('client_id') as string | null) || null,
    status: (formData.get('status') as Status) || 'collecting',
    start_date: (formData.get('start_date') as string | null) || null,
    completion_date: (formData.get('completion_date') as string | null) || null,
    notes: (formData.get('notes') as string | null) || null,
  });

  if (!error) revalidatePath('/admin/projects');
}

export async function deleteProject(id: string) {
  const supabase = await requireStaff();
  await supabase.from('projects').delete().eq('id', id);
  revalidatePath('/admin/projects');
}

export async function updateProjectStatus(id: string, status: Status) {
  const supabase = await requireStaff();
  await supabase.from('projects').update({ status }).eq('id', id);
  revalidatePath('/admin/projects');
}

export async function addProjectLink(formData: FormData) {
  const supabase = await requireStaff();
  const project_id = formData.get('project_id') as string;
  const title = (formData.get('title') as string | null)?.trim();
  const url = (formData.get('url') as string | null)?.trim();
  if (!project_id || !title || !url) return;

  await supabase.from('project_links').insert({ project_id, title, url });
  revalidatePath('/admin/projects');
}

export async function deleteProjectLink(id: string) {
  const supabase = await requireStaff();
  await supabase.from('project_links').delete().eq('id', id);
  revalidatePath('/admin/projects');
}
