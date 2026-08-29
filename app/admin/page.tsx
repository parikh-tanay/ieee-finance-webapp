import { createClient } from '@/lib/supabase/server';
import Nav from '@/components/Nav';
import AdminPanels from './AdminPanels';

export default async function AdminPage() {
  const supabase = await createClient();
  const [{ data: fests }, { data: events }, { data: vendors }, { data: categories }] = await Promise.all([
    supabase.from('fests').select('*').order('created_at', { ascending: false }),
    supabase.from('events').select('*, fests(name)').order('created_at', { ascending: false }),
    supabase.from('vendors').select('*').order('name'),
    supabase.from('categories').select('*').order('name'),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Nav />
      <h1 className="font-display font-bold text-2xl tracking-wide mb-1">ADMIN</h1>
      <p className="text-inkSoft text-sm mb-6">Create fests and their events, manage vendors, and define expense/income categories.</p>
      <AdminPanels
        fests={fests || []}
        events={events || []}
        vendors={vendors || []}
        categories={categories || []}
      />
    </div>
  );
}
