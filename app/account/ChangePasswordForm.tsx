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
    <div className="bg-white rounded-lg border border-border p-5 max-w-md">
      <label className="field-label">Current Password</label>
      <input type="password" value={current} onChange={e => setCurrent(e.target.value)} className="mb-3" />

      <label className="field-label">New Password (min 8 characters)</label>
      <input type="password" value={next} onChange={e => setNext(e.target.value)} className="mb-3" />

      <label className="field-label">Confirm New Password</label>
      <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="mb-4" />

      {error && <div className="text-expense text-sm mb-3">{error}</div>}
      {msg && <div className="text-income text-sm mb-3">{msg}</div>}

      <button onClick={handleChangePassword} disabled={loading}
        className="px-4 py-2 rounded bg-navy text-white text-sm font-medium">
        {loading ? 'Updating…' : 'Change Password'}
      </button>
    </div>
  );
}