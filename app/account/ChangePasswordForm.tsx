'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ChangePasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleChangePassword() {
    setError(''); setMsg('');

    if (next.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setError('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // Re-verify identity with the current password before allowing the
    // change — updateUser() alone only checks that the session is valid,
    // not that the person typing knows the current password. This closes
    // the gap where someone walks up to an already-logged-in, unattended
    // laptop and changes the password to lock the real owner out.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      setError('Could not verify your account. Try signing in again.');
      setLoading(false);
      return;
    }

    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (verifyErr) {
      setError('Current password is incorrect.');
      setLoading(false);
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: next });
    setLoading(false);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }

    setMsg('Password changed successfully.');
    setCurrent(''); setNext(''); setConfirm('');
  }

  return (
    <div className="rounded-xl p-5 max-w-md" style={{ background: '#1A1E27', border: '1px solid #2B3142' }}>
      <label className="field-label">Current Password</label>
      <input type="password" value={current} onChange={e => setCurrent(e.target.value)} className="mb-3" />

      <label className="field-label">New Password (min 8 characters)</label>
      <input type="password" value={next} onChange={e => setNext(e.target.value)} className="mb-3" />

      <label className="field-label">Confirm New Password</label>
      <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="mb-4" />

      {error && <div className="text-expense text-sm mb-3">{error}</div>}
      {msg && <div className="text-income text-sm mb-3 success-pop">✓ {msg}</div>}

      <button onClick={handleChangePassword} disabled={loading}
        className="px-4 py-2.5 rounded-lg text-sm font-bold tracking-wide" style={{ background: '#E8A33D', color: '#12151B' }}>
        {loading ? 'UPDATING…' : 'CHANGE PASSWORD'}
      </button>
    </div>
  );
}
