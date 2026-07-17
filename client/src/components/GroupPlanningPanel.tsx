import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Phone, Save, Sparkles, UserRoundPen, X } from 'lucide-react';
import { api } from '../api';
import type { Interest, Traveler, Trip } from '../types';

const interests: Interest[] = ['culture', 'history', 'food', 'photography', 'shopping', 'nightlife', 'nature'];

export function GroupPlanningPanel({ trip, onTrip }: { trip: Trip; onTrip: (trip: Trip, note: string) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Traveler | null>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const admin = trip.travelers[0];
  const calls = trip.preferenceCollection?.calls ?? [];
  const phoneReady = trip.travelers.every((traveler) => (traveler.phone?.replace(/\D/g, '').length ?? 0) >= 7);
  const callByTraveler = useMemo(() => new Map(calls.map((call) => [call.travelerId, call])), [calls]);
  const mediationCall = calls.find((call) => call.dialogue?.length);

  useEffect(() => {
    if (!editingId) return;
    const current = trip.travelers.find((traveler) => traveler.id === editingId);
    if (current) setDraft(structuredClone(current));
  }, [editingId, trip.travelers]);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const response = await api.mutateTraveler({ action: 'update', id: draft.id, name: draft.name, phone: draft.phone, budgetPreference: draft.budgetPreference, activityLevel: draft.activityLevel, pacePreference: draft.pacePreference, foodPreference: draft.foodPreference, interests: draft.interests }, trip);
      onTrip(response.trip, `${draft.name}'s profile was updated. Group happiness and approval state were recalculated.`);
      setEditingId(null);
    } catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not save the traveler.'); }
    finally { setBusy(false); }
  };

  const add = async () => {
    setBusy(true);
    try {
      const response = await api.mutateTraveler({ action: 'add', name: newName, phone: newPhone }, trip);
      onTrip(response.trip, `${newName} was added. Add their preferences before calling the group.`);
      setNewName(''); setNewPhone('');
    } catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not add the traveler.'); }
    finally { setBusy(false); }
  };

  const remove = async (traveler: Traveler) => {
    setBusy(true);
    try { const response = await api.mutateTraveler({ action: 'remove', id: traveler.id }, trip); onTrip(response.trip, `${traveler.name} was removed and downstream totals were recalculated.`); }
    catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not remove the traveler.'); }
    finally { setBusy(false); }
  };

  const collect = async () => {
    if (!admin) return;
    setBusy(true);
    try {
      const phones = Object.fromEntries(trip.travelers.map((traveler) => [traveler.id, traveler.phone ?? '']));
      const response = await api.collectPreferences(admin.name, admin.phone ?? '', phones, trip);
      const liveCalls = response.collection.source === 'vocal-bridge';
      onTrip(response.trip, liveCalls ? `${response.collection.calls.length} outbound Vocal Bridge preference call${response.collection.calls.length === 1 ? '' : 's'} queued. The proposal will update after their call summaries are available.` : `${response.collection.calls.length} preference conversations completed. JourneyOS negotiated a group proposal for admin review.`);
    } catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not collect group preferences.'); }
    finally { setBusy(false); }
  };

  return <div className="mt-6 space-y-6">
    <section className="rounded-[30px] border border-stone-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-moss">Step 1 · traveler profiles</p><h2 className="mt-1 text-2xl font-bold text-ink">Give every person an editable voice.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">Phone, pace, constraints and interest strength are saved to the active trip. Changes invalidate an old decision instead of silently keeping it.</p></div><span className="rounded-full bg-[#eff6f1] px-3 py-1.5 text-xs font-bold text-moss">{trip.travelers.length} travelers</span></div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">{trip.travelers.map((traveler, index) => {
        const call = callByTraveler.get(traveler.id);
        const isEditing = editingId === traveler.id && draft;
        return <article key={traveler.id} className="rounded-2xl border border-stone-200 bg-[#fafbf9] p-4">
          {isEditing ? <div className="space-y-3">
            <div className="flex items-center justify-between"><b className="text-ink">Edit {traveler.name}</b><button aria-label="Cancel editing" onClick={() => setEditingId(null)}><X size={17} /></button></div>
            <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs font-bold text-stone-500">Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-ink" /></label><label className="text-xs font-bold text-stone-500">Phone<input value={draft.phone ?? ''} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-ink" /></label></div>
            <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs font-bold text-stone-500">Pace<select value={draft.pacePreference} onChange={(event) => setDraft({ ...draft, pacePreference: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><option value="easy">Easy</option><option value="balanced">Balanced</option><option value="full">Full</option></select></label><label className="text-xs font-bold text-stone-500">Food or constraint<input value={draft.foodPreference} onChange={(event) => setDraft({ ...draft, foodPreference: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm" /></label></div>
            <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">{interests.map((interest) => <label key={interest} className="text-xs font-semibold capitalize text-stone-600"><span className="flex justify-between"><span>{interest}</span><b className="text-moss">{draft.interests[interest]}/5</b></span><input type="range" min="1" max="5" step="1" value={draft.interests[interest]} onChange={(event) => setDraft({ ...draft, interests: { ...draft.interests, [interest]: Number(event.target.value) } })} className="w-full accent-[#245c4f]" /></label>)}</div>
            <button disabled={busy} onClick={() => void save()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-moss px-4 py-2.5 text-sm font-bold text-white"><Save size={15} />Save profile</button>
          </div> : <>
            <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">{traveler.initials}</span><div><p className="font-bold text-ink">{traveler.name} {index === 0 && <span className="ml-1 text-[10px] uppercase tracking-wide text-moss">Admin</span>}</p><p className="text-xs capitalize text-stone-500">{traveler.pacePreference} pace · {traveler.foodPreference}</p><p className="mt-1 text-xs text-stone-500">{traveler.phone || 'Phone required before calling'}</p></div></div><div className="flex gap-2"><button onClick={() => setEditingId(traveler.id)} className="inline-flex items-center gap-1 text-xs font-bold text-moss"><UserRoundPen size={14} />Edit</button><button disabled={busy || trip.travelers.length <= 2 || index === 0} onClick={() => void remove(traveler)} className="text-xs font-bold text-coral disabled:opacity-30">Remove</button></div></div>
            <div className="mt-4 grid gap-2">{interests.slice().sort((left, right) => traveler.interests[right] - traveler.interests[left]).slice(0, 3).map((interest) => <div key={interest} className="grid grid-cols-[90px_1fr_28px] items-center gap-2 text-xs"><span className="capitalize text-stone-600">{interest}</span><span className="h-2 overflow-hidden rounded-full bg-stone-200"><span className="block h-full rounded-full bg-coral" style={{ width: `${traveler.interests[interest] * 20}%` }} /></span><b className="text-right text-ink">{traveler.interests[interest]}/5</b></div>)}</div>
            {call && <div className="mt-4 rounded-xl bg-white p-3"><div className="flex items-center justify-between"><b className="text-xs text-ink">Current plan fit</b><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-moss">{call.happiness}%</span></div><p className="mt-2 text-xs leading-5 text-stone-600">{call.happinessExplanation}</p></div>}
          </>}
        </article>;
      })}</div>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input placeholder="New traveler name" value={newName} onChange={(event) => setNewName(event.target.value)} className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm" /><input placeholder="Phone number" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm" /><button disabled={busy || newName.trim().length < 2} onClick={() => void add()} className="rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Add traveler</button></div>
    </section>

    <section className="rounded-[30px] border border-moss/20 bg-[#f6fbf7] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-moss">Step 2 · Vocal Bridge mediation</p><h2 className="mt-1 text-2xl font-bold text-ink">Call each traveler, then negotiate one fair plan.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">Each non-admin traveler receives a private preference call. JourneyOS waits for the individual summaries, surfaces conflicts, and proposes one group compromise before the admin updates the trip.</p></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-moss ring-1 ring-moss/15">{trip.preferenceCollection?.source === 'vocal-bridge' ? 'Real Vocal Bridge' : 'Simulated Vocal Bridge'}</span></div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{trip.travelers.map((traveler, index) => { const call = callByTraveler.get(traveler.id); return <div key={traveler.id} className="rounded-xl bg-white p-3 ring-1 ring-moss/10"><div className="flex items-center justify-between"><b className="text-sm text-ink">{traveler.name}</b><span className={`text-[10px] font-bold uppercase ${call?.status === 'completed' || index === 0 ? 'text-moss' : traveler.phone ? 'text-amber-700' : 'text-coral'}`}>{index === 0 ? 'Admin brief' : call?.status ?? (traveler.phone ? 'Ready' : 'Needs phone')}</span></div><p className="mt-1 text-xs text-stone-500">{traveler.phone || 'Edit profile to add phone'}</p></div>; })}</div>
      <label className="mt-5 flex items-start gap-3 rounded-xl bg-white p-4 text-sm text-stone-700 ring-1 ring-moss/10"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#245c4f]" /><span><b className="text-ink">Call consent confirmed.</b> The admin confirms these travelers agreed to receive a preference call for this trip. Demo mode does not place a real call.</span></label>
      <p className="mt-3 rounded-xl border border-moss/15 bg-white px-4 py-3 text-xs leading-5 text-stone-600"><b className="text-ink">How it runs:</b> one private call per non-admin traveler, queued in a controlled sequence; the negotiation begins only after the completed call summaries are available. This is not a four-person conference call.</p>
      <button disabled={busy || !consent || !phoneReady} onClick={() => void collect()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-moss px-4 py-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Phone size={18} />{busy ? 'Calling and negotiating…' : 'Call travelers & negotiate preferences'}</button>
      {!phoneReady && <p className="mt-2 text-center text-xs font-semibold text-coral">Add a usable phone number to every traveler profile to enable calls.</p>}
      {trip.preferenceCollection && <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_260px]"><div className="rounded-2xl bg-white p-5"><div className="flex items-center gap-2"><Sparkles className="text-coral" size={18} /><b className="text-ink">Negotiated recommendation</b></div><p className="mt-3 text-sm leading-6 text-stone-700">{trip.preferenceCollection.negotiation}</p><p className="mt-3 border-l-2 border-coral pl-3 text-sm font-semibold text-ink">{trip.preferenceCollection.approvalSummary}</p></div><aside className="rounded-2xl bg-ink p-5 text-white"><p className="text-xs font-bold uppercase tracking-widest text-emerald-200">Projected group happiness</p><p className="mt-2 text-4xl font-bold">{trip.groupPreference.groupHappiness ?? 0}%</p><p className="mt-2 text-xs leading-5 text-white/65">Average {trip.groupPreference.averageHappiness ?? 0}% · fairness gap {trip.groupPreference.fairnessGap ?? 0} pts · penalty {trip.groupPreference.fairnessPenalty ?? 0}</p><div className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-200"><CheckCircle2 size={15} />Ready for Decision Studio</div></aside></div>}
    </section>
    {mediationCall?.dialogue && <section className="rounded-[30px] border border-coral/20 bg-[#fff8e9] p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="eyebrow text-coral">3-minute demo highlight</p><h3 className="mt-1 text-xl font-bold text-ink">Preference Mediation Agent finds a fair trade with {mediationCall.name}</h3></div><span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-moss">Transparent persuasion</span></div><div className="mt-4 space-y-2">{mediationCall.dialogue.map((line, index) => <div key={`${line.speaker}-${index}`} className={`rounded-xl px-4 py-3 text-sm leading-6 ${line.speaker === 'agent' ? 'mr-6 bg-ink text-white' : 'ml-6 bg-white text-stone-700'}`}><b className={line.speaker === 'agent' ? 'text-emerald-200' : 'text-coral'}>{line.speaker === 'agent' ? 'AI mediator' : mediationCall.name}:</b> {line.text}</div>)}</div><p className="mt-4 text-xs leading-5 text-stone-600"><b className="text-ink">Why this is safe:</b> the agent offers a visible trade, records consent, and sends the compromise to the admin. It never hides priorities or pressures someone to agree.</p></section>}
  </div>;
}
