'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="font-display text-2xl text-navy">IEEE SB</div>
          <div className="text-inkSoft text-xs tracking-widest uppercase">Finance Ledger</div>
        </div>
        <div className="bg-white rounded-lg border border-border p-6">
          <label className="field-label">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mb-3" placeholder="you@college.edu" />
          <label className="field-label">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mb-4"
            onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          {error && <div className="text-expense text-sm mb-3">{error}</div>}
          <button onClick={handleLogin} disabled={loading}
            className="w-full py-2 rounded bg-navy text-white text-sm font-medium">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
          <p className="text-xs text-inkSoft mt-4 text-center">
            No account? Ask your Admin or Master to create one for you.
          </p>
        </div>
      </div>
    </div>
  );
}
