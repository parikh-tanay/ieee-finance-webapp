'use client';

import { useState, useMemo, useTransition } from 'react';
import * as XLSX from 'xlsx';
import { addExpense, addIncome, deleteExpense, deleteIncome } from './actions';

function inr(n: number) { return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function FestWorkspace({ fest, events, vendors, categories, expenses, income, allocations }: any) {
  const [tab, setTab] = useState('overview');
  const expenseCategories = categories.filter((c: any) => c.kind === 'expense');
  const incomeCategories = categories.filter((c: any) => c.kind === 'income');

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

    const volunteerOwed = expenses
      .filter((e: any) => e.expense_type !== 'vendor_purchase' && !e.reimbursed)
      .reduce((s: number, e: any) => s + Number(e.amount), 0);

    return { totalExpense, totalIncome, net: totalIncome - totalExpense, byVendor, byEventExpense, byEventIncome, volunteerOwed };
  }, [expenses, income, allocations, events]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-2xl">{fest.name}</h1>
        <span className="text-xs text-inkSoft uppercase tracking-wide">{fest.status}</span>
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
            className={`px-3 py-1.5 rounded text-sm ${tab === id ? 'bg-navy text-white' : 'bg-white border border-border text-inkSoft'}`}>
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
  const color = tone === 'income' ? 'text-income' : tone === 'expense' ? 'text-expense' : 'text-ink';
  return (
    <div className="bg-white rounded-lg border border-border p-4 flex-1">
      <div className="text-xs text-inkSoft uppercase tracking-wide mb-1">{label}</div>
      <div className={`font-mono text-2xl font-semibold ${color}`}>{inr(value)}</div>
    </div>
  );
}

function BreakdownCard({ title, data }: { title: string; data: Record<string, number> }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <div className="bg-white rounded-lg border border-border">
      <div className="px-4 py-2.5 font-display border-b border-border">{title}</div>
      {rows.length === 0 ? (
        <div className="px-4 py-3 text-sm text-inkSoft">No data yet.</div>
      ) : rows.map(([k, v]) => (
        <div key={k} className="px-4 py-2 flex justify-between text-sm border-t border-border first:border-t-0">
          <span>{k}</span><span className="font-mono">{inr(v)}</span>
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
      {totals.volunteerOwed > 0 && (
        <div className="bg-goldSoft border border-gold rounded-lg px-4 py-3 text-sm mb-5">
          <strong>{inr(totals.volunteerOwed)}</strong> in volunteer expenses / conveyance is still marked <em>not reimbursed</em> by Section.
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <BreakdownCard title="Expense by Vendor" data={totals.byVendor} />
        <BreakdownCard title="Expense by Event (allocated)" data={totals.byEventExpense} />
      </div>
      <BreakdownCard title="Registration Income by Event" data={totals.byEventIncome} />
    </div>
  );
}

const EXPENSE_TYPES = [
  { id: 'vendor_purchase', label: 'Vendor Purchase' },
  { id: 'volunteer_expense', label: 'Volunteer Expenditure' },
  { id: 'conveyance', label: 'Conveyance' },
];

function AddExpenseForm({ festId, vendors, categories, events, onDone }: any) {
  const [type, setType] = useState('vendor_purchase');
  const [form, setForm] = useState({
    categoryId: '', vendorId: '', paidByVolunteer: '', reimbursed: false,
    itemName: '', quantity: '', rate: '', amount: '',
    expenseDate: new Date().toISOString().slice(0, 10), driveLink: '', notes: '',
  });
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

  function submit() {
    setError(''); setMsg('');
    startTransition(async () => {
      const res = await addExpense({
        festId, expenseType: type as any, ...form, allocations,
      });
      if (res?.error) setError(res.error);
      else {
        setMsg('Expense logged.');
        setForm({ categoryId: '', vendorId: '', paidByVolunteer: '', reimbursed: false, itemName: '', quantity: '', rate: '', amount: '', expenseDate: new Date().toISOString().slice(0, 10), driveLink: '', notes: '' });
        setAllocations([]);
        onDone();
      }
    });
  }

  return (
    <div className="bg-white rounded-lg border border-border p-5 max-w-2xl">
      <div className="flex gap-2 mb-4">
        {EXPENSE_TYPES.map(t => (
          <button key={t.id} onClick={() => setType(t.id)}
            className={`flex-1 py-2 rounded text-sm ${type === t.id ? 'bg-expenseSoft text-expense border border-expense' : 'border border-border text-inkSoft'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-x-4">
        <div className="mb-3">
          <label className="field-label">Category *</label>
          <select value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
            <option value="">Select category</option>
            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {type === 'vendor_purchase' ? (
          <div className="mb-3">
            <label className="field-label">Vendor</label>
            <select value={form.vendorId} onChange={e => set('vendorId', e.target.value)}>
              <option value="">Select vendor</option>
              {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        ) : (
          <div className="mb-3">
            <label className="field-label">Paid By (Volunteer Name)</label>
            <input value={form.paidByVolunteer} onChange={e => set('paidByVolunteer', e.target.value)} />
          </div>
        )}

        <div className="mb-3">
          <label className="field-label">Item / Description *</label>
          <input value={form.itemName} onChange={e => set('itemName', e.target.value)} placeholder="e.g. A4 sheets, Auto fare to venue" />
        </div>

        <div className="mb-3">
          <label className="field-label">Date</label>
          <input type="date" value={form.expenseDate} onChange={e => set('expenseDate', e.target.value)} />
        </div>

        <div className="mb-3">
          <label className="field-label">Quantity</label>
          <input type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
        </div>

        <div className="mb-3">
          <label className="field-label">Rate (per unit)</label>
          <input type="number" value={form.rate} onChange={e => set('rate', e.target.value)} />
        </div>

        <div className="mb-3">
          <label className="field-label">Total Amount (₹) *</label>
          <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} />
        </div>

        <div className="mb-3">
          <label className="field-label">Drive Link (invoice/screenshot)</label>
          <input value={form.driveLink} onChange={e => set('driveLink', e.target.value)} placeholder="https://drive.google.com/..." />
        </div>
      </div>

      {type !== 'vendor_purchase' && (
        <label className="flex items-center gap-2 text-sm mb-3">
          <input type="checkbox" className="!w-auto" checked={form.reimbursed} onChange={e => set('reimbursed', e.target.checked)} />
          Already reimbursed by Section
        </label>
      )}

      <div className="mb-3">
        <label className="field-label">Notes</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} style={{ minHeight: '50px' }} />
      </div>

      <div className="mb-4 border-t border-border pt-3">
        <div className="flex items-center justify-between mb-2">
          <label className="field-label mb-0">Which event(s) used this? (optional)</label>
          <button onClick={addAllocRow} className="text-xs text-gold">+ Split across event</button>
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
        {allocations.length === 0 && <p className="text-xs text-inkSoft">Leave blank if this was a bulk purchase not yet assigned to specific events.</p>}
      </div>

      {error && <div className="text-expense text-sm mb-2">{error}</div>}
      {msg && <div className="text-income text-sm mb-2">{msg}</div>}
      <button onClick={submit} disabled={pending} className="px-4 py-2 rounded bg-navy text-white text-sm font-medium">
        {pending ? 'Saving…' : 'Log Expense'}
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
    <div className="bg-white rounded-lg border border-border p-5 max-w-2xl">
      <div className="flex gap-2 mb-4">
        {[['registration', 'Registration'], ['sponsorship', 'Sponsorship'], ['other', 'Other']].map(([id, label]) => (
          <button key={id} onClick={() => setType(id)}
            className={`flex-1 py-2 rounded text-sm ${type === id ? 'bg-incomeSoft text-income border border-income' : 'border border-border text-inkSoft'}`}>
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
      {msg && <div className="text-income text-sm mb-2">{msg}</div>}
      <button onClick={submit} disabled={pending} className="px-4 py-2 rounded bg-navy text-white text-sm font-medium">
        {pending ? 'Saving…' : 'Log Income'}
      </button>
    </div>
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
        <button onClick={() => setView('expense')} className={`px-3 py-1 rounded text-sm ${view === 'expense' ? 'bg-expenseSoft text-expense' : 'text-inkSoft'}`}>Expenses ({expenses.length})</button>
        <button onClick={() => setView('income')} className={`px-3 py-1 rounded text-sm ${view === 'income' ? 'bg-incomeSoft text-income' : 'text-inkSoft'}`}>Income ({income.length})</button>
      </div>

      <div className="bg-white rounded-lg border border-border overflow-x-auto">
        {view === 'expense' ? (
          <table className="w-full text-sm min-w-[700px]">
            <thead><tr className="bg-bg text-inkSoft text-xs uppercase"><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-left">Vendor/Paid By</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2"></th></tr></thead>
            <tbody>
              {expenses.map((e: any) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-3 py-2 whitespace-nowrap">{e.expense_date}</td>
                  <td className="px-3 py-2 text-xs text-inkSoft">{e.expense_type.replace('_', ' ')}</td>
                  <td className="px-3 py-2">{e.item_name}</td>
                  <td className="px-3 py-2 text-inkSoft">{e.vendors?.name || e.paid_by_volunteer || '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-expense font-semibold">{inr(e.amount)}</td>
                  <td className="px-3 py-2"><button onClick={() => removeExpense(e.id)} className="text-expense text-xs">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm min-w-[700px]">
            <thead><tr className="bg-bg text-inkSoft text-xs uppercase"><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Source</th><th className="px-3 py-2 text-right">Registrations</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2"></th></tr></thead>
            <tbody>
              {income.map((i: any) => (
                <tr key={i.id} className="border-t border-border">
                  <td className="px-3 py-2 whitespace-nowrap">{i.income_date}</td>
                  <td className="px-3 py-2 text-xs text-inkSoft">{i.income_type}</td>
                  <td className="px-3 py-2">{i.source_name || '—'}</td>
                  <td className="px-3 py-2 text-right">{i.registrations_count ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-income font-semibold">{inr(i.amount)}</td>
                  <td className="px-3 py-2"><button onClick={() => removeIncome(i.id)} className="text-expense text-xs">Delete</button></td>
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
    const expenseRows = expenses.map((e: any) => ({
      Date: e.expense_date, Type: e.expense_type, Category: e.categories?.name || '',
      Item: e.item_name, Quantity: e.quantity, Rate: e.rate, Amount: Number(e.amount),
      Vendor: e.vendors?.name || '', 'Paid By (Volunteer)': e.paid_by_volunteer || '',
      Reimbursed: e.reimbursed ? 'Yes' : 'No', 'Drive Link': e.drive_link || '', Notes: e.notes || '',
    }));
    const incomeRows = income.map((i: any) => ({
      Date: i.income_date, Type: i.income_type, Event: events.find((e: any) => e.id === i.event_id)?.name || '',
      Category: i.categories?.name || '', Registrations: i.registrations_count, Amount: Number(i.amount),
      Source: i.source_name || '', 'Drive Link': i.drive_link || '', Notes: i.notes || '',
    }));
    const totalExpense = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
    const totalIncome = income.reduce((s: number, i: any) => s + Number(i.amount), 0);
    const summaryRows = [
      { Metric: 'Total Income', Value: totalIncome },
      { Metric: 'Total Expense', Value: totalExpense },
      { Metric: 'Net Balance', Value: totalIncome - totalExpense },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseRows), 'Expenses');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incomeRows), 'Income');
    XLSX.writeFile(wb, `${fest.name.replace(/\s+/g, '_')}_Report.xlsx`);
  }

  return (
    <div className="bg-white rounded-lg border border-border p-5 max-w-md">
      <p className="text-sm text-inkSoft mb-4">Downloads one Excel file for this fest: a Summary sheet plus full Expenses and Income sheets, including Drive links to every proof.</p>
      <button onClick={exportExcel} className="px-4 py-2 rounded bg-navy text-white text-sm font-medium">Download Excel Report</button>
    </div>
  );
}
