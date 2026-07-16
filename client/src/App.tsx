import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, BatteryLow, Bot, CalendarDays, Camera, Check, CheckCircle2, ChevronRight,
  CircleOff, CloudRain, CreditCard, Footprints, Headphones, Hotel as HotelIcon, Landmark,
  Map, MapPinned, Mic, Plane, PlaneLanding, Route, ScanLine, Sparkles, TrainFront,
  Phone, Utensils, WalletCards, Zap,
} from 'lucide-react';
import { api } from './api';
import type { ItineraryItem, ItemCategory, PaymentOrder, ReplanType, Trip } from './types';

type Page = 'home' | 'planner' | 'map' | 'operations' | 'checkout';

const nav: { id: Page; label: string; icon: typeof Map }[] = [
  { id: 'home', label: 'Trip dashboard', icon: Map },
  { id: 'planner', label: 'Voice planner', icon: Mic },
  { id: 'map', label: 'Journey map', icon: Route },
  { id: 'operations', label: 'Operations center', icon: Zap },
  { id: 'checkout', label: 'Booking & checkout', icon: CreditCard },
];

const categoryMeta: Record<ItemCategory, { icon: typeof Landmark; label: string; color: string }> = {
  stay: { icon: HotelIcon, label: 'Stay', color: 'bg-teal-50 text-teal-700 ring-teal-200' },
  culture: { icon: Landmark, label: 'Culture', color: 'bg-orange-50 text-orange-700 ring-orange-200' },
  food: { icon: Utensils, label: 'Food', color: 'bg-rose-50 text-rose-700 ring-rose-200' },
  transport: { icon: TrainFront, label: 'Transit', color: 'bg-sky-50 text-sky-700 ring-sky-200' },
  nature: { icon: Footprints, label: 'Outdoors', color: 'bg-lime-50 text-lime-700 ring-lime-200' },
  museum: { icon: Landmark, label: 'Museum', color: 'bg-violet-50 text-violet-700 ring-violet-200' },
  experience: { icon: Sparkles, label: 'Experience', color: 'bg-amber-50 text-amber-700 ring-amber-200' },
};

const eventMeta: { type: ReplanType; label: string; icon: typeof Zap; className: string }[] = [
  { type: 'late', label: 'Running late +90m', icon: Zap, className: 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200' },
  { type: 'rain', label: 'Heavy rain', icon: CloudRain, className: 'bg-sky-50 text-sky-800 hover:bg-sky-100 border-sky-200' },
  { type: 'flight-delay', label: 'Flight delay', icon: PlaneLanding, className: 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border-indigo-200' },
  { type: 'closed', label: 'Attraction closed', icon: CircleOff, className: 'bg-rose-50 text-rose-800 hover:bg-rose-100 border-rose-200' },
  { type: 'tired', label: 'Traveler tired', icon: BatteryLow, className: 'bg-teal-50 text-teal-800 hover:bg-teal-100 border-teal-200' },
];

function money(value: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value); }

function IconBadge({ category }: { category: ItemCategory }) {
  const { icon: Icon, color } = categoryMeta[category];
  return <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${color}`}><Icon size={17} /></span>;
}

function StarRow({ value }: { value: number }) {
  return <span className="tracking-[0.08em] text-[13px] text-coral" aria-label={`${value} out of 5`}>{'★'.repeat(Math.round(value))}<span className="text-stone-300">{'★'.repeat(5 - Math.round(value))}</span></span>;
}

function DayPills({ trip, activeDay, setActiveDay }: { trip: Trip; activeDay: number; setActiveDay: (day: number) => void }) {
  return <div className="flex flex-wrap gap-2">
    {Array.from({ length: trip.request.duration }, (_, index) => index + 1).map((day) => (
      <button key={day} onClick={() => setActiveDay(day)} className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${activeDay === day ? 'bg-ink text-white shadow-md shadow-ink/20' : 'bg-white text-stone-500 ring-1 ring-stone-200 hover:text-ink'}`}>Day {day}</button>
    ))}
  </div>;
}

function RouteMap({ trip, activeDay, onSelect }: { trip: Trip; activeDay: number; onSelect: (item: ItineraryItem) => void }) {
  const allItems = trip.itinerary.filter((item) => item.day === activeDay);
  const points = allItems.map((item) => `${item.location.x},${item.location.y}`).join(' ');
  if (import.meta.env.VITE_GOOGLE_MAPS_API_KEY) return <LiveGoogleMap trip={trip} activeDay={activeDay} />;
  return <><div className="paper-grid relative min-h-[360px] overflow-hidden rounded-[28px] border border-[#d9ded8] bg-[#e9f0ec]">
    <div className="absolute -left-10 top-7 h-48 w-72 rotate-[-10deg] rounded-[50%] bg-[#c4d8c8] opacity-65" />
    <div className="absolute -right-16 bottom-0 h-72 w-80 rotate-[20deg] rounded-[45%] bg-[#c6d9c6] opacity-70" />
    <div className="absolute left-[11%] top-[19%] h-[2px] w-[79%] rotate-[12deg] bg-white/70" />
    <div className="absolute left-[3%] top-[66%] h-[2px] w-[86%] rotate-[-21deg] bg-white/70" />
    <span className="absolute left-5 top-5 rounded-full bg-white/75 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-moss">Japan journey route</span>
    <span className="absolute bottom-5 left-5 text-xs font-semibold tracking-wide text-moss/70">TOKYO → KYOTO</span>
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`Optimized itinerary path for day ${activeDay}`}>
      <polyline points={points} fill="none" stroke="#245B4F" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2.2 1.6" className="animate-pulseRoute" />
    </svg>
    {allItems.map((item, index) => {
      const meta = categoryMeta[item.category];
      return <button onClick={() => onSelect(item)} key={item.id} style={{ left: `${item.location.x}%`, top: `${item.location.y}%` }} className={`group absolute -translate-x-1/2 -translate-y-1/2 text-left transition hover:scale-110 ${item.status === 'moved' ? 'animate-pulse' : ''}`}>
        <span className={`grid h-9 w-9 place-items-center rounded-full border-4 border-white shadow-lg ${item.status === 'current' ? 'bg-coral text-white' : 'bg-moss text-white'}`}><span className="text-xs font-bold">{index + 1}</span></span>
        <span className="pointer-events-none absolute left-5 top-1/2 hidden w-32 -translate-y-1/2 rounded-lg bg-ink px-2.5 py-2 text-[10px] font-semibold leading-tight text-white shadow-xl group-hover:block"><span className="block text-white/60">{meta.label} · {item.time}</span>{item.title}</span>
      </button>;
    })}
  </div><LiveGoogleMap trip={trip} activeDay={activeDay} /></>;
}

function LiveGoogleMap({ trip, activeDay }: { trip: Trip; activeDay: number }) {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (!key || key.includes('PASTE_YOUR') || key.includes('your_key')) return null;
  const stops = trip.itinerary.filter((item) => item.day === activeDay);
  const locations = stops.map((item) => `${item.title}, ${trip.request.destination}`);
  const origin = locations[0] ?? trip.request.destination;
  const destination = locations[locations.length - 1] ?? trip.request.destination;
  const waypoints = locations.slice(1, -1).join('|');
  const src = `https://www.google.com/maps/embed/v1/directions?key=${encodeURIComponent(key)}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&mode=transit`;
  const mapsUrl = `https://www.google.com/maps/dir/${locations.map(encodeURIComponent).join('/')}`;
  return <section className="overflow-hidden rounded-[28px] border border-stone-200 bg-white"><div className="flex items-center justify-between gap-3 px-5 py-4"><div><p className="eyebrow">Interactive day route</p><h3 className="mt-1 text-lg font-bold text-ink">Day {activeDay} · {trip.request.destination}</h3></div><a href={mapsUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-moss hover:text-ink">Open full map ↗</a></div><iframe title={`Google Maps itinerary for day ${activeDay} in ${trip.request.destination}`} src={src} className="h-80 w-full border-0" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></section>;
}

function Timeline({ items, compact = false }: { items: ItineraryItem[]; compact?: boolean }) {
  return <div className={`relative ${compact ? 'space-y-3' : 'space-y-1'}`}>
    <div className="absolute bottom-4 left-[1.15rem] top-4 w-px bg-stone-200" />
    {items.map((item) => <div className="relative flex gap-3 py-2" key={item.id}>
      <div className="w-10 pt-2 text-right text-[11px] font-bold text-stone-400">{item.time}</div>
      <div className={`relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-full ring-4 ${item.status === 'completed' ? 'bg-moss ring-emerald-100' : item.status === 'current' ? 'bg-coral ring-orange-100' : item.status === 'moved' ? 'bg-amber-400 ring-amber-100' : 'bg-white ring-stone-200'}`} />
      <div className={`min-w-0 flex-1 rounded-2xl px-3 py-2.5 ${item.status === 'current' ? 'bg-[#fff2ed] ring-1 ring-orange-100' : item.status === 'moved' ? 'bg-amber-50 ring-1 ring-amber-100' : 'hover:bg-stone-50'}`}>
        <div className="flex items-center gap-2"><IconBadge category={item.category} /><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-bold text-ink">{item.title}</p>{item.status === 'moved' && <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">Updated</span>}</div><p className="truncate text-xs text-stone-500">{item.subtitle} · {item.durationMins} min</p></div></div>
      </div>
    </div>)}
  </div>;
}

function TripOverview({ trip, setPage, activeDay, setActiveDay, onReceipt }: { trip: Trip; setPage: (page: Page) => void; activeDay: number; setActiveDay: (day: number) => void; onReceipt: () => void }) {
  const dayItems = trip.itinerary.filter((item) => item.day === activeDay);
  const budgetPercent = Math.min(100, (trip.budget.spent / trip.budget.total) * 100);
  return <div className="space-y-6">
    <section className="relative overflow-hidden rounded-[32px] bg-ink px-7 py-8 text-white shadow-glow sm:px-10">
      <div className="relative z-10 max-w-xl"><div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-100"><span className="h-2 w-2 rounded-full bg-[#8fe0b7]" /> Live trip command center</div><h1 className="font-display text-4xl leading-none sm:text-5xl">{trip.name}</h1><p className="mt-4 max-w-md text-sm leading-6 text-white/70">One conversation turned into a route built around every person, with the room to change when travel does.</p><div className="mt-7 flex flex-wrap gap-3"><button onClick={() => setPage('map')} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-bold text-ink transition hover:bg-emerald-50"><MapPinned size={15} /> Explore the route</button><button onClick={() => setPage('operations')} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/10"><Zap size={15} /> Test a disruption</button></div></div>
      <div className="absolute -right-9 -top-10 h-52 w-52 rounded-full border-[22px] border-emerald-300/15" /><div className="absolute bottom-[-72px] right-24 h-48 w-48 rounded-full bg-coral/90 blur-[2px]" /><div className="absolute bottom-14 right-12 h-8 w-8 rounded-full bg-amber-200 animate-drift" />
    </section>
    <section className="grid gap-4 xl:grid-cols-[1.45fr_0.9fr]">
      <div className="rounded-[28px] border border-stone-200 bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="eyebrow">Today · Day {activeDay}</p><h2 className="mt-1 text-xl font-bold text-ink">The route has a little magic in it.</h2></div><DayPills trip={trip} activeDay={activeDay} setActiveDay={setActiveDay} /></div><div className="mt-5"><Timeline items={dayItems} /></div></div>
      <div className="rounded-[28px] border border-stone-200 bg-[#fafbf9] p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="eyebrow">Live route</p><h2 className="mt-1 text-xl font-bold text-ink">Less backtracking.</h2></div><button onClick={() => setPage('map')} aria-label="Open full journey map" className="grid h-9 w-9 place-items-center rounded-xl bg-moss text-white"><ArrowRight size={17} /></button></div><div className="mt-5"><RouteMap trip={trip} activeDay={activeDay} onSelect={() => setPage('map')} /></div><div className="mt-4 flex items-center justify-between text-xs text-stone-500"><span>{dayItems.reduce((sum, item) => sum + item.travelMins, 0)} min transit</span><span className="font-bold text-moss">Optimized for daylight</span></div></div>
    </section>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-3xl border border-stone-200 bg-white p-5"><div className="flex items-center justify-between"><span className="text-sm font-bold text-ink">Trip progress</span><CheckCircle2 className="text-moss" size={19} /></div><p className="mt-4 text-3xl font-bold text-ink">{trip.progress}%</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-moss" style={{ width: `${trip.progress}%` }} /></div><p className="mt-3 text-xs text-stone-500">3 moments complete · 9 ahead</p></article>
      <article className="rounded-3xl border border-stone-200 bg-white p-5"><div className="flex items-center justify-between"><span className="text-sm font-bold text-ink">Trip budget</span><WalletCards className="text-coral" size={19} /></div><p className="mt-4 text-3xl font-bold text-ink">{money(trip.budget.remaining)}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-coral" style={{ width: `${budgetPercent}%` }} /></div><p className="mt-3 text-xs text-stone-500">{money(trip.budget.spent)} planned of {money(trip.budget.total)}</p></article>
      <article className="rounded-3xl border border-stone-200 bg-white p-5"><div className="flex items-center justify-between"><span className="text-sm font-bold text-ink">Weather aware</span><CloudRain className="text-sky-500" size={19} /></div><p className="mt-4 text-2xl font-bold text-ink">24° · Clear</p><p className="mt-3 text-xs leading-5 text-stone-500">Tomorrow’s outdoor windows are safely held.</p></article>
      <button onClick={onReceipt} className="group rounded-3xl border border-dashed border-moss/40 bg-[#eff6f1] p-5 text-left transition hover:border-moss hover:bg-[#e8f2eb]"><div className="flex items-center justify-between"><span className="text-sm font-bold text-ink">Receipt AI</span><ScanLine className="text-moss" size={19} /></div><p className="mt-4 text-base font-bold text-ink">Scan Sushi Dai receipt</p><p className="mt-2 text-xs leading-5 text-stone-500">Adds a sample $120 dinner to your live budget.</p></button>
    </section>
  </div>;
}

function VoicePlanner({ trip, onTrip }: { trip: Trip; onTrip: (trip: Trip, note: string) => void }) {
  const sampleVoiceCommand = 'Plan a 5-day Japan trip for four people under $6,000. We love temples, food, history, and photography.';
  const [conversation, setConversation] = useState(sampleVoiceCommand);
  const [listening, setListening] = useState(false);
  const [speechStatus, setSpeechStatus] = useState('Tap the microphone and allow access when your browser asks.');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ confidence: number; source: string; summary: string } | null>(null);
  const [adminName, setAdminName] = useState('Aya');
  const [adminPhone, setAdminPhone] = useState('+1 (415) 555-0101');
  const [phones, setPhones] = useState<Record<string, string>>({ 't-marcus': '+1 (415) 555-0148', 't-leila': '+1 (415) 555-0172', 't-jon': '+1 (415) 555-0196' });
  const [collecting, setCollecting] = useState(false);
  const [reviewTab, setReviewTab] = useState<'plan' | 'people'>('plan');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mockVoiceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const startListening = () => {
    if (listening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (mockVoiceTimeoutRef.current) {
        clearTimeout(mockVoiceTimeoutRef.current);
        mockVoiceTimeoutRef.current = null;
        setListening(false);
        setSpeechStatus('Mock voice capture stopped. Tap again whenever you are ready.');
      }
      return;
    }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setConversation('');
      setListening(true);
      setSpeechStatus('This preview has no microphone API, so JourneyOS is simulating a voice command…');
      mockVoiceTimeoutRef.current = setTimeout(() => {
        setConversation(sampleVoiceCommand);
        setListening(false);
        setSpeechStatus('Mock voice captured. Review the transcript, then create the trip brief.');
        mockVoiceTimeoutRef.current = null;
      }, 900);
      return;
    }
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setConversation('');
      setListening(true);
      setSpeechStatus('Listening now — describe the trip in one natural sentence.');
    };
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = 0; index < event.results.length; index += 1) transcript += event.results[index][0]?.transcript ?? '';
      setConversation(transcript.trim());
      setSpeechStatus(event.results[event.results.length - 1]?.isFinal ? 'Voice captured. Review the transcript, then create the trip brief.' : 'Transcribing…');
    };
    recognition.onerror = (event) => {
      const messages: Record<string, string> = {
        'not-allowed': 'Microphone access was blocked. Allow it in the browser’s site settings and try again.',
        'no-speech': 'No speech was detected. Try again and speak after the microphone turns coral.',
        network: 'The browser speech service could not be reached. You can still type the request.',
      };
      setSpeechStatus(messages[event.error] ?? `Voice recognition stopped: ${event.error}.`);
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setSpeechStatus('The browser could not start voice capture. Check microphone permission, then try again.');
    }
  };
  useEffect(() => () => {
    recognitionRef.current?.abort();
    if (mockVoiceTimeoutRef.current) clearTimeout(mockVoiceTimeoutRef.current);
  }, []);
  const createPlan = async () => {
    setLoading(true);
    try {
      const response = await api.extractPlan(conversation);
      setResult(response);
      onTrip(response.trip, 'Voice brief structured into a living trip plan.');
    } catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not extract that trip request.'); }
    finally { setLoading(false); }
  };
  const collectPreferences = async () => {
    setCollecting(true);
    try {
      const response = await api.collectPreferences(adminName, adminPhone, phones);
      onTrip(response.trip, `${response.collection.calls.length} preference calls completed. The admin-led plan is ready for review.`);
      setReviewTab('plan');
    } catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not collect group preferences.'); }
    finally { setCollecting(false); }
  };
  const extracted = result ? trip.request : trip.request;
  return <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
    <section className="relative overflow-hidden rounded-[32px] bg-[#eff6f1] px-6 py-8 sm:px-10"><div className="relative z-10"><p className="eyebrow text-moss">Live voice capture</p><h1 className="mt-2 font-display text-4xl leading-[0.95] text-ink sm:text-5xl">Tell us where the story goes.</h1><p className="mt-4 max-w-md text-sm leading-6 text-stone-600">Speak naturally. JourneyOS turns a loose travel wish into a structured brief your whole group can review.</p><div className="mt-8 flex flex-col items-center"><button type="button" onClick={startListening} aria-pressed={listening} aria-label={listening ? 'Stop listening' : speechSupported ? 'Start voice capture' : 'Run mock voice capture'} className={`grid h-36 w-36 place-items-center rounded-full border-[10px] border-white shadow-xl transition ${listening ? 'bg-coral text-white animate-pulse' : 'bg-moss text-white hover:scale-105'}`}><Mic size={42} /></button><p className="mt-4 text-sm font-bold text-ink">{listening ? 'Listening… tap to stop' : speechSupported ? 'Tap to start a voice brief' : 'Run a mock voice command'}</p><p className={`mt-2 max-w-sm text-center text-xs leading-5 ${speechSupported ? 'text-stone-500' : 'font-semibold text-coral'}`}>{speechStatus}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-moss/60">{speechSupported ? 'Browser speech recognition · Vocal Bridge ready' : 'Mock voice fallback · microphone API unavailable here'}</p></div></div><div className="absolute -bottom-12 -right-12 h-60 w-60 rounded-full border-[24px] border-[#d3e8d8]" /></section>
    <section className="rounded-[32px] border border-stone-200 bg-white p-6 sm:p-8"><div className="flex items-center justify-between"><div><p className="eyebrow">Conversation transcript</p><h2 className="mt-1 text-xl font-bold text-ink">Your travel brief</h2></div><Headphones className="text-moss" /></div><label className="sr-only" htmlFor="trip-conversation">Trip request</label><textarea id="trip-conversation" value={conversation} onChange={(event) => setConversation(event.target.value)} className="mt-5 min-h-36 w-full resize-none rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-ink outline-none transition focus:border-moss focus:ring-4 focus:ring-moss/10" /><button onClick={() => void createPlan()} disabled={loading} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3.5 text-sm font-bold text-white transition hover:bg-moss disabled:cursor-wait disabled:opacity-70"><Sparkles size={17} />{loading ? 'Understanding your trip…' : 'Create my trip brief'}</button>{result && <p className="mt-3 text-center text-xs font-semibold text-moss">{result.source === 'mock' ? 'Demo extraction' : 'Vocal Bridge extraction'} · {Math.round(result.confidence * 100)}% confidence</p>}</section>
    <section className="rounded-[32px] border border-stone-200 bg-white p-6 xl:col-span-2"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Structured output</p><h2 className="mt-1 text-xl font-bold text-ink">The AI heard the important things.</h2></div><span className="rounded-full bg-[#eff6f1] px-3 py-1.5 text-xs font-bold text-moss">{extracted.travelStyle}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="soft-stat"><span>Destination</span><strong>{extracted.destination}</strong></div><div className="soft-stat"><span>Time together</span><strong>{extracted.duration} days</strong></div><div className="soft-stat"><span>Group size</span><strong>{extracted.travelers} travelers</strong></div><div className="soft-stat"><span>Shared budget</span><strong>{money(extracted.budget)}</strong></div></div><div className="mt-5 flex flex-wrap gap-2">{extracted.interests.map((interest) => <span className="rounded-full bg-sand px-3 py-1.5 text-xs font-bold capitalize text-ink" key={interest}>{interest}</span>)}{extracted.foodPreferences.map((food) => <span className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700" key={food}>{food}</span>)}</div></section>
    <section className="rounded-[32px] border border-moss/20 bg-[#f6fbf7] p-6 xl:col-span-2"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-moss">Group preference calls</p><h2 className="mt-1 text-2xl font-bold text-ink">Ask the group, then negotiate the plan.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">JourneyOS gives the trip admin a 1.5× planning weight, then calls each traveler to collect constraints, priorities, and a compromise they can live with.</p></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-moss ring-1 ring-moss/15">Admin priority · 1.5×</span></div><div className="mt-6 grid gap-4 lg:grid-cols-4"><label className="rounded-2xl bg-white p-4 ring-1 ring-moss/10"><span className="text-xs font-bold text-stone-500">Trip admin</span><input value={adminName} onChange={(event) => setAdminName(event.target.value)} className="mt-2 w-full bg-transparent text-sm font-bold text-ink outline-none" /></label><label className="rounded-2xl bg-white p-4 ring-1 ring-moss/10"><span className="text-xs font-bold text-stone-500">Admin phone</span><input value={adminPhone} onChange={(event) => setAdminPhone(event.target.value)} className="mt-2 w-full bg-transparent text-sm font-bold text-ink outline-none" /></label>{trip.travelers.filter((traveler) => traveler.name !== adminName).map((traveler) => <label className="rounded-2xl bg-white p-4 ring-1 ring-moss/10" key={traveler.id}><span className="text-xs font-bold text-stone-500">{traveler.name}'s phone</span><input value={phones[traveler.id] ?? ''} onChange={(event) => setPhones((current) => ({ ...current, [traveler.id]: event.target.value }))} className="mt-2 w-full bg-transparent text-sm font-bold text-ink outline-none" /></label>)}</div><button onClick={() => void collectPreferences()} disabled={collecting} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-moss px-4 py-3.5 text-sm font-bold text-white transition hover:bg-ink disabled:cursor-wait disabled:opacity-70"><Phone size={17} />{collecting ? 'Calling travelers and negotiating…' : 'Collect preferences'}</button><p className="mt-3 text-center text-xs leading-5 text-stone-500">Demo mode simulates consented preference calls. With Vocal Bridge credentials configured, this action sends the listed phone numbers to its call workflow.</p></section>
    {trip.preferenceCollection && <section className="rounded-[32px] border border-stone-200 bg-white p-6 xl:col-span-2"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="eyebrow">Admin review</p><h2 className="mt-1 text-2xl font-bold text-ink">Ready for {trip.preferenceCollection.adminName}'s decision.</h2></div><div className="flex rounded-xl bg-stone-100 p-1"><button onClick={() => setReviewTab('plan')} className={`rounded-lg px-3 py-2 text-xs font-bold ${reviewTab === 'plan' ? 'bg-white text-ink shadow-sm' : 'text-stone-500'}`}>Negotiated plan</button><button onClick={() => setReviewTab('people')} className={`rounded-lg px-3 py-2 text-xs font-bold ${reviewTab === 'people' ? 'bg-white text-ink shadow-sm' : 'text-stone-500'}`}>People & happiness</button></div></div>{reviewTab === 'plan' ? <div className="mt-5 rounded-2xl bg-[#fff8e9] p-5"><p className="text-sm font-bold text-ink">{trip.preferenceCollection.approvalSummary}</p><p className="mt-3 border-l-2 border-coral pl-4 text-sm leading-6 text-stone-600">{trip.preferenceCollection.negotiation}</p><div className="mt-4 flex items-center gap-2 text-xs font-bold text-moss"><CheckCircle2 size={16} /> {trip.preferenceCollection.source === 'mock' ? 'Simulated Vocal Bridge conversations complete' : 'Vocal Bridge conversations complete'}</div></div> : <div className="mt-5 grid gap-3 md:grid-cols-3">{trip.preferenceCollection.calls.map((call) => <article className="rounded-2xl bg-[#fafbf9] p-4" key={call.travelerId}><div className="flex items-center justify-between"><p className="font-bold text-ink">{call.name}</p><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-moss">{call.happiness}% happy</span></div><p className="mt-3 text-xs leading-5 text-stone-600">{call.summary}</p><p className="mt-3 text-xs font-semibold text-ink">Compromise: <span className="font-medium text-stone-600">{call.compromise}</span></p></article>)}</div>}</section>}
  </div>;
}

function TravelerProfiles({ trip }: { trip: Trip }) {
  const ranked = Object.entries(trip.groupPreference.interestScores).sort((a, b) => b[1] - a[1]);
  return <section className="rounded-[30px] border border-stone-200 bg-white p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Travel DNA · group model</p><h2 className="mt-1 text-xl font-bold text-ink">Everyone has a place in the plan.</h2></div><span className="rounded-full bg-[#eff6f1] px-3 py-1.5 text-xs font-bold text-moss">{trip.groupPreference.recommendedPace}</span></div><div className="mt-5 grid gap-3 lg:grid-cols-4">{trip.travelers.map((traveler) => <article key={traveler.id} className="rounded-2xl bg-[#fafbf9] p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-xs font-bold text-white">{traveler.initials}</span><div><p className="font-bold text-ink">{traveler.name}</p><p className="text-[11px] capitalize text-stone-500">{traveler.pacePreference} pace · {traveler.foodPreference}</p></div></div><div className="mt-4 space-y-1.5">{Object.entries(traveler.interests).sort(([, a], [, b]) => b - a).slice(0, 3).map(([name, value]) => <div className="flex items-center justify-between text-xs" key={name}><span className="capitalize text-stone-600">{name}</span><StarRow value={value} /></div>)}</div></article>)}</div><div className="mt-5 flex flex-col gap-3 rounded-2xl bg-[#fff8e9] p-4 sm:flex-row sm:items-center"><Bot className="shrink-0 text-coral" /><p className="text-sm leading-6 text-ink"><span className="font-bold">Why this route?</span> {trip.groupPreference.explanation}</p></div><div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">{ranked.slice(0, 5).map(([interest, score]) => <div className="flex items-center gap-2" key={interest}><span className="capitalize text-xs font-semibold text-stone-600">{interest}</span><div className="h-1.5 w-16 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-moss" style={{ width: `${Number(score) * 20}%` }} /></div></div>)}</div></section>;
}

function JourneyMap({ trip, activeDay, setActiveDay }: { trip: Trip; activeDay: number; setActiveDay: (day: number) => void }) {
  const [selected, setSelected] = useState<ItineraryItem | null>(trip.itinerary.find((item) => item.day === activeDay) ?? null);
  const dayItems = trip.itinerary.filter((item) => item.day === activeDay);
  useEffect(() => { setSelected(trip.itinerary.find((item) => item.day === activeDay) ?? null); }, [activeDay, trip.itinerary]);
  return <div className="space-y-6"><section className="flex flex-col justify-between gap-4 rounded-[32px] bg-ink px-7 py-7 text-white sm:flex-row sm:items-end"><div><p className="eyebrow text-emerald-200">Route intelligence</p><h1 className="mt-1 font-display text-4xl">The journey, in motion.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-white/65">Stops are ordered by distance, reservation time, opening hours, and how much of the day you want to spend walking.</p></div><div className="flex items-center gap-2 text-xs font-semibold text-white/80"><span className="h-2 w-2 rounded-full bg-[#8fe0b7] animate-pulse" /> Route is live</div></section><section className="grid gap-5 xl:grid-cols-[1fr_320px]"><div><DayPills trip={trip} activeDay={activeDay} setActiveDay={setActiveDay} /><div className="mt-4"><RouteMap trip={trip} activeDay={activeDay} onSelect={setSelected} /></div></div><aside className="rounded-[28px] border border-stone-200 bg-white p-5"><p className="eyebrow">Selected stop</p>{selected ? <><div className="mt-4 flex items-start gap-3"><IconBadge category={selected.category} /><div><h2 className="font-bold text-ink">{selected.title}</h2><p className="mt-1 text-sm text-stone-500">{selected.subtitle}</p></div></div><div className="mt-6 space-y-3 border-y border-stone-100 py-5"><div className="flex justify-between text-sm"><span className="text-stone-500">Arrive</span><b className="text-ink">{selected.time}</b></div><div className="flex justify-between text-sm"><span className="text-stone-500">Time here</span><b className="text-ink">{selected.durationMins} minutes</b></div><div className="flex justify-between text-sm"><span className="text-stone-500">Transit buffer</span><b className="text-ink">{selected.travelMins} minutes</b></div><div className="flex justify-between text-sm"><span className="text-stone-500">Opening window</span><b className="text-ink">{selected.openingHours}</b></div></div><p className="mt-5 text-xs leading-5 text-stone-500">This stop is positioned to avoid retracing the group’s route and preserve your next reservation.</p></> : <p className="mt-4 text-sm text-stone-500">Select a route marker.</p>}</aside></section><section className="rounded-[28px] border border-stone-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Day {activeDay} timeline</p><h2 className="mt-1 text-xl font-bold text-ink">Optimized sequence</h2></div><span className="text-xs font-bold text-moss">{dayItems.reduce((sum, item) => sum + item.travelMins, 0)} min transit · {dayItems.reduce((sum, item) => sum + item.durationMins, 0)} min experiences</span></div><div className="mt-4"><Timeline items={dayItems} compact /></div></section></div>;
}

function OperationsCenter({ trip, onTrip }: { trip: Trip; onTrip: (trip: Trip, note: string) => void }) {
  const [running, setRunning] = useState<ReplanType | null>(null);
  const [explanation, setExplanation] = useState(trip.events[0]?.explanation ?? 'Every demo event recalculates the itinerary, then explains the trade-off in plain language.');
  const trigger = async (type: ReplanType) => { setRunning(type); try { const response = await api.replan(type); setExplanation(response.event.explanation); onTrip(response.trip, `${response.event.title}: itinerary updated.`); } catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not replan right now.'); } finally { setRunning(null); } };
  return <div className="space-y-6"><section className="rounded-[32px] bg-[#fff2ed] p-7 sm:p-9"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eyebrow text-coral">Always in the loop</p><h1 className="mt-1 max-w-2xl font-display text-4xl leading-none text-ink sm:text-5xl">Travel changes. Your plan should, too.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-stone-600">Trigger a disruption and watch JourneyOS protect your highest-value moments while rebalancing the route.</p></div><div className="rounded-2xl bg-white/75 px-4 py-3 text-xs font-bold text-coral">Live simulation</div></div></section><section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]"><div className="rounded-[28px] border border-stone-200 bg-white p-5"><p className="eyebrow">Demo events</p><h2 className="mt-1 text-xl font-bold text-ink">What happened?</h2><div className="mt-5 grid gap-2">{eventMeta.map(({ type, label, icon: Icon, className }) => <button disabled={running !== null} onClick={() => void trigger(type)} key={type} className={`flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left text-sm font-bold transition disabled:cursor-wait disabled:opacity-60 ${className}`}><span className="flex items-center gap-3"><Icon size={18} /> {running === type ? 'Re-optimizing…' : label}</span><ChevronRight size={17} /></button>)}</div></div><div className="rounded-[28px] border border-moss/15 bg-[#f6fbf7] p-5 sm:p-7"><div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-moss text-white"><Bot size={20} /></span><div><p className="eyebrow text-moss">AI decision log</p><h2 className="mt-1 text-xl font-bold text-ink">Here’s what changed — and why.</h2></div></div><p className="mt-6 border-l-2 border-coral pl-4 text-lg leading-8 text-ink">“{explanation}”</p><div className="mt-7 grid gap-3 sm:grid-cols-3"><div className="soft-stat"><span>Route impact</span><strong>− 42 min</strong></div><div className="soft-stat"><span>Priorities held</span><strong>4 of 4</strong></div><div className="soft-stat"><span>Update status</span><strong className="text-moss">Synced</strong></div></div><div className="mt-7 border-t border-moss/10 pt-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-400">Recent changes</p><div className="mt-3 space-y-2">{trip.events.slice(0, 3).map((event) => <div className="flex items-center gap-3 text-sm" key={event.id}><Check className="text-moss" size={15} /><span className="font-semibold text-ink">{event.title}</span><span className="ml-auto text-xs text-stone-400">just now</span></div>)}{trip.events.length === 0 && <p className="text-sm text-stone-500">No disruptions yet — the original itinerary is holding strong.</p>}</div></div></div></section></div>;
}

function BookingCheckout({ trip, onTrip }: { trip: Trip; onTrip: (trip: Trip, note: string) => void }) {
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const selectFlight = async (id: string) => { setBusy(true); try { const response = await api.selectFlight(id); onTrip(response.trip, 'Flight selection and group total updated.'); } finally { setBusy(false); } };
  const selectHotel = async (id: string) => { setBusy(true); try { const response = await api.selectHotel(id); onTrip(response.trip, 'Hotel selection and group total updated.'); } finally { setBusy(false); } };
  const startCheckout = async () => { setBusy(true); try { const response = await api.createOrder(); setOrder(response.order); } catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not create checkout.'); } finally { setBusy(false); } };
  const capture = async () => { if (!order) return; setBusy(true); try { const response = await api.captureOrder(order.id); setOrder(response.order); } finally { setBusy(false); } };
  return <div className="space-y-6"><section className="flex flex-col gap-5 rounded-[32px] bg-ink px-7 py-8 text-white sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow text-emerald-200">Booking command center</p><h1 className="mt-1 font-display text-4xl">Choose with confidence.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-white/65">Every option is normalized into one simple decision. The group cost updates before anyone pays.</p></div><div className="rounded-2xl bg-white/10 px-4 py-3 text-right"><p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Trip total</p><p className="mt-1 text-2xl font-bold">{money(trip.budget.spent)}</p></div></section><section className="grid gap-6 xl:grid-cols-2"><div className="rounded-[28px] border border-stone-200 bg-white p-5"><div className="flex items-center justify-between"><div><p className="eyebrow">Sabre sandbox</p><h2 className="mt-1 text-xl font-bold text-ink">Flights to Tokyo</h2></div><Plane className="text-moss" /></div><div className="mt-5 space-y-3">{trip.flights.map((flight) => <button disabled={busy} onClick={() => void selectFlight(flight.id)} className={`w-full rounded-2xl border p-4 text-left transition ${flight.selected ? 'border-moss bg-[#eff6f1] ring-1 ring-moss/10' : 'border-stone-200 hover:border-moss/40'}`} key={flight.id}><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-ink">{flight.airline} <span className="font-medium text-stone-400">{flight.code}</span></p><p className="mt-1 text-xs text-stone-500">{flight.departure} {flight.departureTime} <ArrowRight className="mx-1 inline" size={12} /> {flight.arrival} {flight.arrivalTime}</p></div><div className="text-right"><p className="font-bold text-ink">{money(flight.price)}</p><p className="text-[10px] text-stone-400">per traveler</p></div></div><div className="mt-3 flex items-center justify-between text-xs"><span className="text-stone-500">{flight.duration} · {flight.stops === 0 ? 'Nonstop' : `${flight.stops} stop`}</span>{flight.selected && <span className="flex items-center gap-1 font-bold text-moss"><CheckCircle2 size={14} /> Selected</span>}</div></button>)}</div></div><div className="rounded-[28px] border border-stone-200 bg-white p-5"><div className="flex items-center justify-between"><div><p className="eyebrow">Sabre sandbox</p><h2 className="mt-1 text-xl font-bold text-ink">Stay in the middle of it.</h2></div><HotelIcon className="text-coral" /></div><div className="mt-5 space-y-3">{trip.hotels.map((hotel) => <button disabled={busy} onClick={() => void selectHotel(hotel.id)} className={`w-full rounded-2xl border p-4 text-left transition ${hotel.selected ? 'border-moss bg-[#eff6f1] ring-1 ring-moss/10' : 'border-stone-200 hover:border-moss/40'}`} key={hotel.id}><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-ink">{hotel.name}</p><p className="mt-1 text-xs text-stone-500">{hotel.location} · ★ {hotel.rating}</p></div><div className="text-right"><p className="font-bold text-ink">{money(hotel.totalPrice)}</p><p className="text-[10px] text-stone-400">trip total</p></div></div><div className="mt-3 flex items-center justify-between text-xs"><span className="text-stone-500">{hotel.amenities.slice(0, 2).join(' · ')}</span>{hotel.selected && <span className="flex items-center gap-1 font-bold text-moss"><CheckCircle2 size={14} /> Selected</span>}</div></button>)}</div></div></section><section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]"><div className="rounded-[28px] border border-stone-200 bg-white p-6"><p className="eyebrow">Cost clarity</p><h2 className="mt-1 text-2xl font-bold text-ink">One trip total. A fair split.</h2><div className="mt-5 space-y-3">{Object.entries({ Flights: trip.budget.flight, Hotel: trip.budget.hotel, Activities: trip.budget.activities, Food: trip.budget.food }).map(([label, amount]) => <div className="flex items-center justify-between text-sm" key={label}><span className="text-stone-500">{label}</span><b className="text-ink">{money(amount)}</b></div>)}<div className="flex items-center justify-between border-t border-stone-200 pt-3 text-lg"><b className="text-ink">Total</b><b className="text-ink">{money(trip.budget.spent)}</b></div></div></div><div className="rounded-[28px] bg-[#eff6f1] p-6"><div className="flex items-start justify-between"><div><p className="eyebrow text-moss">PayPal checkout</p><h2 className="mt-1 text-2xl font-bold text-ink">Split it four ways.</h2></div><WalletCards className="text-moss" /></div>{order ? <div className="mt-5">{order.split.map((person) => <div className="flex items-center justify-between border-b border-moss/10 py-2.5 text-sm" key={person.travelerId}><span className="font-semibold text-ink">{person.name}</span><b className="text-ink">{money(person.amount)}</b></div>)}{order.status === 'COMPLETED' ? <div className="mt-5 flex items-center gap-2 rounded-2xl bg-moss px-4 py-3 text-sm font-bold text-white"><CheckCircle2 size={18} /> Payment confirmed · booking held</div> : <button disabled={busy} onClick={() => void capture()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ffc439] px-4 py-3.5 text-sm font-bold text-[#1d2d35] transition hover:bg-[#ffce5c]"><CreditCard size={17} /> {order.mock ? 'Complete demo payment' : 'Continue to PayPal'}</button>}</div> : <><p className="mt-4 text-sm leading-6 text-stone-600">Create an order, then give each traveler an equal, transparent share of the selected itinerary.</p><button disabled={busy} onClick={() => void startCheckout()} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ffc439] px-4 py-3.5 text-sm font-bold text-[#1d2d35] transition hover:bg-[#ffce5c]"><CreditCard size={17} /> {busy ? 'Creating order…' : 'Checkout with PayPal'}</button></>}</div></section></div>;
}

function App() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [page, setPage] = useState<Page>('home');
  const [activeDay, setActiveDay] = useState(2);
  const [notice, setNotice] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { void api.getDemo().then(({ trip: seeded }) => setTrip(seeded)).catch((error: Error) => setNotice(`Could not reach the JourneyOS API: ${error.message}`)); }, []);
  const onTrip = (updated: Trip, message: string) => { setTrip(updated); setNotice(message); window.setTimeout(() => setNotice(null), 4200); };
  const title = useMemo(() => nav.find((item) => item.id === page)?.label ?? 'JourneyOS', [page]);
  const scanReceipt = async () => { if (!trip) return; try { const response = await api.scanReceipt(); onTrip(response.trip, `${response.receipt.restaurant} receipt scanned — ${money(response.receipt.amount)} added to live spend.`); } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not scan receipt.'); } };
  if (!trip) return <main className="grid min-h-screen place-items-center bg-cream"><div className="text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-moss text-white animate-pulse"><Sparkles /></div><p className="mt-4 text-sm font-bold text-ink">Opening your journey…</p></div></main>;
  const content = page === 'home' ? <><TripOverview trip={trip} setPage={setPage} activeDay={activeDay} setActiveDay={setActiveDay} onReceipt={() => void scanReceipt()} /><div className="mt-6"><TravelerProfiles trip={trip} /></div></> : page === 'planner' ? <VoicePlanner trip={trip} onTrip={onTrip} /> : page === 'map' ? <JourneyMap trip={trip} activeDay={activeDay} setActiveDay={setActiveDay} /> : page === 'operations' ? <OperationsCenter trip={trip} onTrip={onTrip} /> : <BookingCheckout trip={trip} onTrip={onTrip} />;
  return <div className="min-h-screen bg-cream text-ink"><aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-stone-200 bg-white px-5 py-6 lg:flex"><div className="flex items-center gap-3 px-2"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-ink text-lg font-bold text-white">J</span><div><p className="font-display text-2xl leading-none text-ink">JourneyOS</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-moss">Travel, arranged.</p></div></div><nav className="mt-10 space-y-1">{nav.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setPage(id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${page === id ? 'bg-[#eff6f1] text-moss' : 'text-stone-500 hover:bg-stone-50 hover:text-ink'}`}><Icon size={18} />{label}</button>)}</nav><div className="mt-auto rounded-2xl bg-ink p-4 text-white"><p className="text-xs font-bold">Your travel DNA is learning.</p><p className="mt-2 text-xs leading-5 text-white/60">Each choice makes the next trip feel more like you.</p><div className="mt-3 flex items-center gap-1.5"><Sparkles size={14} className="text-amber-300" /><span className="text-xs font-bold text-amber-100">Culture-forward</span></div></div></aside><header className="sticky top-0 z-30 border-b border-stone-200 bg-cream/90 px-5 py-4 backdrop-blur lg:ml-[248px] lg:px-9"><div className="mx-auto flex max-w-[1400px] items-center justify-between"><div className="flex items-center gap-3"><button onClick={() => setMenuOpen(!menuOpen)} className="grid h-9 w-9 place-items-center rounded-xl bg-white text-ink ring-1 ring-stone-200 lg:hidden"><Map size={17} /></button><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">{trip.dates}</p><h2 className="text-sm font-bold text-ink">{title}</h2></div></div><div className="flex items-center gap-2"><span className="hidden rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-stone-500 ring-1 ring-stone-200 sm:inline-flex">4 travelers</span><span className="grid h-9 w-9 place-items-center rounded-full bg-coral text-xs font-bold text-white">AY</span></div></div>{menuOpen && <div className="mx-auto mt-4 max-w-[1400px] rounded-2xl bg-white p-2 shadow-lg ring-1 ring-stone-200 lg:hidden">{nav.map(({ id, label, icon: Icon }) => <button onClick={() => { setPage(id); setMenuOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${page === id ? 'bg-[#eff6f1] text-moss' : 'text-stone-600'}`} key={id}><Icon size={17} />{label}</button>)}</div>}</header><main className="px-5 py-7 lg:ml-[248px] lg:px-9"><div className="mx-auto max-w-[1400px]">{content}</div></main>{notice && <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-2xl"><div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-[#8fe0b7]" size={17} /><span>{notice}</span></div></div>}</div>;
}

export default App;
