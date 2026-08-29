'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-sm" style={{ background: '#232836', border: '1px solid #3A4358' }}>
      <div className="text-inkSoft text-xs mb-1">{label}</div>
      <div className="font-mono font-semibold" style={{ color: '#E8A33D' }}>
        ₹{Number(payload[0].value).toLocaleString('en-IN')}
      </div>
    </div>
  );
}

export function CategoryBarChart({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) {
    return <div className="px-4 py-8 text-sm text-inkSoft text-center">No expense data yet — chart fills in as entries are logged.</div>;
  }
  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2B3142" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#8B90A0', fontSize: 11 }} axisLine={{ stroke: '#2B3142' }} tickLine={false} />
          <YAxis tick={{ fill: '#8B90A0', fontSize: 11 }} axisLine={{ stroke: '#2B3142' }} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(232,163,61,0.06)' }} />
          <Bar dataKey="value" fill="#E8A33D" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
