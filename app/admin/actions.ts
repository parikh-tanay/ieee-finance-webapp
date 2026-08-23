'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin' && profile?.role !== 'master') throw new Error('Admin access required');
  return { supabase, user };
}

export async function createFest(name: string) {
  const { supabase, user } = await assertAdmin();
  if (!name.trim()) return { error: 'Name required' };
  const { error } = await supabase.from('fests').insert({ name: name.trim(), created_by: user.id });
  if (error) return { error: error.message };
  revalidatePath('/admin'); revalidatePath('/');
  return { success: true };
}

export async function closeFest(id: string, status: string) {
  const { supabase } = await assertAdmin();
  const { error } = await supabase.from('fests').update({ status }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { success: true };
}

export async function createEvent(festId: string, name: string) {
  const { supabase, user } = await assertAdmin();
  if (!name.trim()) return { error: 'Name required' };
  const { error } = await supabase.from('events').insert({ fest_id: festId, name: name.trim(), created_by: user.id });
  if (error) return { error: error.message };
  revalidatePath('/admin'); revalidatePath(`/fest/${festId}`);
  return { success: true };
}

export async function deleteEvent(id: string, festId: string) {
  const { supabase } = await assertAdmin();
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin'); revalidatePath(`/fest/${festId}`);
  return { success: true };
}

export async function createVendor(name: string, contact: string) {
  const { supabase } = await assertAdmin();
  if (!name.trim()) return { error: 'Name required' };
  const { error } = await supabase.from('vendors').insert({ name: name.trim(), contact: contact.trim() || null });
  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { success: true };
}

export async function deleteVendor(id: string) {
  const { supabase } = await assertAdmin();
  const { error } = await supabase.from('vendors').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { success: true };
}

export async function createCategory(name: string, kind: 'expense' | 'income') {
  const { supabase } = await assertAdmin();
  if (!name.trim()) return { error: 'Name required' };
  const { error } = await supabase.from('categories').insert({ name: name.trim(), kind });
  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { success: true };
}

export async function deleteCategory(id: string) {
  const { supabase } = await assertAdmin();
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { success: true };
}
