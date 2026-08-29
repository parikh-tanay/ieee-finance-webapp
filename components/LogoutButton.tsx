'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    localStorage.removeItem('ieee_login_time');
    router.push('/login');
    router.refresh();
  }
  return <button onClick={logout} className="text-xs text-inkSoft hover:text-expense transition px-3 py-1.5 rounded-full border border-border hover:border-expense/40">Sign out</button>;
}
