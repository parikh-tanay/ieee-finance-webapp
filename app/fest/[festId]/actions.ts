'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return { supabase, user };
}

type Allocation = { eventId: string; quantity: string; amount: string };

export async function addExpense(payload: {
  festId: string;
  expenseType: 'vendor_purchase' | 'volunteer_expense' | 'cab_travel' | 'personal_vehicle' | 'prizepool';
  categoryId: string;
  vendorId: string;
  procuredByVolunteer: string;
  paidByVolunteer: string;
  reimbursed: boolean;
  itemName: string;
  quantity: string;
  rate: string;
  amount: string;
  expenseDate: string;
  travelFrom: string;
  travelTo: string;
  vehicleType: string;
  position: string;
  winnerName: string;
  invoiceLink: string;
  paymentProofLink: string;
  notes: string;
  allocations: Allocation[];
}) {
  const { supabase, user } = await currentUser();

  if (!payload.itemName.trim() || !payload.amount || Number(payload.amount) <= 0) {
    return { error: 'Item name and a valid amount are required.' };
  }

  const isVolunteerFronted = payload.expenseType === 'volunteer_expense' || payload.expenseType === 'cab_travel' || payload.expenseType === 'personal_vehicle';

  const { data: expense, error } = await supabase.from('expenses').insert({
    fest_id: payload.festId,
    category_id: payload.categoryId || null,
    expense_type: payload.expenseType,
    vendor_id: payload.expenseType === 'vendor_purchase' ? (payload.vendorId || null) : null,
    procured_by_volunteer: payload.expenseType === 'vendor_purchase' ? (payload.procuredByVolunteer || null) : null,
    paid_by_volunteer: isVolunteerFronted ? (payload.paidByVolunteer || null) : null,
    reimbursed: isVolunteerFronted ? payload.reimbursed : false,
    item_name: payload.itemName.trim(),
    quantity: payload.quantity ? Number(payload.quantity) : null,
    rate: payload.rate ? Number(payload.rate) : null,
    amount: Number(payload.amount),
    expense_date: payload.expenseDate,
    travel_from: payload.expenseType === 'cab_travel' ? (payload.travelFrom || null) : null,
    travel_to: payload.expenseType === 'cab_travel' ? (payload.travelTo || null) : null,
    vehicle_type: payload.expenseType === 'personal_vehicle' ? (payload.vehicleType || null) : null,
    position: payload.expenseType === 'prizepool' ? (payload.position || null) : null,
    winner_name: payload.expenseType === 'prizepool' ? (payload.winnerName || null) : null,
    invoice_link: payload.invoiceLink || null,
    payment_proof_link: payload.paymentProofLink || null,
    notes: payload.notes || null,
    created_by: user.id,
  }).select().single();

  if (error) return { error: error.message };

  const validAllocations = payload.allocations.filter(a => a.eventId && a.amount);
  if (validAllocations.length > 0) {
    const rows = validAllocations.map(a => ({
      expense_id: expense.id,
      event_id: a.eventId,
      quantity: a.quantity ? Number(a.quantity) : null,
      amount: Number(a.amount),
    }));
    const { error: allocErr } = await supabase.from('expense_allocations').insert(rows);
    if (allocErr) return { error: `Expense saved, but allocation failed: ${allocErr.message}` };
  }

  revalidatePath(`/fest/${payload.festId}`);
  return { success: true };
}

export async function addIncome(payload: {
  festId: string;
  incomeType: 'registration' | 'sponsorship' | 'other';
  eventId: string;
  categoryId: string;
  incomeDate: string;
  registrationsCount: string;
  amount: string;
  sourceName: string;
  driveLink: string;
  notes: string;
}) {
  const { supabase, user } = await currentUser();

  if (!payload.amount || Number(payload.amount) <= 0) {
    return { error: 'A valid amount is required.' };
  }

  const { error } = await supabase.from('income_entries').insert({
    fest_id: payload.festId,
    event_id: payload.incomeType === 'registration' ? (payload.eventId || null) : null,
    income_type: payload.incomeType,
    category_id: payload.incomeType === 'other' ? (payload.categoryId || null) : null,
    income_date: payload.incomeDate,
    registrations_count: payload.registrationsCount ? Number(payload.registrationsCount) : null,
    amount: Number(payload.amount),
    source_name: payload.sourceName || null,
    drive_link: payload.driveLink || null,
    notes: payload.notes || null,
    created_by: user.id,
  });

  if (error) return { error: error.message };
  revalidatePath(`/fest/${payload.festId}`);
  return { success: true };
}

export async function deleteExpense(id: string, festId: string) {
  const { supabase } = await currentUser();
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/fest/${festId}`);
  return { success: true };
}

export async function deleteIncome(id: string, festId: string) {
  const { supabase } = await currentUser();
  const { error } = await supabase.from('income_entries').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/fest/${festId}`);
  return { success: true };
}
