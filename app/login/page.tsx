'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { StatusDot } from '@/components/Meter';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError('Incorrect email or password.');
      return;
    }
    localStorage.setItem('ieee_login_time', String(Date.now()));
    router.push('/');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'radial-gradient(ellipse at top, #1A1E27, #0F1218)' }}>
      <div className="w-full max-w-sm meter-in">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <StatusDot color="#E8A33D" live />
            <div className="font-display font-bold text-2xl tracking-wide text-ink">IEEE SB</div>
          </div>
          <div className="text-inkSoft text-xs tracking-[0.2em] uppercase font-mono">Finance Control Panel</div>
        </div>

        <div className="bg-surface rounded-xl border border-border p-6 shadow-[0_0_40px_rgba(232,163,61,0.04)]">
          <label className="field-label">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mb-3" placeholder="you@college.edu" />
          <label className="field-label">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mb-4"
            onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          {error && <div className="text-expense text-sm mb-3 bg-expenseSoft border border-expense/30 rounded-md px-3 py-2">{error}</div>}
          <button onClick={handleLogin} disabled={loading}
            className="w-full py-2.5 rounded-lg bg-copper text-bg text-sm font-bold tracking-wide hover:brightness-110 transition disabled:opacity-60">
            {loading ? 'AUTHENTICATING…' : 'SIGN IN'}
          </button>
          <div className="circuit-divider" />
          <p className="text-xs text-inkSoft text-center leading-relaxed">
            No account? Ask your Admin or Master to create one for you.<br />
            Forgot your password? Ask your Master to reset it from the Master page.
          </p>
        </div>
      </div>
    </div>
  );
}
