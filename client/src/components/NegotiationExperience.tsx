import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Phone, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '../api';
import type { NegotiationAgreement, Traveler, Trip } from '../types';

const topInterests = (traveler: Traveler) => Object.entries(traveler.interests)
  .sort((left, right) => right[1] - left[1])
  .slice(0, 2)
  .map(([interest]) => interest.replace(/\b\w/g, (letter) => letter.toUpperCase()));

const travelerSummary = (traveler: Traveler) => [
  ...topInterests(traveler),
  traveler.foodPreference,
  `${traveler.pacePreference.replace(/\b\w/g, (letter) => letter.toUpperCase())} pace`,
].filter(Boolean).slice(0, 3).join(' · ');

const buildScriptedDialogue = (agreement: NegotiationAgreement, adminName: string, destination: string, statedPriority: string) => [
  { speaker: 'agent' as const, text: `Hi ${agreement.travelerName}. ${adminName} is organizing ${destination}, and I already know the group’s priorities. I need your help resolving one conflict.` },
  { speaker: 'agent' as const, text: 'Before I assume anything: what is the one thing that matters most to you on this trip, or one constraint I should protect?' },
  { speaker: 'traveler' as const, text: `The one thing I care most about is ${statedPriority.toLowerCase()}.` },
  { speaker: 'agent' as const, text: 'Thanks. I’m comparing that live answer with the preferences already collected from the group.' },
];

export function NegotiationExperience({ trip, onTrip }: { trip: Trip; onTrip: (trip: Trip, note: string) => void }) {
  const admin = trip.travelers[0];
  const agreement = trip.preferenceCollection?.agreement;
  const target = useMemo(() => {
    if (agreement) return trip.travelers.find((traveler) => traveler.id === agreement.travelerId);
    return trip.travelers.slice(1).sort((left, right) => right.interests.nightlife - left.interests.nightlife)[0];
  }, [agreement, trip.travelers]);
  const knownTravelers = useMemo(() => trip.travelers.filter((traveler) => traveler.id !== target?.id).slice(0, 3), [target?.id, trip.travelers]);
  const scriptedDialogue = useMemo(() => agreement ? buildScriptedDialogue(agreement, trip.preferenceCollection?.adminName ?? admin?.name ?? 'Trip admin', trip.request.destination, target ? topInterests(target)[0] ?? 'a memorable local experience' : 'a memorable local experience') : [], [admin?.name, agreement, target, trip.preferenceCollection?.adminName, trip.request.destination]);
  const [phone, setPhone] = useState(target?.phone ?? '');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'live' | 'scripted' | null>(null);
  const [visibleLines, setVisibleLines] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => setPhone(target?.phone ?? ''), [target?.phone]);
  useEffect(() => {
    if (mode !== 'scripted' || agreement?.status !== 'calling') return;
    if (visibleLines < scriptedDialogue.length) {
      const timer = window.setTimeout(() => setVisibleLines((count) => count + 1), 650);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(async () => {
      try {
        const result = await api.simulateNegotiation(trip);
        onTrip(result.trip, 'Conflict resolved by the AI Travel Negotiator.');
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not finish the scripted negotiation.'); }
      finally { setBusy(false); }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [agreement?.status, mode, onTrip, scriptedDialogue.length, trip, visibleLines]);

  const start = async () => {
    if (!target) return;
    setBusy(true); setError(''); setVisibleLines(0);
    try {
      let current = trip;
      if (phone.trim() !== (target.phone ?? '')) {
        const saved = await api.mutateTraveler({ action: 'update', id: target.id, name: target.name, phone: phone.trim(), budgetPreference: target.budgetPreference, activityLevel: target.activityLevel, pacePreference: target.pacePreference, foodPreference: target.foodPreference, interests: target.interests }, trip);
        current = saved.trip;
      }
      const result = await api.startNegotiation(target.id, current);
      setMode(result.mode);
      onTrip(result.trip, result.mode === 'live' ? `Calling ${target.name} through Vocal Bridge.` : 'Running the clearly labeled negotiation fallback.');
      if (result.mode === 'live') setBusy(false);
    } catch (cause) { setBusy(false); setError(cause instanceof Error ? cause.message : 'Could not start the negotiation.'); }
  };

  const apply = async () => {
    setBusy(true); setError('');
    try {
      const result = await api.applyNegotiation(trip);
      onTrip(result.trip, `Negotiated Day ${agreement?.affectedDay ?? ''} changes applied.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not apply the agreement.'); }
    finally { setBusy(false); }
  };

  const dialogue = agreement?.dialogue.length ? agreement.dialogue : scriptedDialogue.slice(0, visibleLines);
  const adminName = trip.preferenceCollection?.adminName ?? admin?.name ?? 'Trip admin';
  return <div className="space-y-6">
    <section className="overflow-hidden rounded-[32px] border border-[#d9e8df] bg-white">
      <div className="bg-ink px-5 py-7 text-white sm:px-8"><p className="eyebrow text-emerald-200">Main demo · one real conversation</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-3xl font-bold">AI Travel Negotiator</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">JourneyOS already knows the group. It calls one consenting friend, explains a real conflict, proposes a fair trade, and waits for explicit agreement before changing the trip.</p></div><span className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold">Not a preference survey</span></div></div>
      <div className="grid gap-5 p-5 sm:p-8 lg:grid-cols-[1fr_0.9fr]">
        <div><p className="eyebrow text-coral">Known before the call</p><div className="mt-3 grid gap-3 sm:grid-cols-3">{knownTravelers.map((traveler) => <Known key={traveler.id} name={traveler.name} value={travelerSummary(traveler)} />)}</div>
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-extrabold uppercase tracking-widest text-amber-800">Live comparison</p><h3 className="mt-2 text-xl font-bold text-ink">No conflict is assumed before the traveler speaks</h3><p className="mt-2 text-sm leading-6 text-stone-700">{agreement && agreement.status !== 'calling' ? <>{agreement.conflict} JourneyOS generated this trade from the live answer: {agreement.proposal}</> : <>Two saved preference profiles are ready. JourneyOS will hear {target?.name ?? 'the live traveler'}’s unscripted priority, compare it with the group, and negotiate only if a real conflict emerges.</>}</p></div>
        </div>
        <div className="rounded-2xl bg-[#f3f8f5] p-5"><div className="flex items-center gap-2"><ShieldCheck size={20} className="text-moss" /><b className="text-ink">Call one consenting friend</b></div><label className="mt-4 block text-xs font-bold text-stone-600">{target?.name ?? 'Friend'} phone (E.164)<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+14155550123" className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-ink" /></label><label className="mt-4 flex items-start gap-3 text-xs leading-5 text-stone-700"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#245c4f]" /><span>I confirm this person consented to a short demo call. Never enter a judge’s number without permission.</span></label><button disabled={!target || !consent || busy || !/^\+[1-9]\d{7,14}$/.test(phone.trim())} onClick={() => void start()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-moss px-4 py-3.5 text-sm font-bold text-white disabled:opacity-40"><Phone size={17} />{busy ? 'Negotiating…' : `Call ${target?.name ?? 'friend'} and negotiate`}</button><p className="mt-3 text-xs leading-5 text-stone-500">Live mode uses Vocal Bridge. If credentials, CLI, or outbound quota are unavailable, JourneyOS automatically runs the same flow as a labeled scripted fallback.</p></div>
      </div>
    </section>

    {(agreement || dialogue.length > 0) && <section className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
      <div className="rounded-[28px] border border-stone-200 bg-white p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="eyebrow text-moss">Live transcript</p><h3 className="mt-1 text-2xl font-bold text-ink">The AI explains why it is asking.</h3></div><span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-600">{trip.preferenceCollection?.source === 'vocal-bridge' ? 'Vocal Bridge live call' : 'Scripted fallback'}</span></div><div className="mt-5 space-y-3">{dialogue.map((line, index) => <div key={`${line.speaker}-${index}`} className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${line.speaker === 'agent' ? 'bg-ink text-white' : 'ml-auto bg-[#eef6f1] text-ink'}`}><b className={line.speaker === 'agent' ? 'text-emerald-200' : 'text-moss'}>{line.speaker === 'agent' ? 'JourneyOS' : agreement?.travelerName ?? target?.name}:</b> {line.text}</div>)}</div></div>
      <aside className="rounded-[28px] border border-[#cfe4d8] bg-[#f3f8f5] p-5 sm:p-6">{agreement?.status === 'calling' ? <><Sparkles className="text-moss" /><h3 className="mt-3 text-2xl font-bold text-ink">Negotiation in progress</h3><p className="mt-2 text-sm leading-6 text-stone-600">Listening for an explicit yes or no before any itinerary change.</p></> : agreement && <><div className="flex items-center gap-2 text-moss"><CheckCircle2 size={22} /><b>Conflict resolved</b></div><h3 className="mt-3 text-2xl font-bold text-ink">Agreement ready for {adminName}</h3><div className="mt-5 flex items-end gap-3"><span className="text-3xl font-bold text-stone-400">{agreement.beforeHappiness}%</span><span className="pb-1 text-stone-400">→</span><span className="text-5xl font-bold text-moss">{agreement.afterHappiness}%</span></div><p className="mt-1 text-xs font-bold uppercase tracking-widest text-stone-500">deterministic group plan fit</p><ul className="mt-5 space-y-2 text-sm text-stone-700">{agreement.agreedChanges.map((change) => <li key={change} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-moss" />{change}</li>)}</ul>{agreement.status === 'accepted' && <button disabled={busy} onClick={() => void apply()} className="mt-6 w-full rounded-xl bg-coral px-4 py-3.5 text-sm font-bold text-white disabled:opacity-40">{adminName}: apply agreement to Day {agreement.affectedDay}</button>}{agreement.status === 'applied' && <p className="mt-6 rounded-xl bg-white p-4 text-sm font-bold text-moss">Applied to Day {agreement.affectedDay}: {agreement.agreedChanges.join(' and ')}.</p>}</>}</aside>
    </section>}
    {agreement && agreement.status !== 'calling' && <section className="rounded-[28px] border border-stone-200 bg-white p-5 sm:p-6"><p className="eyebrow text-moss">Admin preview</p><h3 className="mt-1 text-2xl font-bold text-ink">Nothing changes silently.</h3><div className="mt-5 grid gap-3 md:grid-cols-2">{agreement.preview.map((item) => <div key={item.label} className="rounded-2xl bg-stone-50 p-4"><b className="text-ink">{item.label}</b><p className="mt-2 text-sm text-stone-500 line-through">{item.before}</p><p className="mt-1 text-sm font-semibold text-moss">{item.after}</p></div>)}</div></section>}
    {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
  </div>;
}

function Known({ name, value }: { name: string; value: string }) {
  return <div className="rounded-xl bg-stone-50 p-4"><b className="text-sm text-ink">{name}</b><p className="mt-1 text-xs leading-5 text-stone-600">{value}</p></div>;
}
