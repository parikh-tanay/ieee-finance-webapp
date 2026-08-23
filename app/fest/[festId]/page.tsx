import { createClient } from '@/lib/supabase/server';
import Nav from '@/components/Nav';
import FestWorkspace from './FestWorkspace';
import { notFound } from 'next/navigation';

export default async function FestPage({ params }: { params: Promise<{ festId: string }> }) {
  const { festId } = await params;
  const supabase = await createClient();
  const { data: fest } = await supabase.from('fests').select('*').eq('id', festId).single();
  if (!fest) notFound();

  const [{ data: events }, { data: vendors }, { data: categories }, { data: expenses }, { data: income }, { data: allocations }] = await Promise.all([
    supabase.from('events').select('*').eq('fest_id', festId).order('name'),
    supabase.from('vendors').select('*').order('name'),
    supabase.from('categories').select('*').order('name'),
    supabase.from('expenses').select('*, vendors(name), categories(name)').eq('fest_id', festId).order('expense_date', { ascending: false }),
    supabase.from('income_entries').select('*, categories(name)').eq('fest_id', festId).order('income_date', { ascending: false }),
    supabase.from('expense_allocations').select('*'),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Nav />
      <FestWorkspace
        fest={fest}
        events={events || []}
        vendors={vendors || []}
        categories={categories || []}
        expenses={expenses || []}
        income={income || []}
        allocations={allocations || []}
      />
    </div>
  );
}
