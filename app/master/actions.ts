'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

async function assertMaster() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'master') throw new Error('Only Master can do this');
  return user;
}

export async function createUser(formData: FormData) {
  await assertMaster(); // re-checked here even though the page is also gated — never trust the client alone

  const email = String(formData.get('email') || '').trim();
  const fullName = String(formData.get('fullName') || '').trim();
  const role = String(formData.get('role') || 'user');
  const password = String(formData.get('password') || '');

  if (!email || !fullName || !password || password.length < 8) {
    return { error: 'Valid email, name, and an 8+ character password are required.' };
  }
  if (!['master', 'admin', 'user'].includes(role)) {
    return { error: 'Invalid role.' };
  }

  const admin = createAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    return { error: createErr?.message || 'Could not create the account.' };
  }

  const { error: profileErr } = await admin.from('profiles').insert({
    id: created.user.id,
    full_name: fullName,
    role,
  });
  if (profileErr) {
    return { error: profileErr.message };
  }

  revalidatePath('/master');
  return { success: true };
}

export async function updateUserRole(userId: string, role: string) {
  await assertMaster();
  if (!['master', 'admin', 'user'].includes(role)) return { error: 'Invalid role' };
  const admin = createAdminClient();
  const { error } = await admin.from('profiles').update({ role }).eq('id', userId);
  if (error) return { error: error.message };
  revalidatePath('/master');
  return { success: true };
}

export async function deleteUser(userId: string) {
  const master = await assertMaster();
  if (userId === master.id) return { error: "You can't delete your own account." };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  revalidatePath('/master');
  return { success: true };
}
