import { useEffect, useMemo, useState } from 'react';
import { Calculator, CheckCircle2, CreditCard, MessageSquareText, Receipt, ScanLine, Trash2 } from 'lucide-react';
import { useAgentActions } from '@vocalbridgeai/react';
import { api } from '../api';
import type { PaymentOrder, Trip } from '../types';

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
const equalPercentages = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, Number((100 / Math.max(1, ids.length)).toFixed(2))]));

export function ExpenseLedger({ trip, onTrip }: { trip: Trip; onTrip: (trip: Trip, note: string) => void }) {
  const { onAction } = useAgentActions();
  const [description, setDescription] = useState('Sushi Dai dinner');
  const [amount, setAmount] = useState(120);
  const [paidBy, setPaidBy] = useState(trip.travelers[0]?.id ?? '');
  const [participants, setParticipants] = useState<string[]>(trip.travelers.map((traveler) => traveler.id));
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [splitPercentages, setSplitPercentages] = useState<Record<string, number>>(() => equalPercentages(trip.travelers.map((traveler) => traveler.id)));
  const [busy, setBusy] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<PaymentOrder | null>(null);
  const [selectedDebtorId, setSelectedDebtorId] = useState('');
  const expenses = trip.expenses ?? [];

  const travelerTotals = useMemo(() => {
    const values = new Map(trip.travelers.map((traveler) => [traveler.id, { paid: 0, share: 0, balance: 0 }]));
    for (const expense of expenses) {
      const payer = values.get(expense.paidBy) ?? { paid: 0, share: 0, balance: 0 };
      payer.paid += expense.amount;
      payer.balance += expense.amount;
      values.set(expense.paidBy, payer);
      const included = expense.participantIds.length ? expense.participantIds : [expense.paidBy];
      for (const travelerId of included) {
        const traveler = values.get(travelerId) ?? { paid: 0, share: 0, balance: 0 };
        const share = expense.splitPercentages ? expense.amount * (expense.splitPercentages[travelerId] ?? 0) / 100 : expense.amount / included.length;
        traveler.share += share;
        traveler.balance -= share;
        values.set(travelerId, traveler);
      }
    }
    return values;
  }, [expenses, trip.travelers]);

  const splitTotal = participants.reduce((sum, id) => sum + (splitPercentages[id] ?? 0), 0);
  const debtors = trip.travelers.map((traveler) => ({ traveler, amount: Math.max(0, -(travelerTotals.get(traveler.id)?.balance ?? 0)) })).filter((item) => item.amount > 0.005);
  const selectedDebtor = debtors.find((item) => item.traveler.id === selectedDebtorId) ?? debtors[0];
  const amountToCollect = selectedDebtor?.amount ?? 0;
  const settlementPercentages = Object.fromEntries(trip.travelers.map((traveler) => [traveler.id, traveler.id === selectedDebtor?.traveler.id ? 100 : 0]));
  const validCustomSplit = splitMode === 'equal' || Math.abs(splitTotal - 100) < 0.01;
  const toggleParticipant = (id: string) => setParticipants((current) => {
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    setSplitPercentages(equalPercentages(next));
    return next;
  });

  const addReceipt = async () => {
    if (!description.trim() || amount <= 0 || !paidBy || !participants.length || !validCustomSplit) return;
    setBusy(true);
    try {
      const response = await api.scanReceipt(trip, { restaurant: description.trim(), amount, paidBy, participantIds: participants, splitPercentages: splitMode === 'custom' ? splitPercentages : undefined });
      onTrip(response.trip, `${description} added. The shared-expense settlement was recalculated.`);
    } catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not add the receipt.'); }
    finally { setBusy(false); }
  };

  useEffect(() => onAction('add_expense', (payload) => {
    const spokenDescription = typeof payload.description === 'string' ? payload.description.trim() : '';
    const spokenAmount = Number(payload.amount);
    const payerInput = typeof payload.paidBy === 'string' ? payload.paidBy.trim().toLowerCase() : '';
    const payer = trip.travelers.find((person) => person.id.toLowerCase() === payerInput || person.name.toLowerCase() === payerInput);
    const participantInputs = Array.isArray(payload.participants) ? payload.participants.map((value) => String(value).trim().toLowerCase()) : [];
    const participantIds = participantInputs.length
      ? trip.travelers.filter((person) => participantInputs.includes(person.id.toLowerCase()) || participantInputs.includes(person.name.toLowerCase())).map((person) => person.id)
      : trip.travelers.map((person) => person.id);
    if (!spokenDescription || !Number.isFinite(spokenAmount) || spokenAmount <= 0 || !payer || !participantIds.length) {
      onTrip(trip, 'I need the expense description, positive amount, valid payer, and at least one participant before adding it.');
      return;
    }
    setDescription(spokenDescription); setAmount(spokenAmount); setPaidBy(payer.id); setParticipants(participantIds); setSplitMode('equal'); setSplitPercentages(equalPercentages(participantIds));
    setBusy(true);
    void api.scanReceipt(trip, { restaurant: spokenDescription, amount: spokenAmount, paidBy: payer.id, participantIds })
      .then((response) => onTrip(response.trip, `${spokenDescription} added by voice. The shared-expense settlement was recalculated.`))
      .catch((error: Error) => onTrip(trip, error.message))
      .finally(() => setBusy(false));
  }), [onAction, onTrip, trip]);

  const deleteReceipt = async (receiptId: string, receiptDescription: string) => {
    setBusy(true);
    try {
      const response = await api.deleteReceipt(receiptId, trip);
      onTrip(response.trip, `${receiptDescription} removed. Paid, share, and net totals were recalculated.`);
    } catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not delete the receipt.'); }
    finally { setBusy(false); }
  };

  const createSettlementOrder = async () => {
    if (amountToCollect <= 0) return;
    const popup = window.open('', 'journeyos-paypal-expenses', 'width=520,height=720');
    setBusy(true);
    try {
      const response = await api.createOrder(settlementPercentages, Number(amountToCollect.toFixed(2)));
      setPaymentOrder(response.order);
      if (response.order.approveUrl && popup) popup.location.href = response.order.approveUrl;
      else popup?.close();
      onTrip(trip, response.order.mock ? `${selectedDebtor?.traveler.name ?? 'Traveler'} settlement simulation prepared.` : `PayPal sandbox approval opened for ${selectedDebtor?.traveler.name ?? 'the selected traveler'}'s reimbursement.`);
    } catch (error) { popup?.close(); onTrip(trip, error instanceof Error ? error.message : 'Could not create the settlement order.'); }
    finally { setBusy(false); }
  };

  const captureSettlement = async () => {
    if (!paymentOrder) return;
    setBusy(true);
    try { const response = await api.captureOrder(paymentOrder.id); setPaymentOrder(response.order); onTrip(trip, response.order.mock ? 'Demo reimbursement completed; no money moved.' : `${selectedDebtor?.traveler.name ?? 'Traveler'}'s PayPal sandbox reimbursement was captured.`); }
    catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not capture the settlement.'); }
    finally { setBusy(false); }
  };

  const copySettlementMessages = async () => {
    const messages = trip.travelers.map((traveler) => { const balance = travelerTotals.get(traveler.id)?.balance ?? 0; return `${traveler.name}: ${balance < -0.005 ? `please pay ${money(Math.abs(balance))}` : balance > 0.005 ? `you will receive ${money(balance)}` : 'you are settled'}.`; }).join('\n');
    await navigator.clipboard.writeText(messages);
    onTrip(trip, 'Private settlement messages copied. Connect an SMS provider later to send them automatically.');
  };

  return <section className="mb-28 mt-6 rounded-[28px] border border-stone-200 bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-moss">Live expense ledger</p><h2 className="mt-1 text-2xl font-bold text-ink">Scan now. Settle once at trip end.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">Record who paid and who shared each expense. JourneyOS nets every receipt, so each traveler makes at most one final settlement.</p></div><Receipt className="text-coral" /></div>
    <div className="mt-5 grid gap-3 lg:grid-cols-[1.3fr_0.7fr_0.9fr]">
      <label className="text-xs font-bold text-stone-500">Receipt description<input value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm text-ink" /></label>
      <label className="text-xs font-bold text-stone-500">Amount<input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm text-ink" /></label>
      <label className="text-xs font-bold text-stone-500">Paid by<select value={paidBy} onChange={(event) => setPaidBy(event.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-ink">{trip.travelers.map((traveler) => <option key={traveler.id} value={traveler.id}>{traveler.name}</option>)}</select></label>
    </div>
    <fieldset className="mt-4"><legend className="text-xs font-bold text-stone-500">Who shared this expense?</legend><div className="mt-2 flex flex-wrap gap-2">{trip.travelers.map((traveler) => <label key={traveler.id} className={`cursor-pointer rounded-full border px-3 py-2 text-xs font-bold ${participants.includes(traveler.id) ? 'border-moss bg-[#eff6f1] text-moss' : 'border-stone-200 text-stone-500'}`}><input type="checkbox" checked={participants.includes(traveler.id)} onChange={() => toggleParticipant(traveler.id)} className="sr-only" />{traveler.name}</label>)}</div></fieldset>
    <div className="mt-4 rounded-2xl border border-stone-200 bg-[#fafbf9] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-ink">How should this receipt be split?</p><p className="mt-1 text-xs text-stone-500">Review each person's amount before adding it to the ledger.</p></div><div className="flex rounded-xl bg-stone-100 p-1"><button onClick={() => { setSplitMode('equal'); setSplitPercentages(equalPercentages(participants)); }} className={`rounded-lg px-3 py-2 text-xs font-bold ${splitMode === 'equal' ? 'bg-white text-ink shadow-sm' : 'text-stone-500'}`}>Split equally</button><button onClick={() => setSplitMode('custom')} className={`rounded-lg px-3 py-2 text-xs font-bold ${splitMode === 'custom' ? 'bg-white text-ink shadow-sm' : 'text-stone-500'}`}>Custom %</button></div></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{trip.travelers.filter((traveler) => participants.includes(traveler.id)).map((traveler) => { const percent = splitMode === 'equal' ? 100 / Math.max(1, participants.length) : splitPercentages[traveler.id] ?? 0; return <label key={traveler.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-3 text-sm ring-1 ring-stone-200"><span className="font-semibold text-ink">{traveler.name}</span><span className="flex items-center gap-2">{splitMode === 'custom' && <input aria-label={`${traveler.name} receipt percentage`} type="number" min="0" max="100" step="0.01" value={splitPercentages[traveler.id] ?? 0} onChange={(event) => setSplitPercentages({ ...splitPercentages, [traveler.id]: Number(event.target.value) })} className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-right" />}<span className="text-xs text-stone-400">{percent.toFixed(2)}%</span><b className="w-20 text-right text-moss">{money(amount * percent / 100)}</b></span></label>; })}</div>
      {splitMode === 'custom' && <p className={`mt-3 text-right text-xs font-bold ${validCustomSplit ? 'text-moss' : 'text-coral'}`}>{splitTotal.toFixed(2)}% of 100%</p>}
    </div>
    <button disabled={busy || participants.length === 0 || amount <= 0 || !validCustomSplit} onClick={() => void addReceipt()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white disabled:opacity-40"><ScanLine size={16} />{busy ? 'Reading receipt...' : 'Scan demo receipt & recalculate'}</button>
    <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <div className="min-w-0"><h3 className="flex items-center gap-2 font-bold text-ink"><Receipt size={17} className="text-coral" />Recorded receipts</h3>{expenses.length ? <div className="mt-3 space-y-2">{expenses.map((expense) => { const payer = trip.travelers.find((traveler) => traveler.id === expense.paidBy); return <div key={expense.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 px-4 py-3 text-sm"><span className="min-w-0 flex-1"><b className="block truncate text-ink">{expense.description}</b><small className="mt-1 block text-stone-500">{payer?.name ?? 'Traveler'} paid · {expense.splitPercentages ? 'custom percentage split' : `split across ${expense.participantIds.length}`}</small></span><span className="flex shrink-0 items-center gap-3"><b className="text-ink">{money(expense.amount)}</b><button disabled={busy} onClick={() => void deleteReceipt(expense.id, expense.description)} aria-label={`Delete ${expense.description}`} title="Delete incorrect receipt" className="grid h-9 w-9 place-items-center rounded-lg text-coral transition hover:bg-red-50 disabled:opacity-40"><Trash2 size={16} /></button></span></div>; })}</div> : <p className="mt-3 rounded-xl bg-stone-50 px-4 py-5 text-sm text-stone-500">No variable expenses recorded yet. Add one receipt to demonstrate the live tally.</p>}</div>
      <aside className="min-w-0 rounded-2xl bg-[#eff6f1] p-5"><h3 className="flex items-center gap-2 font-bold text-ink"><Calculator size={17} className="shrink-0 text-moss" />Traveler totals & final settlement</h3><div className="mt-3 space-y-2">{trip.travelers.map((traveler) => { const totals = travelerTotals.get(traveler.id) ?? { paid: 0, share: 0, balance: 0 }; return <div key={traveler.id} className="border-b border-moss/10 py-2"><div className="flex flex-wrap items-center justify-between gap-1 text-sm"><span className="font-semibold text-ink">{traveler.name}</span><b className={totals.balance > 0.005 ? 'text-moss' : totals.balance < -0.005 ? 'text-coral' : 'text-stone-500'}>{totals.balance > 0.005 ? `receives ${money(totals.balance)}` : totals.balance < -0.005 ? `owes ${money(Math.abs(totals.balance))}` : 'settled'}</b></div><p className="mt-1 text-[11px] text-stone-500">Paid {money(totals.paid)} · personal share {money(totals.share)}</p></div>; })}</div><p className="mt-4 text-xs leading-5 text-stone-600">This settlement covers variable shared expenses only. Flight and hotel payments remain separate and are never counted again.</p></aside>
    </div>
    <section className="mt-5 rounded-2xl border border-[#0070ba]/20 bg-[#f3f9ff] p-5 pb-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="eyebrow text-[#0070ba]">End-of-trip reimbursement</p><h3 className="mt-1 text-lg font-bold text-ink">{selectedDebtor ? `${selectedDebtor.traveler.name} owes ${money(selectedDebtor.amount)}` : 'Everyone is settled.'}</h3><p className="mt-2 max-w-2xl text-xs leading-5 text-stone-600">Choose one person who owes money, then open one PayPal checkout for exactly that person&apos;s net reimbursement. Flights and hotels are excluded.</p>{debtors.length > 0 && <label className="mt-4 block max-w-sm text-xs font-bold text-stone-500">Person paying this reimbursement<select value={selectedDebtor?.traveler.id ?? ''} disabled={Boolean(paymentOrder && paymentOrder.status !== 'COMPLETED')} onChange={(event) => { setSelectedDebtorId(event.target.value); setPaymentOrder(null); }} className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-ink">{debtors.map((item) => <option key={item.traveler.id} value={item.traveler.id}>{item.traveler.name} · {money(item.amount)}</option>)}</select></label>}</div><div className="flex flex-wrap gap-2"><button onClick={() => void copySettlementMessages()} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs font-bold text-ink"><MessageSquareText size={16} />Copy request summary</button>{!paymentOrder ? <button disabled={busy || !selectedDebtor} onClick={() => void createSettlementOrder()} className="inline-flex items-center gap-2 rounded-xl bg-[#ffc439] px-4 py-3 text-xs font-bold text-[#1d2d35] disabled:opacity-40"><CreditCard size={16} />Collect {selectedDebtor ? `${selectedDebtor.traveler.name}'s ${money(selectedDebtor.amount)}` : 'with PayPal'}</button> : paymentOrder.status === 'COMPLETED' ? <><span className="inline-flex items-center gap-2 rounded-xl bg-moss px-4 py-3 text-xs font-bold text-white"><CheckCircle2 size={16} />Reimbursement captured</span><button onClick={() => setPaymentOrder(null)} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs font-bold text-ink">Prepare another</button></> : <><a href={paymentOrder.approveUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-[#0070ba] px-4 py-3 text-xs font-bold text-white">Open {selectedDebtor?.traveler.name} PayPal approval</a><button disabled={busy} onClick={() => void captureSettlement()} className="rounded-xl bg-[#ffc439] px-4 py-3 text-xs font-bold text-[#1d2d35]">{paymentOrder.mock ? 'Complete simulation' : 'Capture approved reimbursement'}</button></>}</div></div>
    </section>
  </section>;
}
