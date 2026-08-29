import { createClient } from '@/lib/supabase/server';
import Nav from '@/components/Nav';
import Link from 'next/link';
import { StatusDot } from '@/components/Meter';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: fests } = await supabase.from('fests').select('*').order('created_at', { ascending: false });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Nav />
      <h1 className="font-display font-bold text-2xl tracking-wide mb-1">SELECT A FEST</h1>
      <p className="text-inkSoft text-sm mb-6">Open a fest to log income or expense. New fests are created from the Admin section.</p>

      {(!fests || fests.length === 0) ? (
        <div className="bg-surface rounded-xl border border-border p-6 text-sm text-inkSoft">
          No fests yet. An Admin needs to create one first.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {fests.map(f => (
            <Link key={f.id} href={`/fest/${f.id}`}
              className="group bg-surface rounded-xl border border-border p-4 hover:border-copper transition-all hover:shadow-[0_0_24px_rgba(232,163,61,0.08)]">
              <div className="flex items-center justify-between">
                <div className="font-display font-bold text-lg tracking-wide group-hover:text-copper transition-colors">{f.name}</div>
                <StatusDot color={f.status === 'active' ? '#4ADE80' : '#8B90A0'} live={f.status === 'active'} />
              </div>
              <div className="text-xs text-inkSoft uppercase tracking-widest mt-1 font-mono">{f.status}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
