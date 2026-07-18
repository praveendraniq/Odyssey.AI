import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, CreditCard, Hotel, MapPinned, Plane, Sparkles } from 'lucide-react';
import { api } from '../api';
import type { Flight, Hotel as HotelType, PaymentOrder, Trip } from '../types';
import { useAgentActions } from '@vocalbridgeai/react';

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const displayDate = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const plusDays = (value: string, days: number) => { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
const airportCode = (place: string) => {
  const normalized = place.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(normalized)) return normalized;
  const known: Record<string, string> = { 'SAN FRANCISCO': 'SFO', PARIS: 'PAR', JAPAN: 'TYO', TOKYO: 'TYO', CHENNAI: 'MAA', INDIA: 'DEL', 'NEW YORK': 'NYC', LONDON: 'LON', 'LOS ANGELES': 'LAX' };
  return known[normalized] ?? '';
};

type BundleId = 'value' | 'overall' | 'neighborhood';
type LiveOffer = { id: string; label: string; title: string; detail: string; price: string; source: string; groupPrice?: string };
type Bundle = { id: BundleId; label: string; title: string; reason: string; flight: Flight; hotel: HotelType; secondHotel?: HotelType; hotelTotal: number; total: number; staySummary: string };

const mcpContent = (value: unknown) => {
  const text = (value as { content?: Array<{ text?: string }> })?.content?.[0]?.text;
  if (!text) return {} as Record<string, unknown>;
  try { return JSON.parse(text) as Record<string, unknown>; } catch { return {} as Record<string, unknown>; }
};

export function BookingExperience({ trip, onTrip }: { trip: Trip; onTrip: (trip: Trip, note: string) => void }) {
  const { onAction } = useAgentActions();
  const [stage, setStage] = useState<'review' | 'payment'>('review');
  const [bundleId, setBundleId] = useState<BundleId>('overall');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [view, setView] = useState<'admin' | 'traveler'>('admin');
  const [sabreStatus, setSabreStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [sabreNote, setSabreNote] = useState('');
  const [liveOffers, setLiveOffers] = useState<{ flights: LiveOffer[]; hotels: LiveOffer[] }>({ flights: [], hotels: [] });
  const [details, setDetails] = useState({ origin: trip.request.origin ?? 'San Francisco', destination: trip.request.destination, departureDate: trip.request.departureDate ?? '2026-10-12', returnDate: trip.request.returnDate ?? '2026-10-16' });

  const equalShares = () => Object.fromEntries(trip.travelers.map((person) => [person.id, Number((100 / Math.max(1, trip.travelers.length)).toFixed(2))]));
  const [shares, setShares] = useState<Record<string, number>>(equalShares);
  useEffect(() => { setShares(equalShares()); setConfirmed(false); setOrder(null); }, [trip.travelers.length, trip.request.origin, trip.request.destination, trip.request.departureDate, trip.request.returnDate]);
  useEffect(() => { setDetails({ origin: trip.request.origin ?? 'San Francisco', destination: trip.request.destination, departureDate: trip.request.departureDate ?? '2026-10-12', returnDate: trip.request.returnDate ?? '2026-10-16' }); }, [trip.request.origin, trip.request.destination, trip.request.departureDate, trip.request.returnDate]);

  const selectedFlight = trip.flights.find((item) => item.selected) ?? trip.flights[0];
  const aaFlight = trip.flights.find((item) => /american airlines/i.test(item.airline)) ?? selectedFlight;
  const valueFlight = [...trip.flights].sort((left, right) => left.price - right.price)[0] ?? selectedFlight;
  const selectedHotel = trip.hotels.find((item) => item.selected) ?? trip.hotels[0];
  const valueHotel = [...trip.hotels].sort((left, right) => left.price - right.price)[0] ?? selectedHotel;
  const secondHotel = trip.hotels.find((item) => item.id !== selectedHotel?.id) ?? valueHotel;
  const arrivalDate = plusDays(details.departureDate, selectedFlight?.arrivalTime.includes('+1') ? 1 : 0);
  const nights = Math.max(1, Math.round((new Date(`${details.returnDate}T12:00:00Z`).getTime() - new Date(`${arrivalDate}T12:00:00Z`).getTime()) / 86_400_000));
  const firstStayNights = Math.max(1, Math.ceil(nights / 2));
  const secondStayNights = Math.max(0, nights - firstStayNights);

  const bundles = useMemo<Bundle[]>(() => {
    if (!selectedFlight || !selectedHotel || !valueFlight || !valueHotel || !aaFlight) return [];
    const valueHotelTotal = valueHotel.price * nights;
    const overallHotelTotal = selectedHotel.price * nights;
    const hopHotelTotal = selectedHotel.price * firstStayNights + (secondHotel?.price ?? selectedHotel.price) * secondStayNights;
    return [
      { id: 'value', label: 'A · Best value', title: 'Spend less, stay central', reason: 'Lowest combined flight and stay price for the group.', flight: valueFlight, hotel: valueHotel, hotelTotal: valueHotelTotal, total: valueFlight.price * trip.travelers.length + valueHotelTotal, staySummary: `${nights} nights at ${valueHotel.name}` },
      { id: 'overall', label: 'B · Best overall', title: 'AA flight + balanced stay', reason: 'Recommended for the demo: American Airlines, a strong schedule, and one simple check-in.', flight: aaFlight, hotel: selectedHotel, hotelTotal: overallHotelTotal, total: aaFlight.price * trip.travelers.length + overallHotelTotal, staySummary: `${nights} nights at ${selectedHotel.name}` },
      { id: 'neighborhood', label: 'C · Neighborhood hop', title: 'Stay where each day happens', reason: 'Less daily backtracking, with one planned hotel move instead of commuting across the city.', flight: aaFlight, hotel: selectedHotel, secondHotel, hotelTotal: hopHotelTotal, total: aaFlight.price * trip.travelers.length + hopHotelTotal, staySummary: `${firstStayNights} nights at ${selectedHotel.name}${secondStayNights ? ` + ${secondStayNights} at ${secondHotel?.name}` : ''}` },
    ];
  }, [aaFlight, firstStayNights, nights, secondHotel, secondStayNights, selectedFlight, selectedHotel, trip.travelers.length, valueFlight, valueHotel]);

  const selectedBundle = bundles.find((bundle) => bundle.id === bundleId) ?? bundles[0];
  const bookingTotal = selectedBundle?.total ?? trip.budget.flight + trip.budget.hotel;
  const totalPercent = Object.values(shares).reduce((sum, value) => sum + value, 0);
  const validSplit = Math.abs(totalPercent - 100) < 0.01;
  const travelerPreview = trip.travelers[1] ?? trip.travelers[0];

  const chooseBundle = async (bundle: Bundle) => {
    setBusy(true);
    try {
      const flightResponse = await api.selectFlight(bundle.flight.id, trip);
      const hotelResponse = await api.selectHotel(bundle.hotel.id, flightResponse.trip);
      setBundleId(bundle.id); setConfirmed(false); setOrder(null);
      onTrip(hotelResponse.trip, `${bundle.label} selected. Review its dates, stays, and group total before payment.`);
    } catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not select this bundle.'); }
    finally { setBusy(false); }
  };

  const createOrder = async () => {
    if (!validSplit) return;
    setBusy(true);
    try {
      const response = await api.createOrder(shares, bookingTotal);
      setOrder(response.order);
      onTrip(trip, response.order.mock ? 'Payment split calculated in safe demo mode. No money or links were sent.' : 'PayPal sandbox order created. Open PayPal approval to continue.');
    } catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not create checkout.'); }
    finally { setBusy(false); }
  };

  useEffect(() => onAction('select_bundle', (payload) => {
    const requested = payload.id;
    const bundle = bundles.find((item) => item.id === requested);
    if (bundle) void chooseBundle(bundle);
  }), [bundles, onAction]);
  useEffect(() => onAction('confirm_booking', () => { setConfirmed(true); setStage('payment'); }), [onAction]);
  useEffect(() => onAction('collect_payment', () => {
    setConfirmed(true); setStage('payment'); void createOrder();
  }), [onAction, bookingTotal, shares, validSplit]);

  const capture = async () => {
    if (!order) return;
    setBusy(true);
    try {
      const response = await api.captureOrder(order.id); setOrder(response.order);
      onTrip(trip, response.order.mock ? 'Demo payment completed; no real money moved.' : 'PayPal sandbox payment captured.');
    } catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not capture payment.'); }
    finally { setBusy(false); }
  };

  const loadSabreOffers = async () => {
    const origin = airportCode(details.origin); const destination = airportCode(details.destination);
    if (!origin || !destination) { setSabreStatus('error'); setSabreNote('Use a supported city or three-letter airport code to search Sabre CERT.'); return; }
    setSabreStatus('loading'); setSabreNote('');
    try {
      const travelerCount = Math.max(1, trip.travelers.length);
      const response = await api.searchSabreLive({ origin, destination, departureDate: details.departureDate, returnDate: details.returnDate, adults: travelerCount });
      const flightData = mcpContent(response.results.flights); const hotelData = mcpContent(response.results.hotels);
      const labels = ['Lowest live fare', 'Best schedule', 'Flexible option'];
      const flights = Array.isArray(flightData.offers) ? flightData.offers.slice(0, 3).map((offer, index) => {
        const value = offer as { id?: string; totalPrice?: { amount?: string; currencyCode?: string }; source?: { distributionModel?: string } };
        const serialized = JSON.stringify(offer);
        const carrierCode = serialized.match(/"(?:marketingAirlineCode|carrierCode|marketingCarrier)":"([A-Z0-9]{2})"/i)?.[1]?.toUpperCase();
        const carrier = carrierCode === 'AA' ? 'American Airlines' : carrierCode ? `Carrier ${carrierCode}` : 'Carrier not exposed';
        const groupAmount = value.totalPrice?.amount ? Number(value.totalPrice.amount) : undefined;
        const perTraveler = Number.isFinite(groupAmount) && groupAmount ? groupAmount / travelerCount : undefined;
        return { id: value.id ?? `flight-${index}`, label: labels[index] ?? 'Live alternative', title: `${carrier} · ${origin} to ${destination}`, detail: `${displayDate(details.departureDate)} to ${displayDate(details.returnDate)} · ${travelerCount} travelers`, price: perTraveler ? `${value.totalPrice?.currencyCode ?? 'USD'} ${perTraveler.toFixed(2)} each` : 'Price on selection', groupPrice: groupAmount ? `${value.totalPrice?.currencyCode ?? 'USD'} ${groupAmount.toFixed(2)} group total` : undefined, source: value.source?.distributionModel ? `Sabre CERT · ${value.source.distributionModel}` : 'Live Sabre CERT' };
      }) : [];
      const hotels = Array.isArray(hotelData.hotels) ? hotelData.hotels.slice(0, 3).map((item, index) => {
        const value = item as { hotel?: { hotelCode?: string; hotelName?: string; address?: { cityName?: string } }; rateDetails?: { approxTotalPrice?: number; currencyCode?: string } };
        return { id: value.hotel?.hotelCode ?? `hotel-${index}`, label: index === 0 ? 'Live stay match' : 'Live alternative', title: value.hotel?.hotelName ?? `Hotel option ${index + 1}`, detail: `${value.hotel?.address?.cityName ?? destination} · ${displayDate(arrivalDate)} to ${displayDate(details.returnDate)} · ${nights} nights`, price: value.rateDetails?.approxTotalPrice ? `${value.rateDetails.currencyCode ?? 'USD'} ${value.rateDetails.approxTotalPrice} stay total` : 'Rate on selection', source: 'Live Sabre CERT hotel rate' };
      }) : [];
      setLiveOffers({ flights, hotels }); setSabreStatus('ready');
      setSabreNote(`Sabre CERT results for ${origin} → ${destination}. This is certification/sandbox inventory, not production ticketing. American Airlines appears here only when Sabre returns an AA itinerary; the AA bundle above is curated demo inventory.`);
    } catch (error) { setSabreStatus('error'); setSabreNote(error instanceof Error ? error.message : 'Sabre CERT search could not be completed.'); }
  };

  return <div className="space-y-6 pb-32">
    <section className="rounded-[32px] bg-ink px-6 py-7 text-white sm:px-8"><p className="eyebrow text-emerald-200">Book & split</p><h1 className="mt-1 font-display text-3xl sm:text-4xl">Pick one clear trip bundle.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">Compare the trade-off, confirm the plan, then decide exactly what percentage each friend pays.</p></section>
    <nav className="grid overflow-hidden rounded-[22px] border border-stone-200 bg-white sm:grid-cols-2"><button onClick={() => setStage('review')} className={`px-5 py-4 text-left font-bold ${stage === 'review' ? 'bg-[#eff6f1] text-moss' : 'text-stone-500'}`}>1. Choose a bundle</button><button onClick={() => confirmed && setStage('payment')} className={`border-t border-stone-200 px-5 py-4 text-left font-bold sm:border-l sm:border-t-0 ${stage === 'payment' ? 'bg-[#fff8e9] text-ink' : 'text-stone-500'} ${!confirmed ? 'opacity-50' : ''}`}>2. Split & collect</button></nav>

    {stage === 'review' ? <>
      <section className="rounded-[28px] border border-stone-200 bg-white p-5"><div className="flex items-center gap-3"><CalendarDays className="text-moss" /><div><p className="eyebrow">Exact travel window</p><h2 className="mt-1 text-xl font-bold">{displayDate(details.departureDate)} → {displayDate(details.returnDate)}</h2><p className="mt-1 text-sm text-stone-500">{details.origin} to {details.destination} · arrival {displayDate(arrivalDate)} · {nights} hotel nights</p></div></div></section>
      <section><div><p className="eyebrow text-moss">Recommended packages</p><h2 className="mt-1 text-2xl font-bold text-ink">Three understandable choices</h2><p className="mt-2 text-sm text-stone-600">Each bundle includes the flight and every overnight stay. Choose one—no separate flight/hotel selection required.</p></div><div className="mt-4 grid gap-4 xl:grid-cols-3">{bundles.map((bundle) => <button key={bundle.id} disabled={busy} onClick={() => void chooseBundle(bundle)} className={`flex h-full flex-col rounded-[24px] border p-5 text-left transition ${bundleId === bundle.id ? 'border-moss bg-[#eff6f1] ring-2 ring-moss/10' : 'border-stone-200 bg-white hover:border-moss/40'}`}><div className="flex items-center justify-between gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${bundle.id === 'overall' ? 'bg-moss text-white' : 'bg-stone-100 text-stone-600'}`}>{bundle.label}</span>{bundleId === bundle.id && <CheckCircle2 size={18} className="text-moss" />}</div><h3 className="mt-4 text-xl font-bold text-ink">{bundle.title}</h3><p className="mt-2 min-h-[44px] text-sm leading-5 text-stone-600">{bundle.reason}</p><div className="mt-4 space-y-3 rounded-2xl bg-white/75 p-4"><div className="flex gap-2"><Plane size={17} className="mt-0.5 shrink-0 text-moss" /><div><b className="text-sm">{bundle.flight.airline} {bundle.flight.code}</b><p className="text-xs text-stone-500">{bundle.flight.departure} {bundle.flight.departureTime} → {bundle.flight.arrival} {bundle.flight.arrivalTime}</p></div></div><div className="flex gap-2"><Hotel size={17} className="mt-0.5 shrink-0 text-coral" /><div><b className="text-sm">{bundle.staySummary}</b><p className="text-xs text-stone-500">All {nights} nights covered</p></div></div></div><div className="mt-auto pt-5"><b className="text-2xl text-ink">{money(bundle.total)}</b><p className="text-xs text-stone-500">flight + stays · group total</p></div></button>)}</div></section>
      <section className="rounded-[28px] border border-sky-200 bg-sky-50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow text-sky-800">Sabre CERT evidence</p><h2 className="mt-1 text-lg font-bold">Check the live market for these exact dates</h2><p className="mt-1 text-xs text-sky-900/70">Live results are labeled references, not anonymous “offer 1” cards.</p></div><button disabled={sabreStatus === 'loading'} onClick={() => void loadSabreOffers()} className="rounded-xl bg-sky-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{sabreStatus === 'loading' ? 'Searching Sabre…' : 'Check live Sabre prices'}</button></div>{sabreStatus !== 'idle' && <p className={`mt-3 text-sm font-semibold ${sabreStatus === 'ready' ? 'text-moss' : sabreStatus === 'error' ? 'text-coral' : 'text-stone-600'}`}>{sabreNote}</p>}{sabreStatus === 'ready' && <div className="mt-5 grid gap-4 lg:grid-cols-2"><LiveOfferList title="Live round-trip flight references" offers={liveOffers.flights} empty="No live flights returned for this window." /><LiveOfferList title={`Live stay references · ${nights} nights`} offers={liveOffers.hotels} empty="No live hotels returned for these dates." /></div>}</section>
      <section className="flex flex-col justify-between gap-4 rounded-[28px] bg-[#eff6f1] p-6 sm:flex-row sm:items-center"><div><p className="eyebrow text-moss">Admin confirmation</p><h2 className="mt-1 text-2xl font-bold">Confirm {selectedBundle?.label}</h2><p className="mt-2 text-sm text-stone-600">{selectedBundle?.flight.airline} plus {selectedBundle?.staySummary} · {money(bookingTotal)} group total.</p></div><button onClick={() => { setConfirmed(true); setStage('payment'); }} className="rounded-xl bg-moss px-5 py-3 text-sm font-bold text-white"><CheckCircle2 className="mr-2 inline" size={16} />Confirm & split payment</button></section>
    </> : <>
      <section className="grid gap-6 xl:grid-cols-[1fr_0.75fr]"><div className="rounded-[28px] border border-stone-200 bg-white p-6"><div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Custom percentage split</p><h2 className="mt-1 text-2xl font-bold">Split {money(bookingTotal)}</h2><p className="mt-2 text-sm text-stone-500">Flight and overnight stays only. Shared receipts are settled separately.</p></div><button onClick={() => setStage('review')} className="text-xs font-bold text-moss">Edit bundle</button></div><div className="mt-5 flex rounded-xl bg-stone-100 p-1"><button onClick={() => setView('admin')} className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${view === 'admin' ? 'bg-white shadow-sm' : 'text-stone-500'}`}>Admin split</button><button onClick={() => setView('traveler')} className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${view === 'traveler' ? 'bg-white shadow-sm' : 'text-stone-500'}`}>Traveler preview</button></div>{view === 'admin' ? <div className="mt-5 space-y-2">{trip.travelers.map((person) => <label key={person.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 px-3 py-3"><span className="text-sm font-semibold">{person.name}</span><span className="flex items-center gap-2"><input aria-label={`${person.name} payment percentage`} type="number" min="0" max="100" step="0.01" value={shares[person.id] ?? 0} onChange={(event) => { setShares({ ...shares, [person.id]: Number(event.target.value) }); setOrder(null); }} className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-right" /><span className="text-xs text-stone-400">%</span><b className="w-24 text-right text-sm text-moss">{money(bookingTotal * (shares[person.id] ?? 0) / 100)}</b></span></label>)}<div className={`text-right text-xs font-bold ${validSplit ? 'text-moss' : 'text-coral'}`}>{totalPercent.toFixed(2)}% of 100%</div><button onClick={() => { setShares(equalShares()); setOrder(null); }} className="text-xs font-bold text-moss">Reset to equal 25% shares</button></div> : <div className="mt-5 rounded-2xl bg-[#f6fbf7] p-5"><p className="eyebrow text-moss">What {travelerPreview?.name} sees</p><p className="mt-2 text-2xl font-bold">{money(bookingTotal * (shares[travelerPreview?.id ?? ''] ?? 0) / 100)}</p><p className="mt-2 text-sm text-stone-600">Their private payment request for the confirmed bundle.</p></div>}</div><aside className="rounded-[28px] bg-[#fff8e9] p-6"><div className="flex items-center gap-2"><CreditCard className="text-[#0070ba]" /><p className="eyebrow text-[#0070ba]">PayPal sandbox checkout</p></div><h2 className="mt-2 text-2xl font-bold">Collect each friend’s share.</h2><p className="mt-3 text-sm leading-6 text-stone-600">With PayPal sandbox credentials, JourneyOS creates an approval order and captures it after approval. Without credentials, the same flow is clearly marked as a safe simulation.</p>{order ? <div className="mt-5"><div className={`rounded-xl px-3 py-2 text-xs font-bold ${order.mock ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-900'}`}>{order.mock ? 'Simulation fallback · no real PayPal order' : `PayPal sandbox order · ${order.id}`}</div><div className="mt-3 space-y-2">{order.split.map((item) => <div key={item.travelerId} className="flex justify-between border-b border-amber-200 py-2 text-sm"><span>{item.name}</span><b>{money(item.amount)}</b></div>)}</div>{order.approveUrl && order.status !== 'COMPLETED' && <a href={order.approveUrl} target="_blank" rel="noreferrer" className="mt-4 block rounded-xl bg-[#0070ba] px-4 py-3 text-center text-sm font-bold text-white">Open PayPal sandbox approval</a>}{order.status === 'COMPLETED' ? <div className="mt-4 rounded-xl bg-moss px-3 py-3 text-sm font-bold text-white">{order.mock ? 'Demo collection complete · no money moved' : 'PayPal sandbox capture complete'}</div> : <button disabled={busy} onClick={() => void capture()} className="mt-3 w-full rounded-xl bg-[#ffc439] px-4 py-3 text-sm font-bold">{order.mock ? 'Complete payment simulation' : 'Capture approved sandbox payment'}</button>}</div> : <button disabled={busy || !validSplit} onClick={() => void createOrder()} className="mt-6 w-full rounded-xl bg-[#ffc439] px-4 py-3 text-sm font-bold disabled:opacity-40"><CreditCard className="mr-2 inline" size={16} />Collect with PayPal sandbox</button>}</aside></section>
      <section className="rounded-[24px] border border-stone-200 bg-white p-5"><div className="flex items-start gap-3"><MapPinned className="mt-1 text-moss" /><div><p className="eyebrow">What happens later</p><h3 className="mt-1 text-lg font-bold">Shared expenses remain separate.</h3><p className="mt-2 text-sm leading-6 text-stone-600">Meals, rides and activity receipts go to Shared expenses. JourneyOS nets those receipts at trip end and never charges these flight-and-stay costs twice.</p></div></div></section>
    </>}
  </div>;
}

function LiveOfferList({ title, offers, empty }: { title: string; offers: LiveOffer[]; empty: string }) {
  return <div><p className="text-xs font-bold uppercase tracking-wide text-stone-500">{title}</p><div className="mt-2 space-y-2">{offers.length ? offers.map((offer) => <article key={offer.id} className="rounded-2xl border border-sky-200 bg-white p-4 text-sm"><span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-800">{offer.label}</span><div className="mt-3 flex flex-col justify-between gap-2 sm:flex-row"><div><b>{offer.title}</b><p className="mt-1 text-xs leading-5 text-stone-500">{offer.detail}</p></div><div className="shrink-0 sm:text-right"><b>{offer.price}</b>{offer.groupPrice && <p className="mt-1 text-xs font-semibold text-moss">{offer.groupPrice}</p>}</div></div><p className="mt-3 border-t border-sky-100 pt-3 text-[10px] font-bold uppercase tracking-wide text-stone-400">{offer.source} · recheck before booking</p></article>) : <p className="rounded-xl bg-white p-3 text-sm text-stone-500">{empty}</p>}</div></div>;
}
