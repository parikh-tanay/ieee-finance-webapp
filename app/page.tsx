import { createClient } from '@/lib/supabase/server';
import Nav from '@/components/Nav';
import Link from 'next/link';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: fests } = await supabase.from('fests').select('*').order('created_at', { ascending: false });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Nav />
      <h1 className="font-display text-2xl mb-1">Select a Fest</h1>
      <p className="text-inkSoft text-sm mb-6">Open a fest to log income or expense. New fests are created from the Admin section.</p>

      {(!fests || fests.length === 0) ? (
        <div className="bg-white rounded-lg border border-border p-6 text-sm text-inkSoft">
          No fests yet. An Admin needs to create one first.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {fests.map(f => (
            <Link key={f.id} href={`/fest/${f.id}`}
              className="bg-white rounded-lg border border-border p-4 hover:border-gold transition-colors">
              <div className="font-display text-lg">{f.name}</div>
              <div className="text-xs text-inkSoft uppercase tracking-wide mt-1">{f.status}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
