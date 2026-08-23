import { createClient } from '@/lib/supabase/server';
import Nav from '@/components/Nav';
import UserManager from './UserManager';

export default async function MasterPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Nav />
      <h1 className="font-display text-2xl mb-1">Master — User Accounts</h1>
      <p className="text-inkSoft text-sm mb-6">Create accounts for Admins and Users. Only Master can change roles or remove accounts.</p>
      <UserManager profiles={profiles || []} />
    </div>
  );
}
