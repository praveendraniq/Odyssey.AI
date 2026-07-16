import { useState } from 'react';
import { BatteryLow, Bot, CircleOff, CloudRain, PlaneLanding, Sparkles, X, Zap } from 'lucide-react';
import { api } from '../api';
import type { ReplanType, Trip } from '../types';

const events: Array<{ type: ReplanType; label: string; detail: string; icon: typeof Zap; color: string }> = [
  { type: 'late', label: 'Running late', detail: '+90 minutes', icon: Zap, color: 'bg-amber-50 text-amber-900 border-amber-200' },
  { type: 'rain', label: 'Heavy rain', detail: 'Outdoor plans affected', icon: CloudRain, color: 'bg-sky-50 text-sky-900 border-sky-200' },
  { type: 'flight-delay', label: 'Flight delay', detail: '+2 hours', icon: PlaneLanding, color: 'bg-indigo-50 text-indigo-900 border-indigo-200' },
  { type: 'closed', label: 'Attraction closed', detail: 'Find a nearby match', icon: CircleOff, color: 'bg-rose-50 text-rose-900 border-rose-200' },
  { type: 'tired', label: 'Traveler tired', detail: 'Reduce walking', icon: BatteryLow, color: 'bg-teal-50 text-teal-900 border-teal-200' },
];

export function DisruptionDemo({ trip, activeDay, onTrip }: { trip: Trip; activeDay: number; onTrip: (trip: Trip, note: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<{ title: string; explanation: string; changedStops: string[] } | null>(null);

  const apply = async (type: ReplanType) => {
    setBusy(true);
    try {
      const before = new Map(trip.itinerary.map((item) => [item.id, `${item.time}|${item.title}|${item.status}`]));
      const response = await api.replan(type, trip, activeDay);
      const changedStops = response.trip.itinerary.filter((item) => before.get(item.id) !== `${item.time}|${item.title}|${item.status}`).map((item) => item.title).slice(0, 3);
      onTrip(response.trip, `${response.event.title} applied. The route and timeline are updated.`);
      setDecision({ title: response.event.title, explanation: response.event.explanation, changedStops });
    } catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not simulate the disruption.'); }
    finally { setBusy(false); }
  };

  return <>
    <section className="mt-6 flex flex-col justify-between gap-4 rounded-[24px] border border-coral/20 bg-[#fff8e9] p-5 sm:flex-row sm:items-center"><div><p className="eyebrow text-coral">Demo mode</p><h2 className="mt-1 text-xl font-bold text-ink">Show how the trip adapts when travel changes.</h2><p className="mt-1 text-sm text-stone-600">Open a small disruption panel, choose one event, and watch the itinerary update behind it.</p></div><button onClick={() => { setDecision(null); setOpen(true); }} className="shrink-0 rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white"><Zap className="mr-2 inline" size={16} />Demo disruptions</button></section>
    {(open || decision) && <div className="fixed inset-0 z-[70] bg-ink/25" onClick={() => { setOpen(false); setDecision(null); }} aria-hidden="true" />}
    {(open || decision) && <aside className="fixed inset-y-0 right-0 z-[80] w-full max-w-sm overflow-y-auto bg-white p-6 shadow-2xl" aria-label={decision ? 'AI decision explanation' : 'Demo disruption choices'}><div className="flex items-start justify-between gap-3"><div>{decision ? <><p className="eyebrow text-moss">AI decision</p><h2 className="mt-1 text-2xl font-bold text-ink">Here’s what changed—and why.</h2></> : <><p className="eyebrow text-coral">Demo disruptions</p><h2 className="mt-1 text-2xl font-bold text-ink">What just happened?</h2></>}</div><button aria-label="Close disruption panel" onClick={() => { setOpen(false); setDecision(null); }} className="grid h-9 w-9 place-items-center rounded-full bg-stone-100 text-stone-600"><X size={17} /></button></div>
      {decision ? <div className="mt-8"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-moss text-white"><Bot /></div><h3 className="mt-5 text-xl font-bold text-ink">{decision.title}</h3><p className="mt-3 border-l-2 border-coral pl-4 text-base leading-7 text-stone-700">{decision.explanation}</p><div className="mt-6 rounded-2xl bg-[#eff6f1] p-4"><p className="text-xs font-bold uppercase tracking-wider text-moss">Trip plan updated</p>{decision.changedStops.length ? <ul className="mt-3 space-y-2">{decision.changedStops.map((stop) => <li className="flex gap-2 text-sm text-ink" key={stop}><Sparkles size={15} className="mt-0.5 shrink-0 text-coral" />{stop}</li>)}</ul> : <p className="mt-2 text-sm text-stone-600">Timing and route protections were recalculated.</p>}</div><button onClick={() => { setOpen(false); setDecision(null); }} className="mt-6 w-full rounded-xl bg-moss px-4 py-3 text-sm font-bold text-white">View updated trip plan</button><button onClick={() => { setDecision(null); setOpen(true); }} className="mt-3 w-full rounded-xl border border-moss px-4 py-3 text-sm font-bold text-moss">Try another disruption</button></div>
        : <div className="mt-6 space-y-3">{events.map(({ type, label, detail, icon: Icon, color }) => <button disabled={busy} onClick={() => void apply(type)} key={type} className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left disabled:opacity-50 ${color}`}><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/70"><Icon size={20} /></span><span><b className="block text-sm">{label}</b><small className="mt-1 block opacity-70">{detail}</small></span></button>)}</div>}
    </aside>}
  </>;
}
