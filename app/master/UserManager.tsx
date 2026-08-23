'use client';

import { useState, useTransition } from 'react';
import { createUser, updateUserRole, deleteUser, resetUserPassword } from './actions';

type Profile = { id: string; full_name: string; role: string; created_at: string };

export default function UserManager({ profiles }: { profiles: Profile[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ fullName: '', email: '', role: 'user', password: '' });
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');

  function submit() {
    setError(''); setMsg('');
    const fd = new FormData();
    fd.set('fullName', form.fullName);
    fd.set('email', form.email);
    fd.set('role', form.role);
    fd.set('password', form.password);
    startTransition(async () => {
      const res = await createUser(fd);
      if (res?.error) setError(res.error);
      else { setMsg('Account created.'); setForm({ fullName: '', email: '', role: 'user', password: '' }); }
    });
  }

  function changeRole(id: string, role: string) {
    startTransition(async () => { await updateUserRole(id, role); });
  }

  function remove(id: string) {
    if (!confirm('Remove this account? They will lose access immediately.')) return;
    startTransition(async () => { await deleteUser(id); });
  }

  function submitReset() {
    setResetError('');
    if (!resetTarget) return;
    startTransition(async () => {
      const res = await resetUserPassword(resetTarget.id, resetPassword);
      if (res?.error) {
        setResetError(res.error);
      } else {
        setResetTarget(null);
        setResetPassword('');
      }
    });
  }

  return (
    <div>
      <div className="bg-white rounded-lg border border-border p-5 mb-6">
        <div className="font-display text-lg mb-3">Add Account</div>
        <div className="grid md:grid-cols-2 gap-x-4 gap-y-3 mb-3">
          <div>
            <label className="field-label">Full Name</label>
            <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Role</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="master">Master</option>
            </select>
          </div>
          <div>
            <label className="field-label">Temporary Password (min 8 chars)</label>
            <input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
        </div>
        {error && <div className="text-expense text-sm mb-2">{error}</div>}
        {msg && <div className="text-income text-sm mb-2">{msg}</div>}
        <button onClick={submit} disabled={pending} className="px-4 py-2 rounded bg-navy text-white text-sm font-medium">
          {pending ? 'Working…' : 'Create Account'}
        </button>
        <p className="text-xs text-inkSoft mt-2">Share the email + temporary password with them directly (not over a public channel). They can log in immediately.</p>
      </div>

      <div className="bg-white rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="bg-bg text-inkSoft text-xs uppercase">
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {profiles.map(p => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-2.5">{p.full_name}</td>
                <td className="px-4 py-2.5">
                  <select value={p.role} onChange={e => changeRole(p.id, e.target.value)} className="!w-auto">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="master">Master</option>
                  </select>
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <button onClick={() => { setResetTarget(p); setResetPassword(''); setResetError(''); }} className="text-gold text-xs mr-3">Reset Password</button>
                  <button onClick={() => remove(p.id)} className="text-expense text-xs">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetTarget && (
        <div className="bg-white rounded-lg border border-gold p-5 mt-4 max-w-md">
          <div className="font-display text-lg mb-1">Reset Password — {resetTarget.full_name}</div>
          <p className="text-xs text-inkSoft mb-3">Sets a new password immediately. Share it with them directly (not over a public channel).</p>
          <label className="field-label">New Password (min 8 characters)</label>
          <input type="text" value={resetPassword} onChange={e => setResetPassword(e.target.value)} className="mb-3" />
          {resetError && <div className="text-expense text-sm mb-2">{resetError}</div>}
          <div className="flex gap-2">
            <button onClick={submitReset} disabled={pending} className="px-4 py-2 rounded bg-navy text-white text-sm font-medium">
              {pending ? 'Working…' : 'Set New Password'}
            </button>
            <button onClick={() => { setResetTarget(null); setResetPassword(''); }} className="px-4 py-2 rounded text-sm" style={{ border: '1px solid #DCE2ED', color: '#5B6B8C' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}