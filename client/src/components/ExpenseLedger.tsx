import { useMemo, useState } from 'react';
import { Calculator, Receipt, ScanLine, Trash2 } from 'lucide-react';
import { api } from '../api';
import type { Trip } from '../types';

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);

export function ExpenseLedger({ trip, onTrip }: { trip: Trip; onTrip: (trip: Trip, note: string) => void }) {
  const [description, setDescription] = useState('Sushi Dai dinner');
  const [amount, setAmount] = useState(120);
  const [paidBy, setPaidBy] = useState(trip.travelers[0]?.id ?? '');
  const [participants, setParticipants] = useState<string[]>(trip.travelers.map((traveler) => traveler.id));
  const [busy, setBusy] = useState(false);
  const expenses = trip.expenses ?? [];

  const travelerTotals = useMemo(() => {
    const values = new Map(trip.travelers.map((traveler) => [traveler.id, { paid: 0, share: 0, balance: 0 }]));
    for (const expense of expenses) {
      const payer = values.get(expense.paidBy) ?? { paid: 0, share: 0, balance: 0 };
      payer.paid += expense.amount;
      payer.balance += expense.amount;
      values.set(expense.paidBy, payer);
      const included = expense.participantIds.length ? expense.participantIds : [expense.paidBy];
      const share = expense.amount / included.length;
      for (const travelerId of included) {
        const traveler = values.get(travelerId) ?? { paid: 0, share: 0, balance: 0 };
        traveler.share += share;
        traveler.balance -= share;
        values.set(travelerId, traveler);
      }
    }
    return values;
  }, [expenses, trip.travelers]);

  const addReceipt = async () => {
    if (!description.trim() || amount <= 0 || !paidBy || participants.length === 0) return;
    setBusy(true);
    try {
      const response = await api.scanReceipt(trip, { restaurant: description.trim(), amount, paidBy, participantIds: participants });
      onTrip(response.trip, `${description} added. The shared-expense settlement was recalculated.`);
    } catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not add the receipt.'); }
    finally { setBusy(false); }
  };

  const toggleParticipant = (id: string) => setParticipants((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const deleteReceipt = async (receiptId: string, receiptDescription: string) => {
    setBusy(true);
    try {
      const response = await api.deleteReceipt(receiptId, trip);
      onTrip(response.trip, `${receiptDescription} removed. Paid, share, and net settlement totals were recalculated.`);
    } catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not delete the receipt.'); }
    finally { setBusy(false); }
  };

  return <section className="mt-6 rounded-[28px] border border-stone-200 bg-white p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-moss">Live expense ledger</p><h2 className="mt-1 text-2xl font-bold text-ink">Scan now. Settle once at trip end.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">Record who paid and who shared each expense. JourneyOS nets every receipt, so each traveler makes at most one final settlement instead of reimbursing receipt by receipt.</p></div><Receipt className="text-coral" /></div>
    <div className="mt-5 grid gap-3 lg:grid-cols-[1.3fr_0.7fr_0.9fr]"><label className="text-xs font-bold text-stone-500">Receipt description<input value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm text-ink" /></label><label className="text-xs font-bold text-stone-500">Amount<input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm text-ink" /></label><label className="text-xs font-bold text-stone-500">Paid by<select value={paidBy} onChange={(event) => setPaidBy(event.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-ink">{trip.travelers.map((traveler) => <option key={traveler.id} value={traveler.id}>{traveler.name}</option>)}</select></label></div>
    <fieldset className="mt-4"><legend className="text-xs font-bold text-stone-500">Who shared this expense?</legend><div className="mt-2 flex flex-wrap gap-2">{trip.travelers.map((traveler) => <label key={traveler.id} className={`cursor-pointer rounded-full border px-3 py-2 text-xs font-bold ${participants.includes(traveler.id) ? 'border-moss bg-[#eff6f1] text-moss' : 'border-stone-200 text-stone-500'}`}><input type="checkbox" checked={participants.includes(traveler.id)} onChange={() => toggleParticipant(traveler.id)} className="sr-only" />{traveler.name}</label>)}</div></fieldset>
    <button disabled={busy || participants.length === 0 || amount <= 0} onClick={() => void addReceipt()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white disabled:opacity-40"><ScanLine size={16} />{busy ? 'Reading receipt…' : 'Scan demo receipt & recalculate'}</button>
    <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]"><div className="min-w-0"><h3 className="flex items-center gap-2 font-bold text-ink"><Receipt size={17} className="text-coral" />Recorded receipts</h3>{expenses.length ? <div className="mt-3 space-y-2">{expenses.map((expense) => { const payer = trip.travelers.find((traveler) => traveler.id === expense.paidBy); return <div key={expense.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 px-4 py-3 text-sm"><span className="min-w-0 flex-1"><b className="block truncate text-ink">{expense.description}</b><small className="mt-1 block text-stone-500">{payer?.name ?? 'Traveler'} paid · split across {expense.participantIds.length}</small></span><span className="flex shrink-0 items-center gap-3"><b className="text-ink">{money(expense.amount)}</b><button disabled={busy} onClick={() => void deleteReceipt(expense.id, expense.description)} aria-label={`Delete ${expense.description}`} title="Delete incorrect receipt" className="grid h-9 w-9 place-items-center rounded-lg text-coral transition hover:bg-red-50 disabled:opacity-40"><Trash2 size={16} /></button></span></div>; })}</div> : <p className="mt-3 rounded-xl bg-stone-50 px-4 py-5 text-sm text-stone-500">No variable expenses recorded yet. Add one receipt to demonstrate the live tally.</p>}</div><aside className="min-w-0 rounded-2xl bg-[#eff6f1] p-5"><h3 className="flex items-center gap-2 font-bold text-ink"><Calculator size={17} className="shrink-0 text-moss" />Traveler totals & final settlement</h3><div className="mt-3 space-y-2">{trip.travelers.map((traveler) => { const totals = travelerTotals.get(traveler.id) ?? { paid: 0, share: 0, balance: 0 }; return <div key={traveler.id} className="border-b border-moss/10 py-2"><div className="flex flex-wrap items-center justify-between gap-1 text-sm"><span className="font-semibold text-ink">{traveler.name}</span><b className={totals.balance > 0.005 ? 'text-moss' : totals.balance < -0.005 ? 'text-coral' : 'text-stone-500'}>{totals.balance > 0.005 ? `receives ${money(totals.balance)}` : totals.balance < -0.005 ? `owes ${money(Math.abs(totals.balance))}` : 'settled'}</b></div><p className="mt-1 text-[11px] text-stone-500">Paid {money(totals.paid)} · personal share {money(totals.share)}</p></div>; })}</div><p className="mt-4 text-xs leading-5 text-stone-600">This settlement covers variable shared expenses only. Flight and hotel payments remain separate and are never counted again.</p></aside></div>
  </section>;
}
