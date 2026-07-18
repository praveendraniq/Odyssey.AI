import { useMemo, useState } from 'react';
import { ArrowRight, Bot, Check, Clock3, DollarSign, PlaneLanding, RotateCcw, ShieldCheck, Sparkles, UsersRound, X, Zap } from 'lucide-react';
import { api } from '../api';
import type { Trip } from '../types';

type Stage = 'detected' | 'proposed' | 'applied';
type Decision = { title: string; explanation: string; changedStops: string[] };

export function DisruptionDemo({ trip, activeDay, onTrip }: { trip: Trip; activeDay: number; onTrip: (trip: Trip, note: string) => void }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('detected');
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const dayStops = useMemo(() => trip.itinerary.filter((item) => item.day === activeDay).slice(0, 3), [activeDay, trip.itinerary]);
  const affectedDinner = dayStops.find((item) => item.category === 'food')?.title ?? 'Welcome dinner';
  const protectedStop = dayStops.find((item) => !['food', 'transport', 'stay'].includes(item.category))?.title ?? 'the first cultural anchor';

  const openDemo = () => { setDecision(null); setStage('detected'); setOpen(true); };
  const close = () => setOpen(false);
  const apply = async () => {
    setBusy(true);
    try {
      const before = new Map(trip.itinerary.map((item) => [item.id, `${item.time}|${item.title}|${item.status}`]));
      const response = await api.replan('flight-delay', trip, activeDay);
      const changedStops = response.trip.itinerary.filter((item) => before.get(item.id) !== `${item.time}|${item.title}|${item.status}`).map((item) => item.title).slice(0, 4);
      setDecision({ title: 'Four-hour flight delay recovered', explanation: 'JourneyOS protected late hotel check-in, shortened the arrival evening, and moved the displaced priority into the next compatible opening without adding estimated cost.', changedStops });
      setStage('applied');
      onTrip(response.trip, 'Four-hour delay recovery confirmed. The active-day itinerary is now updated.');
    } catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not apply the recovery plan.'); }
    finally { setBusy(false); }
  };

  return <>
    <section className="mt-6 flex flex-col justify-between gap-4 rounded-[24px] border border-coral/20 bg-[#fff8e9] p-5 sm:flex-row sm:items-center"><div><p className="eyebrow text-coral">Live recovery demo</p><h2 className="mt-1 text-xl font-bold text-ink">The flight is four hours late. What breaks next?</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-stone-600">JourneyOS traces the delay across hotel check-in, the first evening, group priorities, and cost—then waits for confirmation.</p></div><button onClick={openDemo} className="shrink-0 rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white"><Zap className="mr-2 inline" size={16} />Run delay recovery</button></section>
    {open && <div className="fixed inset-0 z-[70] bg-ink/30 backdrop-blur-[1px]" onClick={close} aria-hidden="true" />}
    {open && <aside className="fixed inset-y-0 right-0 z-[80] w-full max-w-lg overflow-y-auto bg-white p-5 shadow-2xl sm:p-7" aria-label="Four-hour flight-delay recovery">
      <div className="flex items-start justify-between gap-3"><div><p className={`eyebrow ${stage === 'applied' ? 'text-moss' : 'text-coral'}`}>{stage === 'detected' ? '1 · Disruption detected' : stage === 'proposed' ? '2 · Recovery proposed' : '3 · Recovery applied'}</p><h2 className="mt-1 text-2xl font-bold text-ink">{stage === 'detected' ? 'Arrival moves four hours later.' : stage === 'proposed' ? 'Review Trip Impact before changing anything.' : 'The optimized trip is now live.'}</h2></div><button aria-label="Close disruption panel" onClick={close} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100 text-stone-600"><X size={17} /></button></div>

      {stage === 'detected' && <div className="mt-7"><div className="rounded-[24px] border border-indigo-200 bg-indigo-50 p-5"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-700 text-white"><PlaneLanding /></span><div><p className="font-bold text-indigo-950">Inbound flight delayed</p><p className="mt-1 text-sm text-indigo-800">Original arrival +4h · expected arrival 20:20 local</p></div></div></div><div className="mt-5 space-y-3"><ImpactRow icon={Clock3} label="Hotel" value="Late check-in must be protected" /><ImpactRow icon={Sparkles} label="Itinerary" value={`${affectedDinner} no longer fits safely`} /><ImpactRow icon={UsersRound} label="Friends" value="Leila's early-evening constraint is at risk" /></div><button onClick={() => setStage('proposed')} className="mt-7 w-full rounded-xl bg-ink px-4 py-3.5 text-sm font-bold text-white">Analyze recovery options <ArrowRight className="ml-2 inline" size={16} /></button></div>}

      {stage === 'proposed' && <div className="mt-7"><div className="rounded-[24px] bg-[#f6fbf7] p-5"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-moss text-white"><Bot size={20} /></span><div><p className="text-xs font-bold uppercase tracking-wider text-moss">AI recovery explanation</p><p className="mt-2 text-sm leading-6 text-stone-700">Hold the hotel room for late arrival, replace the full dinner with a short vegetarian-friendly option near the hotel, and move <b>{protectedStop}</b> to tomorrow's best open slot. No booking changes happen until you confirm.</p></div></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><ImpactCard label="Schedule" before="First evening overloaded" after="Dinner near hotel" /><ImpactCard label="Hotel" before="Check-in at risk" after="Late arrival protected" /><ImpactCard label="Group priorities" before="2 constraints at risk" after={`${trip.travelers.length} of ${trip.travelers.length} protected`} /><ImpactCard label="Incremental cost" before="$0" after="$0 estimated" /></div><div className="mt-5 rounded-2xl border border-stone-200 p-4"><p className="text-xs font-bold uppercase tracking-wider text-stone-500">Dependency chain</p><div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-ink"><span className="rounded-lg bg-indigo-50 px-2.5 py-2">Flight +4h</span><ArrowRight size={14} className="text-stone-400" /><span className="rounded-lg bg-amber-50 px-2.5 py-2">Late check-in</span><ArrowRight size={14} className="text-stone-400" /><span className="rounded-lg bg-rose-50 px-2.5 py-2">Dinner moved</span><ArrowRight size={14} className="text-stone-400" /><span className="rounded-lg bg-emerald-50 px-2.5 py-2">Day 2 rebalanced</span></div></div><div className="mt-7 grid gap-3 sm:grid-cols-2"><button onClick={() => setStage('detected')} className="rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold text-stone-700"><RotateCcw className="mr-2 inline" size={16} />Back</button><button disabled={busy} onClick={() => void apply()} className="rounded-xl bg-moss px-4 py-3 text-sm font-bold text-white disabled:opacity-60"><ShieldCheck className="mr-2 inline" size={16} />{busy ? 'Applying recovery…' : 'Confirm & apply recovery'}</button></div></div>}

      {stage === 'applied' && <div className="mt-7"><div className="rounded-[24px] bg-moss p-5 text-white"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-white/15"><Check /></span><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-200">Synced across the trip</p><h3 className="mt-1 text-xl font-bold">{decision?.title}</h3></div></div><p className="mt-4 text-sm leading-6 text-white/75">{decision?.explanation || 'The arrival day and next available itinerary window were re-optimized.'}</p></div><div className="mt-5 rounded-2xl border border-moss/15 bg-[#f6fbf7] p-4"><p className="text-xs font-bold uppercase tracking-wider text-moss">Changed itinerary</p>{decision?.changedStops.length ? <ul className="mt-3 space-y-2">{decision.changedStops.map((stop) => <li className="flex gap-2 text-sm text-ink" key={stop}><Sparkles size={15} className="mt-0.5 shrink-0 text-coral" />{stop}</li>)}</ul> : <p className="mt-2 text-sm text-stone-600">Arrival timing, hotel protection, and the active-day route were recalculated.</p>}</div><div className="mt-5 grid gap-3 sm:grid-cols-3"><MiniStat icon={Clock3} label="Route" value="Rebalanced" /><MiniStat icon={UsersRound} label="Friends" value={`${trip.travelers.length} protected`} /><MiniStat icon={DollarSign} label="Added" value="$0 est." /></div><button onClick={close} className="mt-7 w-full rounded-xl bg-ink px-4 py-3.5 text-sm font-bold text-white">View updated optimized trip</button></div>}
    </aside>}
  </>;
}

function ImpactRow({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-stone-200 p-4"><Icon size={18} className="shrink-0 text-coral" /><div><p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</p><p className="mt-1 text-sm font-semibold text-ink">{value}</p></div></div>;
}

function ImpactCard({ label, before, after }: { label: string; before: string; after: string }) {
  return <div className="rounded-2xl border border-stone-200 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</p><div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs"><span className="text-stone-500">{before}</span><ArrowRight size={13} className="text-coral" /><b className="text-moss">{after}</b></div></div>;
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return <div className="rounded-2xl bg-stone-50 p-3"><Icon size={16} className="text-moss" /><p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-stone-400">{label}</p><p className="mt-1 text-sm font-bold text-ink">{value}</p></div>;
}
