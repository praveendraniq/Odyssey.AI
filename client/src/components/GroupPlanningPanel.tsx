import { useMemo, useState } from 'react';
import { Check, CheckCircle2, Phone, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import type { Trip } from '../types';

type CallStage = 'idle' | 'calling' | 'connected' | 'extracting' | 'complete';

const demoTranscript = [
  { speaker: 'JourneyOS', text: 'Prabhu, what would make Tokyo feel worth the trip for you?' },
  { speaker: 'Prabhu', text: 'Street food and one late night. I do not want an early start every day.' },
  { speaker: 'JourneyOS', text: 'Deepu needs vegetarian options and a quieter evening. Would an earlier food-market visit plus optional nightlife work?' },
  { speaker: 'Prabhu', text: 'Yes. Keep the food experience and let me join the late option.' },
];

const friendFallbacks: Record<string, { wants: string; avoids: string; compromise: string }> = {
  Hema: { wants: 'Culture and one must-see landmark', avoids: 'A rushed checklist', compromise: 'Protect one cultural anchor and leave recovery time' },
  Prabhu: { wants: 'Street food and one late night', avoids: 'Early starts every day', compromise: 'Earlier food market with optional nightlife' },
  Deepu: { wants: 'Vegetarian-friendly meals and a calm evening', avoids: 'Shellfish-only or late dining', compromise: 'Shared early dinner before the optional late plan' },
  Sanjay: { wants: 'Golden-hour photography', avoids: 'Backtracking across the city', compromise: 'Cluster photo stops into the cultural route' },
};

export function GroupPlanningPanel({ trip, onTrip }: { trip: Trip; onTrip: (trip: Trip, note: string) => void }) {
  const [stage, setStage] = useState<CallStage>('idle');
  const [visibleLines, setVisibleLines] = useState(0);
  const [consent, setConsent] = useState(false);
  const calls = trip.preferenceCollection?.calls ?? [];
  const friends = useMemo(() => trip.travelers.slice(0, 4), [trip.travelers]);
  const calledFriend = friends.find((friend) => friend.name.toLowerCase() === 'prabhu') ?? friends[1] ?? friends[0];

  const runDemo = async () => {
    if (!calledFriend || !consent || stage !== 'idle') return;
    const pause = (duration: number) => new Promise((resolve) => window.setTimeout(resolve, duration));
    setStage('calling');
    setVisibleLines(0);
    await pause(650);
    setStage('connected');
    for (let index = 0; index < demoTranscript.length; index += 1) {
      await pause(650);
      setVisibleLines(index + 1);
    }
    setStage('extracting');
    await pause(700);
    const completedCalls = friends.map((friend) => {
      const fallback = friendFallbacks[friend.name] ?? { wants: 'A memorable shared experience', avoids: 'An overloaded schedule', compromise: 'Protect one priority and keep flexibility' };
      return { travelerId: friend.id, name: friend.name, phone: friend.phone || 'demo-safe', status: 'completed' as const, summary: `${fallback.wants}. Avoid: ${fallback.avoids}.`, happiness: friend.name === 'Prabhu' ? 82 : 84, topPriorities: fallback.wants.split(' and '), compromise: fallback.compromise, happinessExplanation: 'The proposed route protects the traveler’s stated priority and makes the conflicting portion optional.', dialogue: friend.name === 'Prabhu' ? demoTranscript.map((line) => ({ speaker: line.speaker === 'JourneyOS' ? 'agent' as const : 'traveler' as const, text: line.text })) : undefined };
    });
    const updated: Trip = { ...trip, preferenceCollection: { adminName: friends[0]?.name ?? 'Hema', adminWeight: 1.5, source: 'mock', calls: completedCalls, negotiation: 'Move the shared food-market experience earlier, guarantee vegetarian options, and make the late-night stop optional. Cluster the photo stop into the cultural route so no one backtracks.', approvalSummary: `All ${friends.length} priorities are represented; the admin can review and apply the fair trade.`, status: 'pending' }, groupPreference: { ...trip.groupPreference, groupHappiness: 83, averageHappiness: 84, fairnessGap: 2, fairnessPenalty: 1 } };
    onTrip(updated, `${calledFriend.name}'s demo preferences were added without placing a phone call. The group compromise is ready for admin review.`);
    setStage('complete');
  };

  const reset = () => { setStage('idle'); setVisibleLines(0); };
  const isComplete = stage === 'complete' || Boolean(trip.preferenceCollection);

  return <section className="rounded-[32px] border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="eyebrow text-violet-800">Voice-mediated group consensus</p>
        <h2 className="mt-1 max-w-3xl text-2xl font-bold text-ink">Call one friend, surface the conflict, negotiate a fair trade.</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">JourneyOS interviews travelers privately, records constraints, and asks the admin to approve the compromise. It never hides a trade or changes the trip without confirmation.</p>
      </div>
      <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-violet-800 ring-1 ring-violet-200">Vocal Bridge demo</span>
    </div>

    <div className="mt-6 grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {friends.map((friend, index) => {
            const fallback = friendFallbacks[friend.name] ?? { wants: 'A memorable shared experience', avoids: 'An overloaded schedule', compromise: 'Protect one priority and keep flexibility' };
            const call = calls.find((item) => item.travelerId === friend.id || item.name === friend.name);
            return <article key={friend.id} className={`rounded-2xl border bg-white p-4 ${friend.id === calledFriend?.id ? 'border-violet-300 ring-2 ring-violet-100' : 'border-stone-200'}`}>
              <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">{friend.initials}</span><b className="text-sm text-ink">{friend.name}</b></div><span className="text-[10px] font-bold uppercase tracking-wide text-moss">{index === 0 ? 'Admin brief' : call?.status === 'completed' ? 'Collected' : friend.id === calledFriend?.id && stage !== 'idle' ? stage : 'Ready'}</span></div>
              <p className="mt-3 text-xs leading-5 text-stone-600"><b className="text-ink">Wants:</b> {call?.topPriorities?.join(', ') || fallback.wants}</p>
              <p className="mt-1 text-xs leading-5 text-stone-600"><b className="text-ink">Avoid:</b> {fallback.avoids}</p>
            </article>;
          })}
        </div>
        <label className="flex items-start gap-3 rounded-2xl bg-white p-4 text-xs leading-5 text-stone-600 ring-1 ring-violet-100"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#245c4f]" /><span><b className="text-ink">Call consent confirmed.</b> Use a controlled test number for a real call. This on-screen sequence remains the deterministic stage fallback.</span></label>
        {!isComplete ? <button disabled={!consent || stage !== 'idle'} onClick={() => void runDemo()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-800 px-5 py-3.5 text-sm font-bold text-white disabled:opacity-40"><Phone size={17} />{stage === 'idle' ? `Call ${calledFriend?.name ?? 'traveler'} & negotiate` : stage === 'calling' ? 'Calling…' : stage === 'connected' ? 'Interview in progress…' : 'Extracting preferences…'}</button> : <button onClick={reset} className="w-full rounded-2xl border border-violet-300 bg-white px-5 py-3 text-sm font-bold text-violet-800">Replay preference-call demo</button>}
      </div>

      <div className="rounded-[24px] bg-ink p-5 text-white sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-200">{stage === 'calling' ? 'Dialing traveler' : stage === 'connected' ? 'Live transcript' : stage === 'extracting' ? 'Structuring preferences' : isComplete ? 'Negotiation complete' : 'Preference call preview'}</p><h3 className="mt-1 text-xl font-bold">{calledFriend?.name ?? 'Traveler'} × JourneyOS</h3></div><span className={`h-3 w-3 rounded-full ${stage === 'connected' ? 'animate-pulse bg-emerald-300' : isComplete ? 'bg-emerald-300' : 'bg-white/25'}`} /></div>
        {visibleLines ? <div className="mt-5 space-y-2">{demoTranscript.slice(0, visibleLines).map((line, index) => <div key={`${line.speaker}-${index}`} className={`rounded-2xl px-3 py-2.5 text-sm leading-5 ${line.speaker === 'JourneyOS' ? 'mr-7 bg-white/10' : 'ml-7 bg-violet-100 text-ink'}`}><b className={line.speaker === 'JourneyOS' ? 'text-violet-200' : 'text-violet-800'}>{line.speaker}:</b> {line.text}</div>)}</div> : <div className="mt-6 rounded-2xl border border-white/10 p-4 text-sm leading-6 text-white/65"><Phone className="mb-3 text-violet-200" size={20} />The traveler hears a short, private interview—not a four-person conference call. The mediator asks for non-negotiables and one acceptable trade.</div>}
        {isComplete && <div className="mt-5 space-y-3"><div className="rounded-2xl bg-white/10 p-4"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-200"><Check size={15} />Conflict detected</p><p className="mt-2 text-sm leading-6">Prabhu wants street-food nightlife; Deepu needs a vegetarian-friendly, quieter evening.</p></div><div className="rounded-2xl bg-violet-100 p-4 text-ink"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-violet-800"><Sparkles size={15} />Fair trade proposed</p><p className="mt-2 text-sm leading-6">Move the shared food-market experience earlier, guarantee vegetarian options, and make the late-night stop optional.</p></div><div className="grid gap-2 sm:grid-cols-2"><div className="rounded-2xl bg-white/10 p-3"><p className="text-[10px] uppercase tracking-wide text-white/50">Priorities protected</p><p className="mt-1 text-lg font-bold">{friends.length} of {friends.length} friends</p></div><div className="rounded-2xl bg-white/10 p-3"><p className="text-[10px] uppercase tracking-wide text-white/50">Admin status</p><p className="mt-1 flex items-center gap-2 text-lg font-bold text-emerald-200"><ShieldCheck size={18} />Review ready</p></div></div></div>}
      </div>
    </div>

    {isComplete && <div className="mt-5 flex flex-col justify-between gap-3 rounded-2xl border border-moss/20 bg-[#eff6f1] p-4 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><UsersRound className="mt-0.5 text-moss" size={20} /><div><p className="text-sm font-bold text-ink">One plan, with every trade visible.</p><p className="mt-1 text-xs leading-5 text-stone-600">Decision Studio below lets the admin edit the priority balance before the itinerary changes.</p></div></div><span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-bold text-moss"><CheckCircle2 size={16} />Ready for admin review</span></div>}
  </section>;
}
