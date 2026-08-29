'use client';

export function PresenceBar({ users }: { users: { name: string }[] }) {
  if (users.length === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-inkSoft font-mono uppercase tracking-wide">Online now:</span>
      {users.map((u, i) => (
        <span key={u.name + i}
          className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full"
          style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ADE80' }}>
          <span className="inline-block w-1.5 h-1.5 rounded-full status-dot-live" style={{ background: '#4ADE80' }} />
          {u.name}
        </span>
      ))}
    </div>
  );
}
