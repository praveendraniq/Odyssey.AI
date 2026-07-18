import { useEffect, useState } from 'react';
import { BatteryLow, CheckCircle2, Clock3, CloudRain, MapPinOff, Plane, Sparkles } from 'lucide-react';
import { api } from '../api';
import type { ReplanType, Trip } from '../types';

const choices: Array<{ type: ReplanType; label: string; detail: string; icon: typeof Clock3; tone: string }> = [
  { type: 'late', label: 'Running late', detail: 'Shift what still fits', icon: Clock3, tone: 'bg-amber-50 text-amber-800 ring-amber-200' },
  { type: 'rain', label: 'Heavy rain', detail: 'Favor indoor stops', icon: CloudRain, tone: 'bg-sky-50 text-sky-800 ring-sky-200' },
  { type: 'flight-delay', label: 'Flight delay', detail: 'Protect arrival day', icon: Plane, tone: 'bg-indigo-50 text-indigo-800 ring-indigo-200' },
  { type: 'closed', label: 'Place closed', detail: 'Find a nearby match', icon: MapPinOff, tone: 'bg-rose-50 text-rose-800 ring-rose-200' },
  { type: 'tired', label: 'Feeling tired', detail: 'Reduce pace and travel', icon: BatteryLow, tone: 'bg-teal-50 text-teal-800 ring-teal-200' },
];

export function DisruptionDemo({ trip, activeDay, onTrip }: { trip: Trip; activeDay: number; onTrip: (trip: Trip, note: string) => void }) {
  const [busy, setBusy] = useState<ReplanType | null>(null);
  const [result, setResult] = useState<{ type: ReplanType; day: number; title: string; changed: Array<{ title: string; time: string }> } | null>(null);

  // A result belongs to one itinerary day. Do not leave a Day 1 confirmation
  // visible when the admin moves to Day 2.
  useEffect(() => setResult(null), [activeDay]);

  const apply = async (type: ReplanType) => {
    setBusy(type);
    try {
      const before = new Map(trip.itinerary.map((item) => [item.id, `${item.time}|${item.title}|${item.subtitle}|${item.status}`]));
      const response = await api.replan(type, trip, activeDay);
      const changed = response.trip.itinerary
        .filter((item) => item.day === activeDay && before.get(item.id) !== `${item.time}|${item.title}|${item.subtitle}|${item.status}`)
        .sort((left, right) => left.time.localeCompare(right.time))
        .map((item) => ({ title: item.title, time: item.time }));
      setResult({ type, day: activeDay, title: response.event.title, changed });
      onTrip(response.trip, `${response.event.title}. Day ${activeDay} and its optimized sequence were updated.`);
    } catch (error) {
      onTrip(trip, error instanceof Error ? error.message : 'Could not re-optimize this day.');
    } finally { setBusy(null); }
  };

  return <section className="mt-6 rounded-[26px] border border-stone-200 bg-white p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="eyebrow text-coral">Something changed?</p><h2 className="mt-1 text-xl font-bold text-ink">Re-optimize Day {activeDay}</h2><p className="mt-1 text-sm text-stone-500">Choose one quick demo event. The updated optimized plan appears directly below.</p></div><Sparkles className="hidden text-coral sm:block" /></div>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">{choices.map(({ type, label, detail, icon: Icon, tone }) => <button key={type} disabled={Boolean(busy)} onClick={() => void apply(type)} className={`group rounded-2xl p-3 text-left ring-1 transition hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-50 ${tone}`}><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/80"><Icon size={18} className={busy === type ? 'animate-pulse' : ''} /></span><b className="mt-3 block text-sm">{busy === type ? 'Updating…' : label}</b><span className="mt-0.5 block text-[11px] opacity-70">{detail}</span></button>)}</div>
    {result && <div role="status" aria-live="polite" className="mt-4 rounded-2xl border border-emerald-200 bg-[#eff6f1] p-4"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-moss" size={19} /><div><p className="text-sm font-bold text-ink">Applied to Day {result.day} · {result.title}</p><p className="mt-1 text-xs leading-5 text-stone-600">The optimized sequence directly below is now refreshed and time-sorted.</p></div></div>{result.changed.length > 0 && <ol className="mt-3 space-y-1 border-t border-emerald-200 pt-3 text-xs text-stone-700">{result.changed.map((item) => <li key={`${item.time}-${item.title}`}><b className="mr-2 text-moss">{item.time}</b>{item.title}</li>)}</ol>}</div>}
  </section>;
}
