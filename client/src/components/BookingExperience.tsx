import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Copy, CreditCard, Hotel, Link2, MapPinned, Plane, Sparkles } from 'lucide-react';
import { api } from '../api';
import type { Flight, Hotel as HotelType, PaymentOrder, Trip } from '../types';
import { useAgentActions } from '@vocalbridgeai/react';

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const displayDate = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const plusDays = (value: string, days: number) => { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
const airportCode = (place: string) => {
  const normalized = place.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : '';
};

type BundleId = 'value' | 'overall' | 'neighborhood';
type LiveOffer = { id: string; label: string; title: string; detail: string; price: string; source: string; groupPrice?: string };
type Bundle = { id: BundleId; label: string; title: string; reason: string; flight: Flight; hotel: HotelType; secondHotel?: HotelType; hotelTotal: number; total: number; staySummary: string };

const mcpContent = (value: unknown) => {
  const text = (value as { content?: Array<{ text?: string }> })?.content?.[0]?.text;
  if (!text) return {} as Record<string, unknown>;
  try { return JSON.parse(text) as Record<string, unknown>; } catch { return {} as Record<string, unknown>; }
};

const applyBundleRoute = (trip: Trip, bundle: Bundle, firstStayNights: number) => {
  const second = bundle.id === 'neighborhood' ? bundle.secondHotel : undefined;
  const moveDay = firstStayNights + 1;
  const itinerary = trip.itinerary.map((item) => {
    const hotel = second && item.day >= moveDay ? second : bundle.hotel;
    if (item.id.startsWith('hotel-start-')) return { ...item, title: item.day === 1 ? `Check in · ${hotel.name}` : item.day === moveDay && second ? `Move stay · Check in ${hotel.name}` : `Breakfast · ${hotel.name}`, subtitle: hotel.location };
    if (item.id.startsWith('hotel-return-')) return { ...item, title: `Return to · ${hotel.name}`, subtitle: hotel.location };
    if (item.id.startsWith('dinner-')) return { ...item, title: `Dinner near ${hotel.name}`, subtitle: hotel.location };
    return item;
  });
  const flight = bundle.flight.price * trip.travelers.length;
  const spent = flight + bundle.hotelTotal + trip.budget.activities + trip.budget.food;
  return { ...trip, itinerary, budget: { ...trip.budget, flight, hotel: bundle.hotelTotal, spent, remaining: trip.budget.total - spent }, events: [{ id: `bundle-route-${Date.now()}`, type: 'tired' as const, title: second ? `Hotel move added on Day ${moveDay}` : `Every day anchored to ${bundle.hotel.name}`, createdAt: new Date().toISOString(), explanation: second ? `Days 1–${firstStayNights} use ${bundle.hotel.name}; Day ${moveDay} onward uses ${second.name}. Daily check-in, breakfast, dinner, and return anchors now match the selected stay.` : `All daily hotel anchors now use ${bundle.hotel.name}.` }, ...trip.events] };
};

export function BookingExperience({ trip, onTrip }: { trip: Trip; onTrip: (trip: Trip, note: string) => void }) {
  const { onAction } = useAgentActions();
  const [stage, setStage] = useState<'review' | 'payment'>('review');
  const [bundleId, setBundleId] = useState<BundleId>('overall');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [friendOrders, setFriendOrders] = useState<Record<string, PaymentOrder>>({});
  const [view, setView] = useState<'admin' | 'traveler'>('admin');
  const [sabreStatus, setSabreStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [sabreNote, setSabreNote] = useState('');
  const [liveOffers, setLiveOffers] = useState<{ flights: LiveOffer[]; hotels: LiveOffer[] }>({ flights: [], hotels: [] });
  const [details, setDetails] = useState({ origin: trip.request.origin ?? 'San Francisco', destination: trip.request.destination, departureDate: trip.request.departureDate ?? '2026-10-12', returnDate: trip.request.returnDate ?? '2026-10-16' });

  const equalShares = () => Object.fromEntries(trip.travelers.map((person) => [person.id, Number((100 / Math.max(1, trip.travelers.length)).toFixed(2))]));
  const [shares, setShares] = useState<Record<string, number>>(equalShares);
  useEffect(() => {
    setShares(equalShares());
    setConfirmed(false);
    setOrder(null);
    setFriendOrders({});
    // Sabre prices are searched for a specific passenger count. Do not show a
    // previous live result after the group, route, or travel dates change.
    setLiveOffers({ flights: [], hotels: [] });
    setSabreStatus('idle');
    setSabreNote('');
  }, [trip.travelers.length, trip.request.origin, trip.request.destination, trip.request.departureDate, trip.request.returnDate]);
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
  const admin = trip.travelers[0];
  const travelerPreview = trip.travelers[1] ?? trip.travelers[0];

  const chooseBundle = async (bundle: Bundle) => {
    setBusy(true);
    try {
      const flightResponse = await api.selectFlight(bundle.flight.id, trip);
      const hotelResponse = await api.selectHotel(bundle.hotel.id, flightResponse.trip);
      const updated = applyBundleRoute(hotelResponse.trip, bundle, firstStayNights);
      setBundleId(bundle.id); setConfirmed(false); setOrder(null); setFriendOrders({});
      onTrip(updated, `${bundle.label} selected. Every day now uses the stay assigned to that part of the trip.`);
    } catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not select this bundle.'); }
    finally { setBusy(false); }
  };

  const createOrder = async () => {
    if (!admin) return;
    const approvalWindow = window.open('', 'journeyos-paypal-sandbox', 'popup,width=520,height=720');
    setBusy(true);
    try {
      const adminAdvance = Object.fromEntries(trip.travelers.map((person) => [person.id, person.id === admin.id ? 100 : 0]));
      const response = await api.createOrder(adminAdvance, bookingTotal);
      setOrder(response.order);
      if (response.order.approveUrl && !response.order.mock) approvalWindow?.location.replace(response.order.approveUrl);
      else approvalWindow?.close();
      onTrip(trip, response.order.mock ? `${admin.name}'s admin-payment simulation is ready. No money moved.` : `PayPal sandbox order created for ${admin.name} to advance the booking total.`);
    } catch (error) { approvalWindow?.close(); onTrip(trip, error instanceof Error ? error.message : 'Could not create checkout.'); }
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
  }), [onAction, admin, bookingTotal, trip.travelers]);

  const capture = async () => {
    if (!order) return;
    setBusy(true);
    try {
      const response = await api.captureOrder(order.id); setOrder(response.order);
      onTrip(trip, response.order.mock ? 'Admin payment simulation completed; no real money moved.' : `${admin?.name ?? 'Admin'} paid the booking total in PayPal sandbox. Reimbursement shares are now ready.`);
    } catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not capture payment.'); }
    finally { setBusy(false); }
  };

  const createFriendRequest = async (travelerId: string) => {
    const traveler = trip.travelers.find((person) => person.id === travelerId);
    const amount = bookingTotal * (shares[travelerId] ?? 0) / 100;
    if (!traveler || amount <= 0) return;
    setBusy(true);
    try {
      const percentages = Object.fromEntries(trip.travelers.map((person) => [person.id, person.id === travelerId ? 100 : 0]));
      const response = await api.createOrder(percentages, amount);
      setFriendOrders((current) => ({ ...current, [travelerId]: response.order }));
      onTrip(trip, `${traveler.name}'s private ${money(amount)} PayPal request is ready to copy or open.`);
    } catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not create reimbursement request.'); }
    finally { setBusy(false); }
  };

  const captureFriendRequest = async (travelerId: string) => {
    const current = friendOrders[travelerId];
    if (!current) return;
    setBusy(true);
    try {
      const response = await api.captureOrder(current.id);
      setFriendOrders((orders) => ({ ...orders, [travelerId]: response.order }));
    } catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not capture reimbursement.'); }
    finally { setBusy(false); }
  };

  const copyFriendRequests = async () => {
    const messages = trip.travelers.filter((person) => person.id !== admin?.id && (shares[person.id] ?? 0) > 0).map((person) => {
      const amount = bookingTotal * (shares[person.id] ?? 0) / 100;
      const link = friendOrders[person.id]?.approveUrl ?? '[create this person’s PayPal request first]';
      return `Hi ${person.name}, ${admin?.name ?? 'the trip admin'} paid the ${trip.request.destination} flight and stays. Your agreed reimbursement is ${money(amount)}. Pay securely in PayPal sandbox: ${link}`;
    }).join('\n\n');
    await navigator.clipboard.writeText(messages);
    onTrip(trip, 'Private friend reimbursement messages copied. No SMS was sent automatically.');
  };

  const loadSabreOffers = async (requested?: { origin?: string; destination?: string }) => {
    const suggestedOrigin = airportCode(selectedFlight?.departure ?? '');
    const suggestedDestination = airportCode(selectedFlight?.arrival ?? '');
    let origin = airportCode(requested?.origin ?? details.origin) || suggestedOrigin;
    let destination = airportCode(requested?.destination ?? details.destination) || suggestedDestination;
    if (!origin || !destination || origin === destination) {
      const entered = window.prompt('Confirm or edit the origin and destination IATA codes, separated by a comma.', `${suggestedOrigin || origin || ''}, ${suggestedDestination || destination || ''}`);
      const [enteredOrigin = '', enteredDestination = ''] = (entered ?? '').split(',').map((value) => value.trim());
      origin = airportCode(enteredOrigin); destination = airportCode(enteredDestination);
      if (!origin || !destination) { setSabreStatus('error'); setSabreNote('Sabre CERT requires three-letter IATA airport or city codes. JourneyOS does not guess airport codes from city names.'); return; }
    }
    if (!window.confirm(`Search live Sabre CERT inventory for ${origin} → ${destination}?`)) return;
    setDetails((current) => ({ ...current, origin, destination }));
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
      const liveAaOffer = Array.isArray(flightData.offers) ? flightData.offers.find((offer) => /"(?:marketingAirlineCode|carrierCode|marketingCarrier)":"AA"/i.test(JSON.stringify(offer))) as { totalPrice?: { amount?: string } } | undefined : undefined;
      const liveAaTotal = Number(liveAaOffer?.totalPrice?.amount);
      const curatedAaTotal = /american airlines/i.test(aaFlight?.airline ?? '') ? aaFlight.price * travelerCount : Number.NaN;
      if (Number.isFinite(liveAaTotal) && Number.isFinite(curatedAaTotal) && liveAaTotal < curatedAaTotal) {
        onTrip(trip, `Live Sabre CERT alert: an actual American Airlines fare is ${money(curatedAaTotal - liveAaTotal)} lower for the group than the curated AA flight component. Review the fresh offer before changing the bundle.`);
      }
      const hotels = Array.isArray(hotelData.hotels) ? hotelData.hotels.slice(0, 3).map((item, index) => {
        const value = item as { hotel?: { hotelCode?: string; hotelName?: string; address?: { cityName?: string } }; rateDetails?: { approxTotalPrice?: number; currencyCode?: string } };
        return { id: value.hotel?.hotelCode ?? `hotel-${index}`, label: index === 0 ? 'Live stay match' : 'Live alternative', title: value.hotel?.hotelName ?? `Hotel option ${index + 1}`, detail: `${value.hotel?.address?.cityName ?? destination} · ${displayDate(arrivalDate)} to ${displayDate(details.returnDate)} · ${nights} nights`, price: value.rateDetails?.approxTotalPrice ? `${value.rateDetails.currencyCode ?? 'USD'} ${value.rateDetails.approxTotalPrice} stay total` : 'Rate on selection', source: 'Live Sabre CERT hotel rate' };
      }) : [];
      setLiveOffers({ flights, hotels }); setSabreStatus('ready');
      setSabreNote(`Sabre CERT results for ${origin} → ${destination}. This is certification/sandbox inventory, not production ticketing. American Airlines appears here only when Sabre returns an AA itinerary; the AA bundle above is curated demo inventory.`);
    } catch (error) { setSabreStatus('error'); setSabreNote(error instanceof Error ? error.message : 'Sabre CERT search could not be completed.'); }
  };

  useEffect(() => onAction('search_live_sabre', (payload) => {
    const origin = typeof payload.origin === 'string' ? payload.origin : undefined;
    const destination = typeof payload.destination === 'string' ? payload.destination : undefined;
    void loadSabreOffers({ origin, destination });
  }), [onAction, selectedFlight, trip, details]);

  return <div className="space-y-6 pb-32">
    <section className="rounded-[32px] bg-ink px-6 py-7 text-white sm:px-8"><p className="eyebrow text-emerald-200">Book, pay & reimburse</p><h1 className="mt-1 font-display text-3xl sm:text-4xl">Pick one clear trip bundle.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">The trip admin pays the confirmed booking once. JourneyOS then calculates each friend&apos;s reimbursement without charging the booking twice.</p></section>
    <nav className="grid overflow-hidden rounded-[22px] border border-stone-200 bg-white sm:grid-cols-2"><button onClick={() => setStage('review')} className={`px-5 py-4 text-left font-bold ${stage === 'review' ? 'bg-[#eff6f1] text-moss' : 'text-stone-500'}`}>1. Choose a bundle</button><button onClick={() => confirmed && setStage('payment')} className={`border-t border-stone-200 px-5 py-4 text-left font-bold sm:border-l sm:border-t-0 ${stage === 'payment' ? 'bg-[#fff8e9] text-ink' : 'text-stone-500'} ${!confirmed ? 'opacity-50' : ''}`}>2. Admin pays, then split</button></nav>

    {stage === 'review' ? <>
      <section className="rounded-[28px] border border-stone-200 bg-white p-5"><div className="flex items-center gap-3"><CalendarDays className="text-moss" /><div><p className="eyebrow">Exact travel window</p><h2 className="mt-1 text-xl font-bold">{displayDate(details.departureDate)} → {displayDate(details.returnDate)}</h2><p className="mt-1 text-sm text-stone-500">{details.origin} to {details.destination} · arrival {displayDate(arrivalDate)} · {nights} hotel nights</p></div></div></section>
      <section><div><p className="eyebrow text-moss">Recommended packages · curated demo inventory</p><h2 className="mt-1 text-2xl font-bold text-ink">Three understandable choices</h2><p className="mt-2 text-sm text-stone-600">Each bundle includes the flight and every overnight stay. Choose one—no separate flight/hotel selection required.</p></div><div className="mt-4 grid gap-4 xl:grid-cols-3">{bundles.map((bundle) => <button key={bundle.id} disabled={busy} onClick={() => void chooseBundle(bundle)} className={`flex h-full flex-col rounded-[24px] border p-5 text-left transition ${bundleId === bundle.id ? 'border-moss bg-[#eff6f1] ring-2 ring-moss/10' : 'border-stone-200 bg-white hover:border-moss/40'}`}><div className="flex items-center justify-between gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${bundle.id === 'overall' ? 'bg-moss text-white' : 'bg-stone-100 text-stone-600'}`}>{bundle.label}</span>{bundleId === bundle.id && <CheckCircle2 size={18} className="text-moss" />}</div><h3 className="mt-4 text-xl font-bold text-ink">{bundle.title}</h3><p className="mt-2 min-h-[44px] text-sm leading-5 text-stone-600">{bundle.reason}</p><div className="mt-4 space-y-3 rounded-2xl bg-white/75 p-4"><div className="flex gap-2"><Plane size={17} className="mt-0.5 shrink-0 text-moss" /><div><b className="text-sm">{bundle.flight.airline} {bundle.flight.code}</b><p className="text-xs text-stone-500">{bundle.flight.departure} {bundle.flight.departureTime} → {bundle.flight.arrival} {bundle.flight.arrivalTime}</p></div></div><div className="flex gap-2"><Hotel size={17} className="mt-0.5 shrink-0 text-coral" /><div><b className="text-sm">{bundle.staySummary}</b><p className="text-xs text-stone-500">All {nights} nights covered</p></div></div></div><div className="mt-auto pt-5"><b className="text-2xl text-ink">{money(bundle.total)}</b><p className="text-xs text-stone-500">flight + stays · group total</p></div></button>)}</div></section>
      <section className="rounded-[28px] border border-sky-200 bg-sky-50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow text-sky-800">Optional Sabre CERT check</p><h2 className="mt-1 text-lg font-bold">Compare the bundles with certification inventory</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-sky-900/70">The three bundles above are curated demo choices. This calls Sabre’s CERT/sandbox shopping API for the same dates; returned flights and hotel rates are reference-only and are not automatically selected or booked.</p></div><button disabled={sabreStatus === 'loading'} onClick={() => void loadSabreOffers()} className="rounded-xl bg-sky-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{sabreStatus === 'loading' ? 'Searching Sabre…' : 'Compare Sabre CERT prices'}</button></div>{sabreStatus !== 'idle' && <p className={`mt-3 text-sm font-semibold ${sabreStatus === 'ready' ? 'text-moss' : sabreStatus === 'error' ? 'text-coral' : 'text-stone-600'}`}>{sabreNote}</p>}{sabreStatus === 'ready' && <div className="mt-5 grid gap-4 lg:grid-cols-2"><LiveOfferList title="Sabre CERT round-trip flight references" offers={liveOffers.flights} empty="No certification flights returned for this window." /><LiveOfferList title={`Sabre CERT stay references · ${nights} nights`} offers={liveOffers.hotels} empty="No certification hotels returned for these dates." /></div>}</section>
      <section className="flex flex-col justify-between gap-4 rounded-[28px] bg-[#eff6f1] p-6 sm:flex-row sm:items-center"><div><p className="eyebrow text-moss">Admin confirmation</p><h2 className="mt-1 text-2xl font-bold">Confirm {selectedBundle?.label}</h2><p className="mt-2 text-sm text-stone-600">{selectedBundle?.flight.airline} plus {selectedBundle?.staySummary} · {money(bookingTotal)} group total.</p></div><button onClick={() => { setConfirmed(true); setStage('payment'); }} className="rounded-xl bg-moss px-5 py-3 text-sm font-bold text-white"><CheckCircle2 className="mr-2 inline" size={16} />Confirm & open admin payment</button></section>
    </> : <>
      <section className="grid gap-6 xl:grid-cols-[1fr_0.75fr]">
        <div className="rounded-[28px] border border-stone-200 bg-white p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Step 1 · Admin advance</p><h2 className="mt-1 text-2xl font-bold">{admin?.name ?? 'Admin'} pays {money(bookingTotal)}</h2><p className="mt-2 text-sm text-stone-500">One payment covers the selected flight and every overnight stay. Reimbursement shares are calculated only after this succeeds.</p></div><button onClick={() => setStage('review')} className="text-xs font-bold text-moss">Edit bundle</button></div>
          <div className="mt-5 space-y-3 rounded-2xl bg-[#f6fbf7] p-5 text-sm"><div className="flex justify-between gap-3"><span className="text-stone-500">Flight</span><b>{selectedBundle?.flight.airline} {selectedBundle?.flight.code}</b></div><div className="flex justify-between gap-3"><span className="text-stone-500">Stays</span><b className="text-right">{selectedBundle?.staySummary}</b></div><div className="flex justify-between gap-3 border-t border-moss/10 pt-3"><span className="font-bold">Admin pays now</span><b className="text-moss">{money(bookingTotal)}</b></div></div>
          <p className="mt-4 text-xs leading-5 text-stone-500">PayPal collects the sandbox payment into JourneyOS&apos;s merchant account. Sabre shopping and supplier booking remain separate integration steps; this checkout does not automatically distribute money to an airline or hotel.</p>
        </div>
        <aside className="rounded-[28px] bg-[#fff8e9] p-6"><div className="flex items-center gap-2"><CreditCard className="text-[#0070ba]" /><p className="eyebrow text-[#0070ba]">PayPal sandbox · admin payment</p></div><h2 className="mt-2 text-2xl font-bold">Pay the booking total once.</h2><p className="mt-3 text-sm leading-6 text-stone-600">Sign in with the Personal sandbox buyer account representing {admin?.name ?? 'the admin'}, approve the order, then capture it here.</p>{order ? <div className="mt-5"><div className={`rounded-xl px-3 py-2 text-xs font-bold ${order.mock ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-900'}`}>{order.mock ? 'Simulation fallback · no real PayPal order' : `PayPal sandbox order · ${order.id}`}</div><div className="mt-3 flex justify-between border-b border-amber-200 py-2 text-sm"><span>{admin?.name ?? 'Admin'} pays</span><b>{money(bookingTotal)}</b></div>{order.approveUrl && order.status !== 'COMPLETED' && <a href={order.approveUrl} target="_blank" rel="noreferrer" className="mt-4 block rounded-xl bg-[#0070ba] px-4 py-3 text-center text-sm font-bold text-white">Open admin PayPal approval</a>}{order.status === 'COMPLETED' ? <div className="mt-4 rounded-xl bg-moss px-3 py-3 text-sm font-bold text-white">{order.mock ? 'Admin payment simulation complete' : 'Admin sandbox payment captured'}</div> : <button disabled={busy} onClick={() => void capture()} className="mt-3 w-full rounded-xl bg-[#ffc439] px-4 py-3 text-sm font-bold">{order.mock ? 'Complete admin payment simulation' : 'Capture approved admin payment'}</button>}</div> : <button disabled={busy || !admin} onClick={() => void createOrder()} className="mt-6 w-full rounded-xl bg-[#ffc439] px-4 py-3 text-sm font-bold disabled:opacity-40"><CreditCard className="mr-2 inline" size={16} />Admin pays with PayPal sandbox</button>}</aside>
      </section>
      {order?.status === 'COMPLETED' && <section className="rounded-[28px] border border-stone-200 bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow text-moss">Step 2 · Reimbursement plan</p><h2 className="mt-1 text-2xl font-bold">Split the admin&apos;s advance.</h2><p className="mt-2 text-sm text-stone-500">These are amounts each friend owes toward the booking. They are not additional airline or hotel charges.</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${validSplit ? 'bg-emerald-100 text-moss' : 'bg-red-50 text-coral'}`}>{totalPercent.toFixed(2)}% of 100%</span></div><div className="mt-5 flex rounded-xl bg-stone-100 p-1"><button onClick={() => setView('admin')} className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${view === 'admin' ? 'bg-white shadow-sm' : 'text-stone-500'}`}>Admin split</button><button onClick={() => setView('traveler')} className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${view === 'traveler' ? 'bg-white shadow-sm' : 'text-stone-500'}`}>Traveler preview</button></div>{view === 'admin' ? <div className="mt-5 space-y-2">{trip.travelers.map((person) => <label key={person.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 px-3 py-3"><span className="text-sm font-semibold">{person.name}{person.id === admin?.id ? ' · admin' : ''}</span><span className="flex items-center gap-2"><input aria-label={`${person.name} reimbursement percentage`} type="number" min="0" max="100" step="0.01" value={shares[person.id] ?? 0} onChange={(event) => setShares({ ...shares, [person.id]: Number(event.target.value) })} className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-right" /><span className="text-xs text-stone-400">%</span><b className="w-24 text-right text-sm text-moss">{money(bookingTotal * (shares[person.id] ?? 0) / 100)}</b></span></label>)}<button onClick={() => setShares(equalShares())} className="text-xs font-bold text-moss">Reset to equal shares</button></div> : <div className="mt-5 rounded-2xl bg-[#f6fbf7] p-5"><p className="eyebrow text-moss">What {travelerPreview?.name} will receive</p><p className="mt-2 text-2xl font-bold">{money(bookingTotal * (shares[travelerPreview?.id ?? ''] ?? 0) / 100)}</p><p className="mt-2 text-sm text-stone-600">A private reimbursement request for their agreed part of the admin-paid booking. Sending links or SMS is intentionally not enabled yet.</p></div>}</section>}
      {order?.status === 'COMPLETED' && validSplit && <section className="rounded-[28px] border border-sky-200 bg-sky-50 p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow text-sky-800">Step 3 · Private PayPal requests</p><h2 className="mt-1 text-2xl font-bold">Ask each friend for only their share.</h2><p className="mt-2 text-sm text-sky-900/70">JourneyOS creates a separate sandbox approval link per friend. Copying prepares messages; it does not send real SMS.</p></div><button onClick={() => void copyFriendRequests()} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-sky-900 ring-1 ring-sky-200"><Copy className="mr-2 inline" size={15} />Copy payment messages</button></div><div className="mt-5 grid gap-3 lg:grid-cols-2">{trip.travelers.filter((person) => person.id !== admin?.id && (shares[person.id] ?? 0) > 0).map((person) => { const request = friendOrders[person.id]; const amount = bookingTotal * (shares[person.id] ?? 0) / 100; return <article key={person.id} className="rounded-2xl bg-white p-4 ring-1 ring-sky-100"><div className="flex items-start justify-between gap-3"><div><b>{person.name}</b><p className="mt-1 text-xs text-stone-500">Private booking reimbursement</p></div><b className="text-moss">{money(amount)}</b></div>{request ? <div className="mt-4"><p className="break-all rounded-lg bg-sky-50 p-2 text-[10px] text-sky-900">{request.approveUrl ?? `${request.mock ? 'Simulation' : 'PayPal'} order ${request.id}`}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{request.approveUrl && request.status !== 'COMPLETED' && <a href={request.approveUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-[#0070ba] px-3 py-2 text-center text-xs font-bold text-white"><Link2 className="mr-1 inline" size={13} />Open approval</a>}{request.status === 'COMPLETED' ? <span className="rounded-lg bg-moss px-3 py-2 text-center text-xs font-bold text-white">Reimbursed</span> : <button disabled={busy} onClick={() => void captureFriendRequest(person.id)} className="rounded-lg bg-[#ffc439] px-3 py-2 text-xs font-bold">Capture approval</button>}</div></div> : <button disabled={busy} onClick={() => void createFriendRequest(person.id)} className="mt-4 w-full rounded-lg bg-sky-800 px-3 py-2.5 text-xs font-bold text-white">Create {person.name}&apos;s PayPal link</button>}</article>; })}</div></section>}
      {order?.status === 'COMPLETED' && <section className="rounded-[24px] border border-stone-200 bg-white p-5"><div className="flex items-start gap-3"><Sparkles className="mt-1 text-moss" /><div><p className="eyebrow">Supplier fulfillment status</p><h3 className="mt-1 text-lg font-bold">Payment captured; Sabre ticketing is not submitted yet.</h3><p className="mt-2 text-sm leading-6 text-stone-600">A valid Sabre booking must use a freshly selected CERT offer/rate, opaque booking keys, and real traveler identity. The curated demo bundle does not contain those fields, so JourneyOS does not falsely show airline tickets or hotel confirmation numbers. PayPal funds remain in the JourneyOS sandbox merchant account until a real supplier-booking workflow is connected.</p></div></div></section>}
      <section className="rounded-[24px] border border-stone-200 bg-white p-5"><div className="flex items-start gap-3"><MapPinned className="mt-1 text-moss" /><div><p className="eyebrow">What happens later</p><h3 className="mt-1 text-lg font-bold">Shared expenses remain separate.</h3><p className="mt-2 text-sm leading-6 text-stone-600">Meals, rides and activity receipts go to Shared expenses. JourneyOS nets those receipts at trip end and never charges these flight-and-stay costs twice.</p></div></div></section>
    </>}
  </div>;
}

function LiveOfferList({ title, offers, empty }: { title: string; offers: LiveOffer[]; empty: string }) {
  return <div><p className="text-xs font-bold uppercase tracking-wide text-stone-500">{title}</p><div className="mt-2 space-y-2">{offers.length ? offers.map((offer) => <article key={offer.id} className="rounded-2xl border border-sky-200 bg-white p-4 text-sm"><span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-800">{offer.label}</span><div className="mt-3 flex flex-col justify-between gap-2 sm:flex-row"><div><b>{offer.title}</b><p className="mt-1 text-xs leading-5 text-stone-500">{offer.detail}</p></div><div className="shrink-0 sm:text-right"><b>{offer.price}</b>{offer.groupPrice && <p className="mt-1 text-xs font-semibold text-moss">{offer.groupPrice}</p>}</div></div><p className="mt-3 border-t border-sky-100 pt-3 text-[10px] font-bold uppercase tracking-wide text-stone-400">{offer.source} · recheck before booking</p></article>) : <p className="rounded-xl bg-white p-3 text-sm text-stone-500">{empty}</p>}</div></div>;
}
