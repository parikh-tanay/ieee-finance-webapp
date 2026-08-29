import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import LogoutButton from './LogoutButton';
import SessionTimeoutGuard from './SessionTimeoutGuard';
import { StatusDot } from './Meter';

export default async function Nav() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let role = 'user';
  let fullName = '';
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role,full_name').eq('id', user.id).single();
    role = profile?.role || 'user';
    fullName = profile?.full_name || '';
  }

  const roleColor = role === 'master' ? '#E8A33D' : role === 'admin' ? '#4ADE80' : '#8B90A0';

  return (
    <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
      <SessionTimeoutGuard />
      <div className="flex items-center gap-5">
        <Link href="/" className="font-display font-bold text-lg tracking-wide text-ink flex items-center gap-2">
          <StatusDot color="#E8A33D" live />
          IEEE SB
        </Link>
        <Link href="/account" className="text-sm text-inkSoft hover:text-ink transition">My Account</Link>
        {(role === 'admin' || role === 'master') && <Link href="/admin" className="text-sm text-inkSoft hover:text-ink transition">Admin</Link>}
        {role === 'master' && <Link href="/master" className="text-sm text-inkSoft hover:text-ink transition">Master</Link>}
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden sm:flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded-full border border-border" style={{ color: roleColor }}>
          <StatusDot color={roleColor} />
          {fullName ? `${fullName} · ` : ''}{role.toUpperCase()}
        </span>
        <LogoutButton />
      </div>
    </div>
  );
}
