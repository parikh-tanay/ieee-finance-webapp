'use client';

import { useState, useTransition } from 'react';
import { createFest, closeFest, createEvent, deleteEvent, createVendor, deleteVendor, createCategory, deleteCategory } from './actions';

export default function AdminPanels({ fests, events, vendors, categories }: any) {
  const [tab, setTab] = useState('fests');
  const tabs = [
    { id: 'fests', label: 'Fests' },
    { id: 'events', label: 'Events' },
    { id: 'vendors', label: 'Vendors' },
    { id: 'categories', label: 'Categories' },
  ];

  return (
    <div>
      <div className="flex gap-2 mb-5">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded text-sm ${tab === t.id ? 'bg-navy text-white' : 'bg-white border border-border text-inkSoft'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'fests' && <FestsPanel fests={fests} />}
      {tab === 'events' && <EventsPanel fests={fests} events={events} />}
      {tab === 'vendors' && <VendorsPanel vendors={vendors} />}
      {tab === 'categories' && <CategoriesPanel categories={categories} />}
    </div>
  );
}

function FestsPanel({ fests }: any) {
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <div className="bg-white rounded-lg border border-border p-4 mb-4 flex gap-2">
        <input placeholder="New fest name, e.g. TechFest 2026" value={name} onChange={e => setName(e.target.value)} />
        <button disabled={pending} onClick={() => startTransition(async () => { await createFest(name); setName(''); })}
          className="px-4 py-2 rounded bg-navy text-white text-sm shrink-0">Create</button>
      </div>
      <div className="bg-white rounded-lg border border-border divide-y divide-border">
        {fests.map((f: any) => (
          <div key={f.id} className="px-4 py-3 flex items-center justify-between text-sm">
            <span>{f.name}</span>
            <select value={f.status} onChange={e => startTransition(async () => { await closeFest(f.id, e.target.value); })} className="!w-auto text-xs">
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventsPanel({ fests, events }: any) {
  const [festId, setFestId] = useState(fests[0]?.id || '');
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();
  const filtered = events.filter((e: any) => e.fest_id === festId);

  return (
    <div>
      <div className="bg-white rounded-lg border border-border p-4 mb-4">
        <label className="field-label">Fest</label>
        <select value={festId} onChange={e => setFestId(e.target.value)} className="mb-3">
          {fests.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <label className="field-label">New Event / Workshop Name</label>
        <div className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Robotics Workshop" />
          <button disabled={pending || !festId} className="px-4 py-2 rounded bg-navy text-white text-sm shrink-0"
            onClick={() => startTransition(async () => { await createEvent(festId, name); setName(''); })}>Add</button>
        </div>
      </div>
      <div className="bg-white rounded-lg border border-border divide-y divide-border">
        {filtered.length === 0 && <div className="px-4 py-3 text-sm text-inkSoft">No events under this fest yet.</div>}
        {filtered.map((e: any) => (
          <div key={e.id} className="px-4 py-3 flex items-center justify-between text-sm">
            <span>{e.name}</span>
            <button onClick={() => startTransition(async () => { await deleteEvent(e.id, festId); })} className="text-expense text-xs">Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function VendorsPanel({ vendors }: any) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <div className="bg-white rounded-lg border border-border p-4 mb-4 flex gap-2">
        <input placeholder="Vendor name" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Contact (optional)" value={contact} onChange={e => setContact(e.target.value)} />
        <button disabled={pending} className="px-4 py-2 rounded bg-navy text-white text-sm shrink-0"
          onClick={() => startTransition(async () => { await createVendor(name, contact); setName(''); setContact(''); })}>Add</button>
      </div>
      <div className="bg-white rounded-lg border border-border divide-y divide-border">
        {vendors.map((v: any) => (
          <div key={v.id} className="px-4 py-3 flex items-center justify-between text-sm">
            <span>{v.name}{v.contact && <span className="text-inkSoft"> · {v.contact}</span>}</span>
            <button onClick={() => startTransition(async () => { await deleteVendor(v.id); })} className="text-expense text-xs">Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoriesPanel({ categories }: any) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [pending, startTransition] = useTransition();
  const expense = categories.filter((c: any) => c.kind === 'expense');
  const income = categories.filter((c: any) => c.kind === 'income');

  return (
    <div>
      <div className="bg-white rounded-lg border border-border p-4 mb-4 flex gap-2">
        <select value={kind} onChange={e => setKind(e.target.value as any)} className="!w-32">
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <input placeholder="e.g. Stationery, Printing, Mementos" value={name} onChange={e => setName(e.target.value)} />
        <button disabled={pending} className="px-4 py-2 rounded bg-navy text-white text-sm shrink-0"
          onClick={() => startTransition(async () => { await createCategory(name, kind); setName(''); })}>Add</button>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-border">
          <div className="px-4 py-2 font-display border-b border-border">Expense Categories</div>
          <div className="divide-y divide-border">
            {expense.map((c: any) => (
              <div key={c.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                {c.name}
                <button onClick={() => startTransition(async () => { await deleteCategory(c.id); })} className="text-expense text-xs">Remove</button>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-border">
          <div className="px-4 py-2 font-display border-b border-border">Income Categories</div>
          <div className="divide-y divide-border">
            {income.map((c: any) => (
              <div key={c.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                {c.name}
                <button onClick={() => startTransition(async () => { await deleteCategory(c.id); })} className="text-expense text-xs">Remove</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
