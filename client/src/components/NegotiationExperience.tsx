import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Phone, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '../api';
import { SARAH_PROFILE, isSarahProfile } from '../constants/demo-profiles';
import type { Traveler, Trip } from '../types';

const topInterests = (traveler: Traveler) => Object.entries(traveler.interests)
  .sort((left, right) => right[1] - left[1])
  .slice(0, 2)
  .map(([interest]) => interest.replace(/\b\w/g, (letter) => letter.toUpperCase()));

const travelerSummary = (traveler: Traveler) => [
  ...topInterests(traveler),
  traveler.foodPreference,
  `${traveler.pacePreference.replace(/\b\w/g, (letter) => letter.toUpperCase())} pace`,
].filter(Boolean).slice(0, 3).join(' · ');

const knownPreferenceSummary = (trip: Trip, traveler: Traveler) => {
  if (isSarahProfile(traveler.id)) return SARAH_PROFILE.priorities.join(' · ');
  const captured = trip.preferenceCollection?.calls.find((call) => call.travelerId === traveler.id && call.status === 'completed');
  return captured?.topPriorities.length ? captured.topPriorities.join(' · ') : travelerSummary(traveler);
};

export function NegotiationExperience({ trip, onTrip }: { trip: Trip; onTrip: (trip: Trip, note: string) => void }) {
  const admin = trip.travelers[0];
  const agreement = trip.preferenceCollection?.agreement;
  const target = useMemo(() => {
    if (agreement) return trip.travelers.find((traveler) => traveler.id === agreement.travelerId);
    // The demo begins with the admin's live brief and Sarah's seeded profile already
    // available. When a third traveler exists, make Friend 2 the live negotiator.
    return trip.travelers[2] ?? trip.travelers[1];
  }, [agreement, trip.travelers]);
  const knownTravelers = useMemo(() => trip.travelers.filter((traveler) => traveler.id !== target?.id).slice(0, 3), [target?.id, trip.travelers]);
  const [phone, setPhone] = useState(target?.phone ?? '');
  const [targetName, setTargetName] = useState(target?.name ?? 'Friend 2');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [callStarted, setCallStarted] = useState(false);

  // The call panel is a projection of the saved roster, not a second source
  // of traveler data. Refresh all consent inputs whenever Friend 2 is edited
  // in Plan Together and saved.
  useEffect(() => {
    setPhone(target?.phone ?? '');
    setTargetName(target?.name ?? 'Friend 2');
    setConsent(false);
    setError('');
  }, [target?.id, target?.name, target?.phone]);
  useEffect(() => {
    const syncDraft = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; name?: string; phone?: string }>).detail;
      if (!detail || detail.id !== target?.id) return;
      setTargetName(detail.name?.trim() || 'Friend 2');
      setPhone(detail.phone ?? '');
      setConsent(false);
      setError('');
    };
    window.addEventListener('odyssey:friend-draft', syncDraft);
    return () => window.removeEventListener('odyssey:friend-draft', syncDraft);
  }, [target?.id]);
  const start = async () => {
    if (!target) return;
    setBusy(true); setError(''); setCallStarted(true);
    try {
      let current = trip;
      if (phone.trim() !== (target.phone ?? '') || targetName.trim() !== target.name) {
        const saved = await api.mutateTraveler({ action: 'update', id: target.id, name: targetName.trim(), phone: phone.trim(), budgetPreference: target.budgetPreference, activityLevel: target.activityLevel, pacePreference: target.pacePreference, foodPreference: target.foodPreference, interests: target.interests }, trip);
        current = saved.trip;
      }
      const result = await api.startNegotiation(target.id, current);
      onTrip(result.trip, result.mode === 'live' ? `Calling ${targetName.trim()} through Vocal Bridge.` : 'Running the clearly labeled negotiation fallback.');
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

  const dialogue = agreement?.dialogue ?? [];
  const comparisonReady = callStarted && agreement && ['accepted', 'applied'].includes(agreement.status) && agreement.dialogue.some((line) => line.speaker === 'traveler');
  const adminName = trip.preferenceCollection?.adminName ?? admin?.name ?? 'Trip admin';
  return <div className="space-y-6">
    <section className="overflow-hidden rounded-[32px] border border-[#d9e8df] bg-white">
      <div className="bg-ink px-5 py-7 text-white sm:px-8"><p className="eyebrow text-emerald-200">Main demo · one real conversation</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-3xl font-bold">AI Travel Negotiator</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">Odyssey already knows the group. It calls one consenting friend, explains a real conflict, proposes a fair trade, and waits for explicit agreement before changing the trip.</p></div><span className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold">Not a preference survey</span></div></div>
      <div className="grid gap-5 p-5 sm:p-8 lg:grid-cols-[1fr_0.9fr]">
        <div><p className="eyebrow text-coral">Known before the call</p><div className="mt-3 grid gap-3 sm:grid-cols-3">{knownTravelers.map((traveler) => <Known key={traveler.id} name={traveler.name} value={knownPreferenceSummary(trip, traveler)} captured={traveler.id === 't-sarah'} />)}</div>
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-extrabold uppercase tracking-widest text-amber-800">Live comparison</p><h3 className="mt-2 text-xl font-bold text-ink">{comparisonReady ? 'Generated from the live conversation' : 'Waiting for the traveler to speak'}</h3><p className="mt-2 text-sm leading-6 text-stone-700">{comparisonReady ? <>{agreement.conflict} Odyssey generated this trade from the live answer: {agreement.proposal}</> : <>Saved profiles are ready, but no live conflict or compromise is displayed yet. Odyssey first hears {target?.name ?? 'the live traveler'}’s unscripted priority, then compares it with the group.</>}</p></div>
        </div>
        <div className="rounded-2xl bg-[#f3f8f5] p-5"><div className="flex items-center gap-2"><ShieldCheck size={20} className="text-moss" /><b className="text-ink">Call one consenting friend</b></div><p className="mt-3 text-xs leading-5 text-stone-600">Calling <b className="text-ink">{targetName}</b>. These details mirror the Friends card above.</p><label className="mt-4 block text-xs font-bold text-stone-600">{targetName} phone (E.164)<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+14155550123" className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-ink" /></label><label className="mt-4 flex items-start gap-3 text-xs leading-5 text-stone-700"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#245c4f]" /><span>I confirm {targetName} consented to a short demo call. Never enter a judge’s number without permission.</span></label><button disabled={!target || !consent || busy || !/^\+[1-9]\d{7,14}$/.test(phone.trim())} onClick={() => void start()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-moss px-4 py-3.5 text-sm font-bold text-white disabled:opacity-40"><Phone size={17} />{busy ? 'Negotiating…' : `Call ${targetName} and negotiate`}</button><p className="mt-3 text-xs leading-5 text-stone-500">Live mode uses Vocal Bridge. If credentials, CLI, or outbound quota are unavailable, Odyssey automatically runs the same flow as a labeled scripted fallback.</p></div>
      </div>
    </section>

    {callStarted && (agreement || dialogue.length > 0) && <section className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
      <div className="rounded-[28px] border border-stone-200 bg-white p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="eyebrow text-moss">Live transcript</p><h3 className="mt-1 text-2xl font-bold text-ink">The AI explains why it is asking.</h3></div><span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-600">{trip.preferenceCollection?.source === 'vocal-bridge' ? 'Vocal Bridge live call' : 'Scripted fallback'}</span></div><div className="mt-5 space-y-3">{dialogue.map((line, index) => <div key={`${line.speaker}-${index}`} className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${line.speaker === 'agent' ? 'bg-ink text-white' : 'ml-auto bg-[#eef6f1] text-ink'}`}><b className={line.speaker === 'agent' ? 'text-emerald-200' : 'text-moss'}>{line.speaker === 'agent' ? 'Odyssey' : agreement?.travelerName ?? target?.name}:</b> {line.text}</div>)}</div></div>
      <aside className="rounded-[28px] border border-[#cfe4d8] bg-[#f3f8f5] p-5 sm:p-6">{agreement?.status === 'calling' ? <><Sparkles className="text-moss" /><h3 className="mt-3 text-2xl font-bold text-ink">Voice negotiation in progress</h3><p className="mt-2 text-sm leading-6 text-stone-600">The Vocal Bridge agent is collecting the live priority, explaining any trade, and waiting for the traveler’s spoken yes or no. Nothing is accepted or changed in the app yet.</p></> : agreement && <><div className="flex items-center gap-2 text-moss"><CheckCircle2 size={22} /><b>{agreement.status === 'declined' ? 'No agreement recorded' : 'Conflict resolved'}</b></div><h3 className="mt-3 text-2xl font-bold text-ink">{agreement.status === 'declined' ? 'Nothing changes silently' : `Agreement ready for ${adminName}`}</h3>{agreement.status !== 'declined' && <><div className="mt-5 flex items-end gap-3"><span className="text-3xl font-bold text-stone-400">{agreement.beforeHappiness}%</span><span className="pb-1 text-stone-400">→</span><span className="text-5xl font-bold text-moss">{agreement.afterHappiness}%</span></div><p className="mt-1 text-xs font-bold uppercase tracking-widest text-stone-500">deterministic group plan fit</p><ul className="mt-5 space-y-2 text-sm text-stone-700">{agreement.agreedChanges.map((change) => <li key={change} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-moss" />{change}</li>)}</ul>{agreement.status === 'accepted' && <button disabled={busy} onClick={() => void apply()} className="mt-6 w-full rounded-xl bg-coral px-4 py-3.5 text-sm font-bold text-white disabled:opacity-40">{adminName}: apply agreement to Day {agreement.affectedDay}</button>}{agreement.status === 'applied' && <p className="mt-6 rounded-xl bg-white p-4 text-sm font-bold text-moss">Applied to Day {agreement.affectedDay}: {agreement.agreedChanges.join(' and ')}.</p>}</>}</>}</aside>
    </section>}
    {comparisonReady && <section className="rounded-[28px] border border-stone-200 bg-white p-5 sm:p-6"><p className="eyebrow text-moss">Admin preview</p><h3 className="mt-1 text-2xl font-bold text-ink">Nothing changes silently.</h3><div className="mt-5 grid gap-3 md:grid-cols-2">{agreement.preview.map((item) => <div key={item.label} className="rounded-2xl bg-stone-50 p-4"><b className="text-ink">{item.label}</b><p className="mt-2 text-sm text-stone-500 line-through">{item.before}</p><p className="mt-1 text-sm font-semibold text-moss">{item.after}</p></div>)}</div></section>}
    {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
  </div>;
}

function Known({ name, value, captured }: { name: string; value: string; captured?: boolean }) {
  return <div className="rounded-xl bg-stone-50 p-4"><div className="flex items-center justify-between gap-2"><b className="text-sm text-ink">{name}</b>{captured && <span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-moss">Brief captured</span>}</div><p className="mt-1 text-xs leading-5 text-stone-600">{value}</p></div>;
}
