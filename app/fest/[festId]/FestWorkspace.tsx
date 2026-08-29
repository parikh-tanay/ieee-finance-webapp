'use client';

import { useState, useMemo, useTransition, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { addExpense, addIncome, deleteExpense, deleteIncome } from './actions';
import { safeExternalUrl } from '@/lib/safeUrl';
import { AnimatedNumber, StatusDot } from '@/components/Meter';
import { createClient } from '@/lib/supabase/client';
import { ToastStack, type Toast } from '@/components/Toast';
import { PresenceBar } from '@/components/PresenceBar';
import { CategoryBarChart } from '@/components/CategoryBarChart';

function inr(n: number) { return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// Excel sheet names: max 31 chars, no : \ / ? * [ ]
function sheetName(name: string) {
  return name.replace(/[:\\/?*\[\]]/g, '').slice(0, 31) || 'Sheet';
}

const EMPTY_FORM = {
  categoryId: '', vendorId: '', procuredByVolunteer: '', paidByVolunteer: '',
  itemName: '', quantity: '', unit: '', rate: '', amount: '', expenseDate: new Date().toISOString().slice(0, 10),
  travelFrom: '', travelTo: '', vehicleType: '', position: '', winnerName: '', prizeEventId: '',
  invoiceLink: '', paymentProofLink: '', notes: '',
};

export default function FestWorkspace({ fest, events, vendors, categories, expenses: initialExpenses, income: initialIncome, allocations: initialAllocations, profiles }: any) {
  const [tab, setTab] = useState('overview');
  const [expenses, setExpenses] = useState(initialExpenses);
  const [income, setIncome] = useState(initialIncome);
  const [allocations, setAllocations] = useState(initialAllocations);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<{ name: string }[]>([]);
  const currentUserIdRef = useRef<string | null>(null);
  const nameByIdRef = useRef<Record<string, string>>({});
  const categoryByIdRef = useRef<Record<string, string>>({});

  useEffect(() => {
    nameByIdRef.current = {};
    (profiles || []).forEach((p: any) => { nameByIdRef.current[p.id] = p.full_name; });
    categoryByIdRef.current = {};
    (categories || []).forEach((c: any) => { categoryByIdRef.current[c.id] = c.name; });
  }, [profiles, categories]);

  const expenseCategories = categories.filter((c: any) => c.kind === 'expense');
  const incomeCategories = categories.filter((c: any) => c.kind === 'income');

  function pushToast(message: string, tone: 'income' | 'expense') {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setToasts(t => [...t, { id, message, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
  }

  // Re-fetches this fest's data with the same joins the server page uses,
  // keeping shapes consistent. Simpler and more robust than trying to
  // hand-merge partial realtime payloads (which don't include joined
  // vendor/category names).
  async function refreshFestData() {
    const supabase = createClient();
    const [{ data: newExpenses }, { data: newIncome }, { data: newAllocations }] = await Promise.all([
      supabase.from('expenses').select('*, vendors(name), categories(name)').eq('fest_id', fest.id).order('expense_date', { ascending: false }),
      supabase.from('income_entries').select('*, categories(name)').eq('fest_id', fest.id).order('income_date', { ascending: false }),
      supabase.from('expense_allocations').select('*'),
    ]);
    if (newExpenses) setExpenses(newExpenses);
    if (newIncome) setIncome(newIncome);
    if (newAllocations) setAllocations(newAllocations);
  }

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (mounted) currentUserIdRef.current = user?.id || null;
    });

    // --- Live data sync + activity toasts ---
    const dataChannel = supabase
      .channel(`fest-data-${fest.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `fest_id=eq.${fest.id}` }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new.created_by !== currentUserIdRef.current) {
          const who = nameByIdRef.current[payload.new.created_by] || 'Someone';
          const cat = categoryByIdRef.current[payload.new.category_id] || TYPE_LABELS[payload.new.expense_type] || 'expense';
          pushToast(`${who} logged ${inr(payload.new.amount)} for ${cat}`, 'expense');
        }
        refreshFestData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'income_entries', filter: `fest_id=eq.${fest.id}` }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new.created_by !== currentUserIdRef.current) {
          const who = nameByIdRef.current[payload.new.created_by] || 'Someone';
          pushToast(`${who} logged ${inr(payload.new.amount)} income (${payload.new.income_type})`, 'income');
        }
        refreshFestData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_allocations' }, () => {
        refreshFestData();
      })
      .subscribe();

    // --- Presence: who currently has this fest open ---
    const presenceChannel = supabase.channel(`fest-presence-${fest.id}`, { config: { presence: { key: crypto.randomUUID() } } });
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const users = Object.values(state).flat().map((p: any) => ({ name: p.name }));
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data: { user } } = await supabase.auth.getUser();
          const name = user ? (nameByIdRef.current[user.id] || 'Teammate') : 'Teammate';
          await presenceChannel.track({ name });
        }
      });

    return () => {
      mounted = false;
      supabase.removeChannel(dataChannel);
      supabase.removeChannel(presenceChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fest.id]);

  const totals = useMemo(() => {
    const totalExpense = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
    const totalIncome = income.reduce((s: number, i: any) => s + Number(i.amount), 0);

    const byVendor: Record<string, number> = {};
    expenses.filter((e: any) => e.expense_type === 'vendor_purchase').forEach((e: any) => {
      const key = e.vendors?.name || 'Unknown vendor';
      byVendor[key] = (byVendor[key] || 0) + Number(e.amount);
    });

    const byEventExpense: Record<string, number> = {};
    allocations.forEach((a: any) => {
      const ev = events.find((e: any) => e.id === a.event_id);
      const key = ev?.name || 'Unallocated';
      byEventExpense[key] = (byEventExpense[key] || 0) + Number(a.amount);
    });

    const byEventIncome: Record<string, number> = {};
    income.filter((i: any) => i.income_type === 'registration' && i.event_id).forEach((i: any) => {
      const ev = events.find((e: any) => e.id === i.event_id);
      const key = ev?.name || 'Unknown event';
      byEventIncome[key] = (byEventIncome[key] || 0) + Number(i.amount);
    });

    // Leaderboard: who's logged the most entries (expenses + income combined)
    // for this fest — friendly competition, purely a count of activity.
    const nameById: Record<string, string> = {};
    (profiles || []).forEach((p: any) => { nameById[p.id] = p.full_name; });
    const entryCounts: Record<string, number> = {};
    [...expenses, ...income].forEach((e: any) => {
      if (!e.created_by) return;
      entryCounts[e.created_by] = (entryCounts[e.created_by] || 0) + 1;
    });
    const leaderboard = Object.entries(entryCounts)
      .map(([id, count]) => ({ name: nameById[id] || 'Unknown', count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Chart data: expense by category (vendor purchases), for the interactive bar chart.
    const byCategoryChart: Record<string, number> = {};
    expenses.filter((e: any) => e.expense_type === 'vendor_purchase').forEach((e: any) => {
      const key = e.categories?.name || 'Uncategorized';
      byCategoryChart[key] = (byCategoryChart[key] || 0) + Number(e.amount);
    });
    const chartData = Object.entries(byCategoryChart)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return { totalExpense, totalIncome, net: totalIncome - totalExpense, byVendor, byEventExpense, byEventIncome, leaderboard, chartData };
  }, [expenses, income, allocations, events, profiles]);

  return (
    <div>
      <ToastStack toasts={toasts} />

      <div className="mb-3">
        <PresenceBar users={onlineUsers} />
      </div>

      <div className="mb-5 flex items-center gap-2">
        <StatusDot color={fest.status === 'active' ? '#4ADE80' : '#8B90A0'} live={fest.status === 'active'} />
        <div>
          <h1 className="font-display font-bold text-2xl tracking-wide">{fest.name}</h1>
          <span className="text-xs text-inkSoft uppercase tracking-widest font-mono">{fest.status}</span>
        </div>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          ['overview', 'Overview'],
          ['expense', 'Add Expense'],
          ['income', 'Add Income'],
          ['entries', 'All Entries'],
          ['export', 'Export'],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={tab === id
              ? { background: '#E8A33D', color: '#12151B' }
              : { background: '#1A1E27', color: '#8B90A0', border: '1px solid #2B3142' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview totals={totals} />}
      {tab === 'expense' && (
        <AddExpenseForm festId={fest.id} vendors={vendors} categories={expenseCategories} events={events}
          onDone={() => setTab('entries')} />
      )}
      {tab === 'income' && (
        <AddIncomeForm festId={fest.id} events={events} categories={incomeCategories} onDone={() => setTab('entries')} />
      )}
      {tab === 'entries' && <EntriesList festId={fest.id} expenses={expenses} income={income} />}
      {tab === 'export' && <ExportPanel fest={fest} events={events} expenses={expenses} income={income} allocations={allocations} />}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'income' | 'expense' | 'neutral' }) {
  const color = tone === 'income' ? '#4ADE80' : tone === 'expense' ? '#F87171' : '#EDEDEF';
  return (
    <div className="rounded-xl p-4 flex-1 meter-in" style={{ background: '#1A1E27', border: '1px solid #2B3142' }}>
      <div className="flex items-center gap-2 mb-2" style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8B90A0' }}>
        <StatusDot color={color} live />
        {label}
      </div>
      <div className="font-mono text-2xl font-semibold" style={{ color }}>
        <AnimatedNumber value={value} format={inr} />
      </div>
    </div>
  );
}

function BreakdownCard({ title, data }: { title: string; data: Record<string, number> }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <div className="rounded-xl" style={{ background: '#1A1E27', border: '1px solid #2B3142' }}>
      <div className="px-4 py-2.5 font-display font-semibold tracking-wide" style={{ borderBottom: '1px solid #2B3142' }}>{title}</div>
      {rows.length === 0 ? (
        <div className="px-4 py-3 text-sm text-inkSoft">No data yet.</div>
      ) : rows.map(([k, v]) => (
        <div key={k} className="px-4 py-2 flex justify-between text-sm" style={{ borderTop: '1px solid #2B3142' }}>
          <span>{k}</span><span className="font-mono tabular-nums">{inr(v)}</span>
        </div>
      ))}
    </div>
  );
}

function Leaderboard({ data }: { data: { name: string; count: number }[] }) {
  const medals = ['#E8A33D', '#C0C4CC', '#B87333']; // gold copper / silver / bronze
  return (
    <div className="rounded-xl" style={{ background: '#1A1E27', border: '1px solid #2B3142' }}>
      <div className="px-4 py-2.5 font-display font-semibold tracking-wide flex items-center gap-2" style={{ borderBottom: '1px solid #2B3142' }}>
        🏆 Top Loggers This Fest
      </div>
      {data.length === 0 ? (
        <div className="px-4 py-3 text-sm text-inkSoft">No entries logged yet — first one gets the top spot.</div>
      ) : data.map((row, i) => (
        <div key={row.name} className="px-4 py-2.5 flex items-center justify-between text-sm" style={{ borderTop: '1px solid #2B3142' }}>
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold w-5 text-center" style={{ color: medals[i] || '#8B90A0' }}>#{i + 1}</span>
            <span>{row.name}</span>
          </div>
          <span className="font-mono tabular-nums text-inkSoft">{row.count} {row.count === 1 ? 'entry' : 'entries'}</span>
        </div>
      ))}
    </div>
  );
}

function Overview({ totals }: any) {
  return (
    <div>
      <div className="flex flex-col md:flex-row gap-3 mb-5">
        <StatCard label="Total Income" value={totals.totalIncome} tone="income" />
        <StatCard label="Total Expense" value={totals.totalExpense} tone="expense" />
        <StatCard label="Net" value={totals.net} tone={totals.net >= 0 ? 'income' : 'expense'} />
      </div>
      {totals.net < 0 && (
        <div className="rounded-lg px-4 py-3 text-sm mb-5" style={{ background: 'rgba(248,113,113,0.1)', color: '#F87171', border: '1px solid rgba(248,113,113,0.3)' }}>
          Expenses currently exceed income for this fest by {inr(Math.abs(totals.net))}.
        </div>
      )}

      <div className="rounded-xl mb-4" style={{ background: '#1A1E27', border: '1px solid #2B3142' }}>
        <div className="px-4 py-2.5 font-display font-semibold tracking-wide" style={{ borderBottom: '1px solid #2B3142' }}>Expense by Category</div>
        <div className="p-2">
          <CategoryBarChart data={totals.chartData} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <BreakdownCard title="Expense by Vendor" data={totals.byVendor} />
        <BreakdownCard title="Expense by Event (allocated)" data={totals.byEventExpense} />
      </div>
      <div className="mb-4">
        <BreakdownCard title="Registration Income by Event" data={totals.byEventIncome} />
      </div>

      <div className="circuit-divider" />
      <Leaderboard data={totals.leaderboard} />
    </div>
  );
}

const EXPENSE_TYPES = [
  { id: 'vendor_purchase', label: 'Vendor Purchase' },
  { id: 'volunteer_expense', label: 'Volunteer Expenditure' },
  { id: 'cab_travel', label: 'Cab Travel' },
  { id: 'personal_vehicle', label: 'Personal Vehicle' },
  { id: 'prizepool', label: 'Prizepool' },
];

function AddExpenseForm({ festId, vendors, categories, events, onDone }: any) {
  const [type, setType] = useState('vendor_purchase');
  const [form, setForm] = useState(EMPTY_FORM);
  const [allocations, setAllocations] = useState<{ eventId: string; quantity: string; amount: string }[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  function set(field: string, val: any) { setForm(f => ({ ...f, [field]: val })); }

  function addAllocRow() { setAllocations(a => [...a, { eventId: '', quantity: '', amount: '' }]); }
  function updateAlloc(i: number, field: string, val: string) {
    setAllocations(a => a.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  }
  function removeAlloc(i: number) { setAllocations(a => a.filter((_, idx) => idx !== i)); }

  // Auto-calculate amount from quantity × rate, whenever both are present —
  // still fully overridable, so bulk purchases (only a final total known)
  // just skip quantity/rate and type the amount directly.
  function updateQtyOrRate(field: 'quantity' | 'rate', val: string) {
    setForm(f => {
      const next = { ...f, [field]: val };
      const qty = Number(field === 'quantity' ? val : f.quantity);
      const rate = Number(field === 'rate' ? val : f.rate);
      if (qty > 0 && rate > 0) next.amount = String(qty * rate);
      return next;
    });
  }

  function submit() {
    setError(''); setMsg('');

    if (type === 'prizepool' && !form.prizeEventId) {
      setError('Select which event this prize belongs to.');
      return;
    }

    const finalAllocations = type === 'prizepool'
      ? [{ eventId: form.prizeEventId, quantity: '', amount: form.amount }]
      : allocations;

    startTransition(async () => {
      const res = await addExpense({
        festId, expenseType: type as any, ...form, allocations: finalAllocations,
      });
      if (res?.error) setError(res.error);
      else {
        setMsg('Expense logged.');
        setForm(EMPTY_FORM);
        setAllocations([]);
        onDone();
      }
    });
  }

  return (
    <div className="rounded-xl p-5 max-w-2xl" style={{ background: '#1A1E27', border: '1px solid #2B3142' }}>
      <div className="flex gap-2 mb-4 flex-wrap">
        {EXPENSE_TYPES.map(t => (
          <button key={t.id} onClick={() => setType(t.id)}
            className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={type === t.id
              ? { background: 'rgba(248,113,113,0.12)', color: '#F87171', border: '1px solid rgba(248,113,113,0.4)' }
              : { background: 'transparent', color: '#8B90A0', border: '1px solid #2B3142' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-x-4">
        {type === 'vendor_purchase' && (
          <div className="mb-3">
            <label className="field-label">Category *</label>
            <select value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
              <option value="">Select category</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        {type === 'vendor_purchase' && (
          <>
            <div className="mb-3">
              <label className="field-label">Vendor</label>
              <select value={form.vendorId} onChange={e => set('vendorId', e.target.value)}>
                <option value="">Select vendor</option>
                {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className="field-label">Volunteer Involved in Procurement</label>
              <input value={form.procuredByVolunteer} onChange={e => set('procuredByVolunteer', e.target.value)} placeholder="Who handled this purchase" />
            </div>
          </>
        )}

        {(type === 'volunteer_expense' || type === 'cab_travel' || type === 'personal_vehicle') && (
          <div className="mb-3">
            <label className="field-label">Paid By (Volunteer Name)</label>
            <input value={form.paidByVolunteer} onChange={e => set('paidByVolunteer', e.target.value)} />
          </div>
        )}

        {type === 'cab_travel' && (
          <>
            <div className="mb-3">
              <label className="field-label">Travel From</label>
              <input value={form.travelFrom} onChange={e => set('travelFrom', e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="field-label">Travel To</label>
              <input value={form.travelTo} onChange={e => set('travelTo', e.target.value)} />
            </div>
          </>
        )}

        {type === 'personal_vehicle' && (
          <div className="mb-3">
            <label className="field-label">Vehicle Type</label>
            <select value={form.vehicleType} onChange={e => set('vehicleType', e.target.value)}>
              <option value="">Select</option>
              <option value="2-Wheeler">2-Wheeler</option>
              <option value="4-Wheeler">4-Wheeler</option>
            </select>
          </div>
        )}

        {type === 'prizepool' && (
          <>
            <div className="mb-3">
              <label className="field-label">Event *</label>
              <select value={form.prizeEventId} onChange={e => set('prizeEventId', e.target.value)}>
                <option value="">Select event</option>
                {events.map((ev: any) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className="field-label">Position</label>
              <input value={form.position} onChange={e => set('position', e.target.value)} placeholder="e.g. 1st, 2nd, Runner-up" />
            </div>
            <div className="mb-3">
              <label className="field-label">Winner Name</label>
              <input value={form.winnerName} onChange={e => set('winnerName', e.target.value)} />
            </div>
          </>
        )}

        <div className="mb-3">
          <label className="field-label">{type === 'prizepool' ? 'Prize Description *' : 'Item / Description *'}</label>
          <input value={form.itemName} onChange={e => set('itemName', e.target.value)}
            placeholder={type === 'prizepool' ? 'e.g. Cash Prize, Trophy' : 'e.g. A4 sheets'} />
        </div>

        <div className="mb-3">
          <label className="field-label">Date</label>
          <input type="date" value={form.expenseDate} onChange={e => set('expenseDate', e.target.value)} />
        </div>

        {type === 'personal_vehicle' ? (
          <>
            <div className="mb-3">
              <label className="field-label">Total KMs</label>
              <input type="number" value={form.quantity} onChange={e => updateQtyOrRate('quantity', e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="field-label">Rate per KM (₹)</label>
              <input type="number" value={form.rate} onChange={e => updateQtyOrRate('rate', e.target.value)} />
            </div>
          </>
        ) : type === 'vendor_purchase' ? (
          <>
            <div className="mb-3">
              <label className="field-label">Quantity</label>
              <input type="number" value={form.quantity} onChange={e => updateQtyOrRate('quantity', e.target.value)} placeholder="Leave blank for bulk/lump-sum" />
            </div>
            <div className="mb-3">
              <label className="field-label">Unit</label>
              <input value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="e.g. pcs, gms, kg, packets" />
            </div>
            <div className="mb-3">
              <label className="field-label">Rate (per unit)</label>
              <input type="number" value={form.rate} onChange={e => updateQtyOrRate('rate', e.target.value)} placeholder="Leave blank for bulk/lump-sum" />
            </div>
          </>
        ) : null}

        <div className="mb-3">
          <label className="field-label">Total Amount (₹) *</label>
          <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} />
          {type === 'vendor_purchase' && <p className="text-xs text-inkSoft mt-1">Auto-fills from Quantity × Rate when both are set — edit freely for bulk/lump-sum purchases.</p>}
        </div>

        <div className="mb-3">
          <label className="field-label">Invoice Link</label>
          <input value={form.invoiceLink} onChange={e => set('invoiceLink', e.target.value)} placeholder="https://drive.google.com/..." />
        </div>

        <div className="mb-3">
          <label className="field-label">Payment Screenshot Link</label>
          <input value={form.paymentProofLink} onChange={e => set('paymentProofLink', e.target.value)} placeholder="https://drive.google.com/..." />
        </div>
      </div>

      <div className="mb-3">
        <label className="field-label">Notes</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} style={{ minHeight: '50px' }} />
      </div>

      {type !== 'prizepool' && (
        <div className="mb-4 pt-3" style={{ borderTop: '1px solid #2B3142' }}>
          <div className="flex items-center justify-between mb-2">
            <label className="field-label mb-0">Which event(s) used this? (optional)</label>
            <button onClick={addAllocRow} className="text-xs text-copper">+ Split across event</button>
          </div>
          {allocations.map((row, i) => (
            <div key={i} className="flex gap-2 mb-2 items-center">
              <select value={row.eventId} onChange={e => updateAlloc(i, 'eventId', e.target.value)}>
                <option value="">Select event</option>
                {events.map((ev: any) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
              <input type="number" placeholder="Qty" value={row.quantity} onChange={e => updateAlloc(i, 'quantity', e.target.value)} className="!w-24" />
              <input type="number" placeholder="Amount ₹" value={row.amount} onChange={e => updateAlloc(i, 'amount', e.target.value)} className="!w-28" />
              <button onClick={() => removeAlloc(i)} className="text-expense text-xs shrink-0">✕</button>
            </div>
          ))}
          {allocations.length === 0 && <p className="text-xs text-inkSoft">Leave blank if this wasn't assigned to specific events.</p>}
        </div>
      )}

      {error && <div className="text-expense text-sm mb-2">{error}</div>}
      {msg && <div className="text-income text-sm mb-2 success-pop">✓ {msg}</div>}
      <button onClick={submit} disabled={pending}
        className="px-4 py-2.5 rounded-lg text-sm font-bold tracking-wide transition disabled:opacity-60"
        style={{ background: '#E8A33D', color: '#12151B' }}>
        {pending ? 'SAVING…' : 'LOG EXPENSE'}
      </button>
    </div>
  );
}

function AddIncomeForm({ festId, events, categories, onDone }: any) {
  const [type, setType] = useState('registration');
  const [form, setForm] = useState({
    eventId: '', categoryId: '', incomeDate: new Date().toISOString().slice(0, 10),
    registrationsCount: '', amount: '', sourceName: '', driveLink: '', notes: '',
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  function set(field: string, val: any) { setForm(f => ({ ...f, [field]: val })); }

  function submit() {
    setError(''); setMsg('');
    startTransition(async () => {
      const res = await addIncome({ festId, incomeType: type as any, ...form });
      if (res?.error) setError(res.error);
      else {
        setMsg('Income logged.');
        setForm({ eventId: '', categoryId: '', incomeDate: new Date().toISOString().slice(0, 10), registrationsCount: '', amount: '', sourceName: '', driveLink: '', notes: '' });
        onDone();
      }
    });
  }

  return (
    <div className="rounded-xl p-5 max-w-2xl" style={{ background: '#1A1E27', border: '1px solid #2B3142' }}>
      <div className="flex gap-2 mb-4">
        {[['registration', 'Registration'], ['sponsorship', 'Sponsorship'], ['other', 'Other']].map(([id, label]) => (
          <button key={id} onClick={() => setType(id)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
            style={type === id
              ? { background: 'rgba(74,222,128,0.12)', color: '#4ADE80', border: '1px solid rgba(74,222,128,0.4)' }
              : { background: 'transparent', color: '#8B90A0', border: '1px solid #2B3142' }}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-x-4">
        {type === 'registration' && (
          <div className="mb-3">
            <label className="field-label">Event</label>
            <select value={form.eventId} onChange={e => set('eventId', e.target.value)}>
              <option value="">Select event</option>
              {events.map((ev: any) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
          </div>
        )}
        {type === 'other' && (
          <div className="mb-3">
            <label className="field-label">Category</label>
            <select value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
              <option value="">Select category</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        {type === 'registration' && (
          <div className="mb-3">
            <label className="field-label">No. of Registrations (today)</label>
            <input type="number" value={form.registrationsCount} onChange={e => set('registrationsCount', e.target.value)} />
          </div>
        )}
        <div className="mb-3">
          <label className="field-label">Date</label>
          <input type="date" value={form.incomeDate} onChange={e => set('incomeDate', e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="field-label">Amount (₹) *</label>
          <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="field-label">{type === 'sponsorship' ? 'Sponsor Name' : 'Source / Payer'}</label>
          <input value={form.sourceName} onChange={e => set('sourceName', e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="field-label">Drive Link (proof)</label>
          <input value={form.driveLink} onChange={e => set('driveLink', e.target.value)} placeholder="https://drive.google.com/..." />
        </div>
      </div>

      <div className="mb-3">
        <label className="field-label">Notes</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} style={{ minHeight: '50px' }} />
      </div>

      {error && <div className="text-expense text-sm mb-2">{error}</div>}
      {msg && <div className="text-income text-sm mb-2 success-pop">✓ {msg}</div>}
      <button onClick={submit} disabled={pending}
        className="px-4 py-2.5 rounded-lg text-sm font-bold tracking-wide transition disabled:opacity-60"
        style={{ background: '#E8A33D', color: '#12151B' }}>
        {pending ? 'SAVING…' : 'LOG INCOME'}
      </button>
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  vendor_purchase: 'Vendor Purchase',
  volunteer_expense: 'Volunteer Expenditure',
  cab_travel: 'Cab Travel',
  personal_vehicle: 'Personal Vehicle',
  prizepool: 'Prizepool',
};

function ProofLink({ url, label }: { url: string | null | undefined; label: string }) {
  const safe = safeExternalUrl(url);
  if (!safe) return <span className="text-inkSoft">—</span>;
  return (
    <a href={safe} target="_blank" rel="noopener noreferrer" className="text-copper hover:underline">
      {label}
    </a>
  );
}

function EntriesList({ festId, expenses, income }: any) {
  const [view, setView] = useState<'expense' | 'income'>('expense');
  const [pending, startTransition] = useTransition();

  function removeExpense(id: string) {
    if (!confirm('Delete this expense entry?')) return;
    startTransition(async () => { await deleteExpense(id, festId); });
  }
  function removeIncome(id: string) {
    if (!confirm('Delete this income entry?')) return;
    startTransition(async () => { await deleteIncome(id, festId); });
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <button onClick={() => setView('expense')} className="px-3 py-1 rounded-full text-sm transition-colors"
          style={{ background: view === 'expense' ? 'rgba(248,113,113,0.12)' : 'transparent', color: view === 'expense' ? '#F87171' : '#8B90A0' }}>
          Expenses ({expenses.length})
        </button>
        <button onClick={() => setView('income')} className="px-3 py-1 rounded-full text-sm transition-colors"
          style={{ background: view === 'income' ? 'rgba(74,222,128,0.12)' : 'transparent', color: view === 'income' ? '#4ADE80' : '#8B90A0' }}>
          Income ({income.length})
        </button>
      </div>

      <div className="rounded-xl overflow-x-auto" style={{ background: '#1A1E27', border: '1px solid #2B3142' }}>
        {view === 'expense' ? (
          <table className="w-full text-sm min-w-[850px]">
            <thead><tr className="text-inkSoft text-xs uppercase" style={{ background: '#161A22' }}><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-left">Vendor/Paid By</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-left">Proof</th><th className="px-3 py-2"></th></tr></thead>
            <tbody>
              {expenses.map((e: any) => (
                <tr key={e.id} style={{ borderTop: '1px solid #2B3142' }}>
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{e.expense_date}</td>
                  <td className="px-3 py-2 text-xs text-inkSoft">{TYPE_LABELS[e.expense_type] || e.expense_type}</td>
                  <td className="px-3 py-2">{e.item_name}</td>
                  <td className="px-3 py-2 text-inkSoft">{e.vendors?.name || e.paid_by_volunteer || '—'}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: '#F87171' }}>{inr(e.amount)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <ProofLink url={e.invoice_link} label="Invoice" />
                    {e.payment_proof_link && <span className="text-inkSoft"> · </span>}
                    <ProofLink url={e.payment_proof_link} label="Payment" />
                  </td>
                  <td className="px-3 py-2"><button onClick={() => removeExpense(e.id)} className="text-expense text-xs hover:underline">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm min-w-[750px]">
            <thead><tr className="text-inkSoft text-xs uppercase" style={{ background: '#161A22' }}><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Source</th><th className="px-3 py-2 text-right">Registrations</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-left">Proof</th><th className="px-3 py-2"></th></tr></thead>
            <tbody>
              {income.map((i: any) => (
                <tr key={i.id} style={{ borderTop: '1px solid #2B3142' }}>
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{i.income_date}</td>
                  <td className="px-3 py-2 text-xs text-inkSoft">{i.income_type}</td>
                  <td className="px-3 py-2">{i.source_name || '—'}</td>
                  <td className="px-3 py-2 text-right">{i.registrations_count ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: '#4ADE80' }}>{inr(i.amount)}</td>
                  <td className="px-3 py-2"><ProofLink url={i.drive_link} label="View" /></td>
                  <td className="px-3 py-2"><button onClick={() => removeIncome(i.id)} className="text-expense text-xs hover:underline">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ExportPanel({ fest, events, expenses, income, allocations }: any) {
  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const eventName = (id: string) => events.find((e: any) => e.id === id)?.name || '';

    // ---- Summary sheet ----
    const totalIncome = income.reduce((s: number, i: any) => s + Number(i.amount), 0);
    const totalExpense = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Metric: 'Total Income', Value: totalIncome },
      { Metric: 'Total Expense', Value: totalExpense },
      { Metric: 'Net Balance', Value: totalIncome - totalExpense },
    ]), 'Summary');

    // ---- One sheet per category, for vendor purchases (Stationery, Printing, Food, etc.) ----
    const vendorPurchases = expenses.filter((e: any) => e.expense_type === 'vendor_purchase');
    const categoryGroups: Record<string, any[]> = {};
    vendorPurchases.forEach((e: any) => {
      const cat = e.categories?.name || 'Uncategorized';
      (categoryGroups[cat] ||= []).push(e);
    });
    Object.entries(categoryGroups).forEach(([cat, rows]) => {
      const sheetRows = rows.map((e, i) => ({
        'Sr No.': i + 1, Vendor: e.vendors?.name || '', Item: e.item_name, Qty: e.quantity, Unit: e.unit || '', 'Unit Price': e.rate,
        'Total Amount': Number(e.amount), 'Procured By': e.procured_by_volunteer || '', Date: e.expense_date,
        'Invoice Link': e.invoice_link || '', 'Payment Proof Link': e.payment_proof_link || '', Notes: e.notes || '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows), sheetName(cat));
    });

    // ---- Volunteer Expenditure ----
    const volunteerRows = expenses.filter((e: any) => e.expense_type === 'volunteer_expense').map((e: any, i: number) => ({
      'Sr No.': i + 1, Item: e.item_name, Amount: Number(e.amount), 'Paid By': e.paid_by_volunteer || '',
      Date: e.expense_date, 'Invoice Link': e.invoice_link || '', 'Payment Proof Link': e.payment_proof_link || '', Notes: e.notes || '',
    }));
    if (volunteerRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(volunteerRows), 'Volunteer Expenditure');

    // ---- Cab Travel ----
    const cabRows = expenses.filter((e: any) => e.expense_type === 'cab_travel').map((e: any, i: number) => ({
      'Sr No.': i + 1, 'Paid By': e.paid_by_volunteer || '', Date: e.expense_date, From: e.travel_from || '', To: e.travel_to || '',
      Amount: Number(e.amount), 'Invoice Link': e.invoice_link || '', 'Payment Proof Link': e.payment_proof_link || '',
    }));
    if (cabRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cabRows), 'Cab Travel');

    // ---- Personal Vehicle ----
    const vehicleRows = expenses.filter((e: any) => e.expense_type === 'personal_vehicle').map((e: any, i: number) => ({
      'Sr No.': i + 1, 'Paid By': e.paid_by_volunteer || '', 'Vehicle Type': e.vehicle_type || '',
      'Total KM': e.quantity, 'Rate/KM': e.rate, Amount: Number(e.amount), Date: e.expense_date,
    }));
    if (vehicleRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vehicleRows), 'Personal Vehicle');

    // ---- Prizepool ----
    const prizeRows = expenses.filter((e: any) => e.expense_type === 'prizepool').map((e: any, i: number) => {
      const alloc = allocations.find((a: any) => a.expense_id === e.id);
      return {
        'Sr No.': i + 1, Event: alloc ? eventName(alloc.event_id) : '', Prize: e.item_name,
        Position: e.position || '', Winner: e.winner_name || '', Amount: Number(e.amount), Date: e.expense_date,
        'Payment Proof Link': e.payment_proof_link || '',
      };
    });
    if (prizeRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prizeRows), 'Prizepool');

    // ---- Income: daily detail ----
    const incomeRows = income.map((i: any) => ({
      Date: i.income_date, Type: i.income_type, Event: eventName(i.event_id),
      Category: i.categories?.name || '', Registrations: i.registrations_count, Amount: Number(i.amount),
      Source: i.source_name || '', 'Drive Link': i.drive_link || '', Notes: i.notes || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incomeRows), 'Income (Daily)');

    // ---- Income: summary per event (matches the final-total format) ----
    const regByEvent: Record<string, { registrations: number; amount: number; lastDate: string }> = {};
    income.filter((i: any) => i.income_type === 'registration').forEach((i: any) => {
      const key = eventName(i.event_id) || 'Unknown Event';
      const cur = regByEvent[key] || { registrations: 0, amount: 0, lastDate: '' };
      cur.registrations += Number(i.registrations_count || 0);
      cur.amount += Number(i.amount);
      if (!cur.lastDate || i.income_date > cur.lastDate) cur.lastDate = i.income_date;
      regByEvent[key] = cur;
    });
    const summaryRows = [
      ...Object.entries(regByEvent).map(([event, v]) => ({
        Type: 'Registration', 'Event / Source': event, 'Total Registrations': v.registrations,
        'Total Amount': v.amount, 'Final Date Received': v.lastDate,
      })),
      ...income.filter((i: any) => i.income_type === 'sponsorship').map((i: any) => ({
        Type: 'Sponsorship', 'Event / Source': i.source_name || '', 'Total Registrations': '',
        'Total Amount': Number(i.amount), 'Final Date Received': i.income_date,
      })),
      ...income.filter((i: any) => i.income_type === 'other').map((i: any) => ({
        Type: 'Other', 'Event / Source': i.categories?.name || i.source_name || '', 'Total Registrations': '',
        'Total Amount': Number(i.amount), 'Final Date Received': i.income_date,
      })),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Income Summary');

    XLSX.writeFile(wb, `${fest.name.replace(/\s+/g, '_')}_Report.xlsx`);
  }

  return (
    <div className="rounded-xl p-5 max-w-md" style={{ background: '#1A1E27', border: '1px solid #2B3142' }}>
      <p className="text-sm text-inkSoft mb-4">Downloads one Excel file: a Summary, one sheet per expense category (Stationery, Food, etc.), dedicated sheets for Volunteer Expenditure / Cab Travel / Personal Vehicle / Prizepool, and both a daily Income log and a per-event Income Summary.</p>
      <button onClick={exportExcel}
        className="px-4 py-2.5 rounded-lg text-sm font-bold tracking-wide transition"
        style={{ background: '#E8A33D', color: '#12151B' }}>
        DOWNLOAD EXCEL REPORT
      </button>
    </div>
  );
}
