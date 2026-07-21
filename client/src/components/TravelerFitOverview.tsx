import { HeartHandshake, Sparkles } from 'lucide-react';
import type { Interest, Trip } from '../types';
import { SARAH_PROFILE, isSarahProfile } from '../constants/demo-profiles';

const interests: Interest[] = ['culture', 'history', 'food', 'photography', 'shopping', 'nightlife', 'nature'];
const mood = (score?: number) => score === undefined
  ? { expression: 'learning', label: 'Still learning', tone: 'bg-stone-100 text-stone-600' }
  : score >= 88
    ? { expression: 'delighted', label: 'Delighted', tone: 'bg-emerald-100 text-emerald-800' }
    : score >= 78
      ? { expression: 'good', label: 'Feels good', tone: 'bg-lime-100 text-lime-800' }
      : score >= 68
        ? { expression: 'balanced', label: 'Balanced', tone: 'bg-amber-100 text-amber-800' }
        : { expression: 'trade', label: 'Needs a trade', tone: 'bg-rose-100 text-rose-800' };

function MoodFace({ expression, small = false }: { expression: string; small?: boolean }) {
  return <span aria-hidden="true" className={`mood-face mood-face--${expression} ${small ? 'mood-face--small' : ''}`}><span className="mood-face__eye mood-face__eye--left" /><span className="mood-face__eye mood-face__eye--right" /><span className="mood-face__mouth" /></span>;
}

export function TravelerFitOverview({ trip }: { trip: Trip }) {
  const calls = new Map((trip.preferenceCollection?.calls ?? []).map((call) => [call.travelerId, call]));
  const groupMood = mood(trip.groupPreference.groupHappiness);
  const formatSummary = (traveler: Trip['travelers'][number], callSummary?: string) => traveler.preferences?.summary ?? callSummary ?? `${traveler.pacePreference} pace · ${traveler.foodPreference}`;
  const formatPriorities = (traveler: Trip['travelers'][number], callPriorities?: string[]) => traveler.preferences?.priorities ?? callPriorities ?? [];
  const formatAvoids = (traveler: Trip['travelers'][number]) => traveler.preferences?.avoidances ?? [];
  return <section className="overflow-hidden rounded-[30px] border border-stone-200 bg-white">
    <div className="grid gap-5 bg-gradient-to-br from-[#eff6f1] via-white to-[#fff2ed] p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"><div className="min-w-0"><p className="eyebrow text-moss">Group vibe</p><h2 className="mt-1 text-2xl font-bold text-ink">Does this plan feel good for everyone?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">A human-readable snapshot of protected priorities, pace, food needs, and the compromises people accepted.</p></div><div className={`flex min-w-0 max-w-full items-center gap-3 rounded-3xl px-4 py-4 sm:gap-4 sm:px-5 ${groupMood.tone}`}><MoodFace expression={groupMood.expression} /><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider">{groupMood.label}</p><p className="mt-1 truncate text-xl font-bold sm:text-2xl">{trip.groupPreference.groupHappiness === undefined ? 'Learning' : `${trip.groupPreference.groupHappiness}% group fit`}</p>{trip.groupPreference.fairnessGap !== undefined && <p className="mt-1 text-xs opacity-75">Only {trip.groupPreference.fairnessGap} points between highest and lowest fit</p>}</div></div></div>
    <div className="grid gap-3 p-5 sm:p-7 lg:grid-cols-2">{trip.travelers.map((traveler, index) => {
      const call = calls.get(traveler.id);
      const isAdmin = index === 0;
      const briefCaptured = isAdmin || traveler.status === 'preferences_ready' || traveler.status === 'negotiation_complete';
      const top = formatPriorities(traveler, call?.topPriorities).length ? formatPriorities(traveler, call?.topPriorities) : interests.slice().sort((left, right) => traveler.interests[right] - traveler.interests[left]).slice(0, 3);
      const avoids = formatAvoids(traveler).length ? formatAvoids(traveler) : interests.slice().sort((left, right) => traveler.interests[left] - traveler.interests[right]).slice(0, 1);
      const personMood = mood(traveler.preferences?.matchPercentage ?? call?.happiness ?? (briefCaptured ? 82 : undefined));
      const profileLine = traveler.preferences?.summary ? `${traveler.pacePreference} pace · ${traveler.foodPreference}` : `${traveler.pacePreference} pace · ${traveler.foodPreference}`;
      const status = traveler.status === 'calling' || call?.status === 'dialing'
        ? 'Call in progress'
        : traveler.status === 'negotiation_complete'
          ? 'Negotiation complete'
          : traveler.status === 'admin_review_needed'
            ? 'Admin review needed'
            : briefCaptured
              ? isAdmin ? 'Trip brief captured' : 'Preferences captured'
              : call?.status === 'completed'
                ? 'Call result captured'
                : 'Ready to call';
      const explanation = traveler.preferences?.summary ? `${traveler.preferences.summary} ${traveler.preferences.recommendation ?? ''}` : isAdmin ? 'Captured from the admin’s live trip brief.' : call?.happinessExplanation || call?.compromise;
      return <article key={traveler.id} className="rounded-3xl border border-stone-200 bg-[#fafbf9] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-ink text-xs font-bold text-white">{traveler.initials}</span><div><p className="font-bold text-ink">{traveler.name}</p><p className="text-xs capitalize text-stone-500">{profileLine}</p></div></div><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${personMood.tone}`}><MoodFace expression={personMood.expression} small />{status}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><p className="text-[10px] font-bold uppercase tracking-wider text-moss">Would love</p><div className="mt-2 flex flex-wrap gap-1.5">{top.map((interest) => <span key={interest} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold capitalize text-moss">{interest}</span>)}</div></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-coral">Keep light</p><div className="mt-2 flex flex-wrap gap-1.5">{avoids.map((interest) => <span key={interest} className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold capitalize text-coral">{interest}</span>)}</div></div></div>{explanation ? <div className="mt-4 rounded-2xl bg-white p-3 text-xs leading-5 text-stone-600 ring-1 ring-stone-100"><b className="text-ink">Why this works:</b> {explanation}</div> : <p className="mt-4 text-xs leading-5 text-stone-500">The live caller’s actual call outcome and accepted trade will appear here after the negotiation.</p>}</article>;
    })}</div>
    <div className="mx-5 mb-5 flex flex-col gap-3 rounded-2xl bg-ink p-4 text-white sm:mx-7 sm:mb-7 sm:flex-row sm:items-center"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10"><HeartHandshake className="text-emerald-200" size={20} /></span><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-emerald-200">The fair trade</p><p className="mt-1 text-sm leading-6 text-white/75">{trip.groupPreference.explanation}</p></div><Sparkles className="ml-auto hidden shrink-0 text-amber-200 sm:block" /></div>
  </section>;
}
