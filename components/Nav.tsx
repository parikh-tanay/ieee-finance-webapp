import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import LogoutButton from './LogoutButton';

export default async function Nav() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let role = 'user';
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role,full_name').eq('id', user.id).single();
    role = profile?.role || 'user';
  }

  return (
    <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
      <div className="flex items-center gap-4">
        <Link href="/" className="font-display text-navy">IEEE SB Ledger</Link>
        <Link href="/account" className="text-sm text-inkSoft">My Account</Link>
        {(role === 'admin' || role === 'master') && <Link href="/admin" className="text-sm text-inkSoft">Admin</Link>}
        {role === 'master' && <Link href="/master" className="text-sm text-inkSoft">Master</Link>}
      </div>
      <LogoutButton />
    </div>
  );
}
