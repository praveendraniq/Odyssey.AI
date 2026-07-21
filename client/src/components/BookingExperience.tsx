import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, Copy, CreditCard, Hotel, Link2, MapPinned, Plane, Sparkles } from 'lucide-react';
import { api } from '../api';
import type { Flight, Hotel as HotelType, PaymentOrder, Trip } from '../types';
import { VocalBridgeProvider, useAgentActions, useTranscript, useVocalBridge } from '@vocalbridgeai/react';

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const displayDate = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const plusDays = (value: string, days: number) => { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
const airportCode = (place: string) => {
  const normalized = place.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : '';
};

type BundleId = 'value' | 'overall' | 'neighborhood';
type LiveOffer = { id: string; label: string; title: string; detail: string; price: string; source: string; groupPrice?: string; total?: number; raw: Record<string, unknown> };
type LiveBundle = { id: string; label: string; reason: string; flight: LiveOffer; hotel: LiveOffer; total: number };
type Bundle = { id: BundleId; label: string; title: string; reason: string; flight: Flight; hotel: HotelType; secondHotel?: HotelType; hotelTotal: number; total: number; staySummary: string };
type CertFulfillmentState = { status: 'idle' | 'revalidating' | 'ready' | 'creating' | 'pending' | 'confirmed' | 'error'; message: string; revalidationId?: string; booking?: { bookingId: string; reference: string } };
type CertTraveler = { firstName: string; lastName: string; email: string; phone: string };

const mcpContent = (value: unknown) => {
  const texts = (value as { content?: Array<{ text?: string }> })?.content?.map((item) => item.text).filter((text): text is string => Boolean(text)) ?? [];
  for (const text of texts) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (Array.isArray(parsed.offers) || Array.isArray(parsed.hotels)) return parsed;
    } catch { /* Continue: MCP may include a prose content block before JSON. */ }
  }
  return {} as Record<string, unknown>;
};

const carrierNames: Record<string, string> = {
  AA: 'American Airlines', AS: 'Alaska Airlines', B6: 'JetBlue', DL: 'Delta Air Lines', UA: 'United Airlines', WN: 'Southwest Airlines',
  AC: 'Air Canada', BA: 'British Airways', CX: 'Cathay Pacific', EK: 'Emirates', EY: 'Etihad Airways', JL: 'Japan Airlines', KE: 'Korean Air',
  LH: 'Lufthansa', NH: 'All Nippon Airways', QF: 'Qantas', QR: 'Qatar Airways', SQ: 'Singapore Airlines', TK: 'Turkish Airlines', VS: 'Virgin Atlantic',
};

type SabreFlightRecord = { id?: string; marketingAirlineCode?: string; marketingFlightNumber?: string | number; operatingAirlineCode?: string; operatingFlightNumber?: string | number };
type SabreJourney = { id?: string; flightRefs?: string[]; requestedJourneyIndex?: number };
type SabreFlightData = { flights?: SabreFlightRecord[]; journeys?: SabreJourney[]; offers?: unknown[] };

const flightIdentity = (offer: unknown, flightData?: SabreFlightData) => {
  // Skills MCP returns the carrier on the flight referenced by an offer's
  // journeyRefs—not on the offer itself. Resolve that relationship first.
  const offerRecord = offer as { journeyRefs?: string[]; items?: Array<{ fares?: Array<{ validatingAirlineCode?: string }> }> };
  const referencedJourneys = (flightData?.journeys ?? [])
    .filter((journey) => offerRecord.journeyRefs?.includes(journey.id ?? ''))
    .sort((left, right) => (left.requestedJourneyIndex ?? 99) - (right.requestedJourneyIndex ?? 99));
  const outboundFlightRef = referencedJourneys[0]?.flightRefs?.[0];
  const referencedFlight = (flightData?.flights ?? []).find((flight) => flight.id === outboundFlightRef);
  const referencedCode = referencedFlight?.marketingAirlineCode ?? referencedFlight?.operatingAirlineCode;
  const referencedFlightNumber = referencedFlight?.marketingFlightNumber ?? referencedFlight?.operatingFlightNumber;
  const validatingCode = offerRecord.items?.[0]?.fares?.[0]?.validatingAirlineCode;
  const json = JSON.stringify(offer);
  const directName = json.match(/"(?:marketingAirlineName|marketingCarrierName|operatingCarrierName|validatingCarrierName|carrierName|airlineName)"\s*:\s*"([^"\\]{2,100})"/i)?.[1];
  const nestedName = json.match(/"(?:marketingCarrier|operatingCarrier|validatingCarrier|carrier|airline)"\s*:\s*\{[^{}]{0,800}?"(?:name|carrierName|airlineName)"\s*:\s*"([^"\\]{2,100})"/i)?.[1];
  const directCarrier = json.match(/"(?:marketingAirlineCode|marketingCarrierCode|operatingCarrierCode|validatingCarrierCode|carrierCode|airlineCode|marketingCarrier|operatingCarrier|validatingCarrier)"\s*:\s*"([A-Z0-9]{2,3})"/i)?.[1];
  const nestedCarrier = json.match(/"(?:marketingCarrier|operatingCarrier|validatingCarrier|carrier|airline)"\s*:\s*\{[^{}]{0,800}?"(?:code|carrierCode|airlineCode|iataCode)"\s*:\s*"([A-Z0-9]{2,3})"/i)?.[1];
  const code = (referencedCode ?? directCarrier ?? nestedCarrier ?? validatingCode)?.toUpperCase();
  const flightNumber = referencedFlightNumber?.toString() ?? json.match(/"(?:flightNumber|marketingFlightNumber|number)"\s*:\s*"?(\d{1,4})"?/i)?.[1];
  return { carrier: directName ?? nestedName ?? (code ? carrierNames[code] ?? `Airline ${code}` : 'Carrier name unavailable'), code, flightNumber };
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

export function BookingExperience({ trip, onTrip, autoSearchRun = 0 }: { trip: Trip; onTrip: (trip: Trip, note: string) => void; autoSearchRun?: number }) {
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
  const [sabreConfirmation, setSabreConfirmation] = useState<{ origin: string; destination: string } | null>(null);
  const [liveOffers, setLiveOffers] = useState<{ flights: LiveOffer[]; hotels: LiveOffer[] }>({ flights: [], hotels: [] });
  const [liveBundleId, setLiveBundleId] = useState<string | null>(null);
  const [certFulfillment, setCertFulfillment] = useState<CertFulfillmentState>({ status: 'idle', message: '' });
  const [certTraveler, setCertTraveler] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [certAcknowledged, setCertAcknowledged] = useState(false);
  const [paymentCaptureMessage, setPaymentCaptureMessage] = useState('');
  const fulfillmentSectionRef = useRef<HTMLElement | null>(null);
  const completedAutoSearchRun = useRef(0);
  const initialSearchStarted = useRef(false);
  const [details, setDetails] = useState({ origin: trip.request.origin ?? 'San Francisco', destination: trip.request.destination, departureDate: trip.request.departureDate ?? '2026-10-12', returnDate: trip.request.returnDate ?? '2026-10-16' });

  const equalShares = () => {
    const count = Math.max(1, trip.travelers.length);
    const base = Number((100 / count).toFixed(2));
    const finalShare = Number((100 - base * (count - 1)).toFixed(2));
    return Object.fromEntries(trip.travelers.map((person, index) => [person.id, index === count - 1 ? finalShare : base]));
  };
  const [shares, setShares] = useState<Record<string, number>>(equalShares);
  useEffect(() => {
    setShares(equalShares());
    setConfirmed(false);
    setOrder(null);
    setFriendOrders({});
    // Sabre prices are searched for a specific passenger count. Do not show a
    // previous live result after the group, route, or travel dates change.
    setLiveOffers({ flights: [], hotels: [] });
    setLiveBundleId(null);
    setCertFulfillment({ status: 'idle', message: '' });
    setCertAcknowledged(false);
    setPaymentCaptureMessage('');
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
  const liveBundles = useMemo<LiveBundle[]>(() => {
    const pairs = liveOffers.flights.flatMap((flight) => liveOffers.hotels.map((hotel) => ({ flight, hotel, total: (flight.total ?? 0) + (hotel.total ?? 0) })))
      .filter((pair) => pair.flight.total !== undefined && pair.hotel.total !== undefined)
      .sort((left, right) => left.total - right.total);
    if (!pairs.length) return [];
    const candidates = [pairs[0], pairs.find((pair) => /best schedule/i.test(pair.flight.label)) ?? pairs[1], pairs.find((pair) => /flexible/i.test(pair.flight.label)) ?? pairs[pairs.length - 1]];
    const selected = candidates.filter((pair): pair is NonNullable<typeof pair> => Boolean(pair)).filter((pair, index, all) => all.findIndex((candidate) => candidate.flight.id === pair.flight.id && candidate.hotel.id === pair.hotel.id) === index);
    const labels = ['Lowest live total', 'Best live schedule', 'Flexible live option'];
    const reasons = ['Lowest combined Sabre CERT flight and hotel total.', 'Balances Sabre’s best-schedule flight with a live hotel rate.', 'Keeps a different live flight or stay alternative available.'];
    return selected.slice(0, 3).map((pair, index) => ({ id: `${pair.flight.id}-${pair.hotel.id}`, label: labels[index], reason: reasons[index], ...pair }));
  }, [liveOffers]);
  const selectedLiveBundle = liveBundles.find((bundle) => bundle.id === liveBundleId);
  const bookingTotal = selectedLiveBundle?.total ?? selectedBundle?.total ?? trip.budget.flight + trip.budget.hotel;
  const fulfillmentFlight = selectedLiveBundle
    ? { title: selectedLiveBundle.flight.title, detail: selectedLiveBundle.flight.detail }
    : { title: `${selectedBundle?.flight.airline ?? 'Selected airline'} ${selectedBundle?.flight.code ?? ''}`.trim(), detail: `${selectedBundle?.flight.departure ?? details.origin} → ${selectedBundle?.flight.arrival ?? details.destination} · ${displayDate(details.departureDate)}–${displayDate(details.returnDate)}` };
  const fulfillmentHotel = selectedLiveBundle
    ? { title: selectedLiveBundle.hotel.title, detail: selectedLiveBundle.hotel.detail }
    : { title: selectedBundle?.hotel.name ?? selectedHotel?.name ?? 'Selected stay', detail: `${selectedBundle?.staySummary ?? `${nights} nights`} · check-in ${displayDate(arrivalDate)} · check-out ${displayDate(details.returnDate)}` };
  const totalPercent = Object.values(shares).reduce((sum, value) => sum + value, 0);
  // A prior persisted demo can contain 33.33 × 3 = 99.99. Treat that
  // one-hundredth rounding difference as valid; new equal splits total 100%.
  const validSplit = Math.abs(totalPercent - 100) <= 0.01;
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
      const response = await api.captureOrder(order.id);
      setOrder(response.order);
      if (response.order.status === 'COMPLETED') {
        setPaymentCaptureMessage('Admin payment captured. Supplier fulfillment and CERT test-booking controls are ready below.');
        window.setTimeout(() => fulfillmentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      } else {
        setPaymentCaptureMessage(`Payment capture returned ${response.order.status}; supplier fulfillment remains locked until the order is completed.`);
      }
      onTrip(trip, response.order.mock ? 'Admin payment simulation completed; no real money moved.' : `${admin?.name ?? 'Admin'} paid the booking total in PayPal sandbox. Reimbursement shares are now ready.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not capture payment.';
      setPaymentCaptureMessage(`${message} The supplier fulfillment card appears only after PayPal capture succeeds.`);
      onTrip(trip, message);
    }
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

  const createAllFriendRequests = async () => {
    const friends = trip.travelers.filter((person) => person.id !== admin?.id && (shares[person.id] ?? 0) > 0);
    if (!friends.length) return;
    setBusy(true);
    try {
      const created: Record<string, PaymentOrder> = {};
      for (const friend of friends) {
        const amount = bookingTotal * (shares[friend.id] ?? 0) / 100;
        const percentages = Object.fromEntries(trip.travelers.map((person) => [person.id, person.id === friend.id ? 100 : 0]));
        const response = await api.createOrder(percentages, amount);
        created[friend.id] = response.order;
      }
      setFriendOrders((current) => ({ ...current, ...created }));
      onTrip(trip, `Payment requests prepared for ${friends.map((friend) => friend.name).join(' and ')}. Messages are ready to copy; nothing was sent automatically.`);
    } catch (error) { onTrip(trip, error instanceof Error ? error.message : 'Could not prepare the friend payment requests.'); }
    finally { setBusy(false); }
  };

  const loadSabreOffers = async (requested?: { origin?: string; destination?: string }, confirmed = false) => {
    const suggestedOrigin = airportCode(selectedFlight?.departure ?? '');
    const suggestedDestination = airportCode(selectedFlight?.arrival ?? '');
    let origin = airportCode(requested?.origin ?? details.origin) || suggestedOrigin;
    let destination = airportCode(requested?.destination ?? details.destination) || suggestedDestination;
    if (!origin || !destination || origin === destination) {
      const entered = window.prompt('Confirm or edit the origin and destination IATA codes, separated by a comma.', `${suggestedOrigin || origin || ''}, ${suggestedDestination || destination || ''}`);
      const [enteredOrigin = '', enteredDestination = ''] = (entered ?? '').split(',').map((value) => value.trim());
      origin = airportCode(enteredOrigin); destination = airportCode(enteredDestination);
      if (!origin || !destination) { setSabreStatus('error'); setSabreNote('Sabre CERT requires three-letter IATA airport or city codes. Odyssey does not guess airport codes from city names.'); return; }
    }
    if (!confirmed) { setSabreConfirmation({ origin, destination }); return; }
    setSabreConfirmation(null);
    setDetails((current) => ({ ...current, origin, destination }));
    setSabreStatus('loading'); setSabreNote('');
    try {
      const travelerCount = Math.max(1, trip.travelers.length);
      const response = await api.searchSabreLive({ origin, destination, departureDate: details.departureDate, returnDate: details.returnDate, adults: travelerCount });
      const flightData = mcpContent(response.results.flights) as SabreFlightData; const hotelData = mcpContent(response.results.hotels);
      const labels = ['Lowest live fare', 'Best schedule', 'Flexible option'];
      const flights = Array.isArray(flightData.offers) ? flightData.offers.slice(0, 3).map((offer, index) => {
        const value = offer as { id?: string; totalPrice?: { amount?: string; currencyCode?: string }; source?: { distributionModel?: string } };
        const { carrier, code: carrierCode, flightNumber } = flightIdentity(offer, flightData);
        const groupAmount = value.totalPrice?.amount ? Number(value.totalPrice.amount) : undefined;
        const perTraveler = Number.isFinite(groupAmount) && groupAmount ? groupAmount / travelerCount : undefined;
        return { id: value.id ?? `flight-${index}`, label: labels[index] ?? 'Live alternative', title: `${carrier}${flightNumber ? ` ${carrierCode ?? ''}${flightNumber}` : ''} · ${origin} to ${destination}`, detail: `${displayDate(details.departureDate)} to ${displayDate(details.returnDate)} · ${travelerCount} travelers`, price: perTraveler ? `${value.totalPrice?.currencyCode ?? 'USD'} ${perTraveler.toFixed(2)} each` : 'Price on selection', groupPrice: groupAmount ? `${value.totalPrice?.currencyCode ?? 'USD'} ${groupAmount.toFixed(2)} group total` : undefined, total: Number.isFinite(groupAmount) ? groupAmount : undefined, source: value.source?.distributionModel ? `Sabre CERT · ${value.source.distributionModel}` : 'Live Sabre CERT', raw: value as Record<string, unknown> };
      }) : [];
      const hotels = Array.isArray(hotelData.hotels) ? hotelData.hotels.slice(0, 3).map((item, index) => {
        const value = item as { hotel?: { hotelCode?: string; hotelName?: string; address?: { cityName?: string } }; rateDetails?: { approxTotalPrice?: number; currencyCode?: string } };
        const total = value.rateDetails?.approxTotalPrice ? Number(value.rateDetails.approxTotalPrice) : undefined;
        return { id: value.hotel?.hotelCode ?? `hotel-${index}`, label: index === 0 ? 'Live stay match' : 'Live alternative', title: value.hotel?.hotelName ?? `Hotel option ${index + 1}`, detail: `${value.hotel?.address?.cityName ?? destination} · ${displayDate(arrivalDate)} to ${displayDate(details.returnDate)} · ${nights} nights`, price: total ? `${value.rateDetails?.currencyCode ?? 'USD'} ${total} stay total` : 'Rate on selection', total: Number.isFinite(total) ? total : undefined, source: 'Live Sabre CERT hotel rate', raw: value as Record<string, unknown> };
      }) : [];
      setLiveOffers({ flights, hotels }); setLiveBundleId(null); setCertFulfillment({ status: 'idle', message: '' }); setCertAcknowledged(false); setSabreStatus('ready');
      setSabreNote(`Sabre CERT results for ${origin} → ${destination}. This is certification/sandbox inventory, not production ticketing. American Airlines appears here only when Sabre returns an AA itinerary; the AA bundle above is curated demo inventory.`);
    } catch (error) { setSabreStatus('error'); setSabreNote(error instanceof Error ? error.message : 'Sabre CERT search could not be completed.'); }
  };

  const revalidateCertBooking = async () => {
    if (!selectedLiveBundle) return;
    const origin = airportCode(details.origin);
    const destination = airportCode(details.destination);
    if (!origin || !destination) { setCertFulfillment({ status: 'error', message: 'The live offer is missing valid IATA codes. Refresh Sabre inventory and select the bundle again.' }); return; }
    setCertFulfillment({ status: 'revalidating', message: 'Checking the selected flight offer and hotel rate again with Sabre CERT…' });
    try {
      const response = await api.revalidateSabreBooking({
        origin, destination, departureDate: details.departureDate, returnDate: details.returnDate, adults: Math.max(1, trip.travelers.length),
        flightOffer: selectedLiveBundle.flight.raw, hotelRate: selectedLiveBundle.hotel.raw,
        display: { flight: fulfillmentFlight, hotel: fulfillmentHotel },
      });
      setCertFulfillment({ status: 'ready', message: response.message, revalidationId: response.revalidationId });
      onTrip(trip, 'Sabre CERT returned a fresh matching flight offer and hotel rate. A test booking can now be submitted only with explicit confirmation.');
    } catch (error) { setCertFulfillment({ status: 'error', message: error instanceof Error ? error.message : 'Sabre CERT could not revalidate this selection.' }); }
  };

  const createCertTestBooking = async () => {
    if (!certFulfillment.revalidationId || !certAcknowledged) return;
    if (!certTraveler.firstName.trim() || !certTraveler.lastName.trim() || !certTraveler.email.trim() || !certTraveler.phone.trim()) {
      setCertFulfillment((current) => ({ ...current, status: 'error', message: 'Enter test traveler first name, last name, email, and phone before submitting the CERT request.' }));
      return;
    }
    setCertFulfillment({ status: 'creating', message: 'Submitting the explicit Sabre CERT test-booking request…', revalidationId: certFulfillment.revalidationId });
    try {
      const response = await api.createSabreCertBooking({ revalidationId: certFulfillment.revalidationId, traveler: certTraveler, display: { flight: fulfillmentFlight, hotel: fulfillmentHotel } });
      if (response.status === 'confirmed' && response.booking) {
        setCertFulfillment({ status: 'confirmed', message: response.message, booking: response.booking });
        onTrip(trip, `Sabre CERT returned test reference ${response.booking.reference}. Odyssey generated a clearly labelled CERT test confirmation PDF.`);
      } else {
        setCertFulfillment({ status: 'pending', message: response.message });
        onTrip(trip, 'Sabre did not return a PNR or booking reference. Payment remains recorded and supplier fulfillment is pending.');
      }
    } catch (error) { setCertFulfillment((current) => ({ ...current, status: 'error', message: error instanceof Error ? error.message : 'Sabre CERT did not create a test booking.' })); }
  };

  useEffect(() => onAction('search_live_sabre', (payload) => {
    const origin = typeof payload.origin === 'string' ? payload.origin : undefined;
    const destination = typeof payload.destination === 'string' ? payload.destination : undefined;
    void loadSabreOffers({ origin, destination });
  }), [onAction, selectedFlight, trip, details]);

  useEffect(() => {
    if (!autoSearchRun || completedAutoSearchRun.current === autoSearchRun) return;
    completedAutoSearchRun.current = autoSearchRun;
    initialSearchStarted.current = true;
    // The admin's Plan-page confirmation is the explicit approval to make the
    // required CERT inventory check, so do not show a second confirmation.
    void loadSabreOffers(undefined, true);
  }, [autoSearchRun]);

  useEffect(() => {
    if (initialSearchStarted.current) return;
    initialSearchStarted.current = true;
    // Opening Booking is itself an admin review of the confirmed route. Start
    // the required CERT search immediately instead of waiting for a click.
    void loadSabreOffers(undefined, true);
  }, []);

  return <div className="space-y-6 pb-32">
    <section className="rounded-[32px] bg-ink px-6 py-7 text-white sm:px-8"><p className="eyebrow text-emerald-200">Book, pay & reimburse</p><h1 className="mt-1 font-display text-3xl sm:text-4xl">Pick one clear trip bundle.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">The trip admin pays the confirmed booking once. Odyssey then calculates each friend&apos;s reimbursement without charging the booking twice.</p></section>
    <BookingAgentVoice
      trip={trip}
      selectedFlight={fulfillmentFlight}
      selectedHotel={fulfillmentHotel}
      bookingTotal={bookingTotal}
      onSelectBundle={(id) => { const bundle = bundles.find((item) => item.id === id); if (bundle) void chooseBundle(bundle); }}
      onConfirm={() => { if (selectedLiveBundle || selectedBundle) { setConfirmed(true); setStage('payment'); } }}
      onCollectPayment={() => { if (selectedLiveBundle || selectedBundle) { setConfirmed(true); setStage('payment'); void createOrder(); } }}
    />
    <nav className="grid overflow-hidden rounded-[22px] border border-stone-200 bg-white sm:grid-cols-2"><button onClick={() => setStage('review')} className={`px-5 py-4 text-left font-bold ${stage === 'review' ? 'bg-[#eff6f1] text-moss' : 'text-stone-500'}`}>1. Choose a bundle</button><button onClick={() => confirmed && setStage('payment')} className={`border-t border-stone-200 px-5 py-4 text-left font-bold sm:border-l sm:border-t-0 ${stage === 'payment' ? 'bg-[#fff8e9] text-ink' : 'text-stone-500'} ${!confirmed ? 'opacity-50' : ''}`}>2. Admin pays, then split</button></nav>

    {stage === 'review' ? <>
      <section className="rounded-[28px] border border-stone-200 bg-white p-5"><div className="flex items-center gap-3"><CalendarDays className="text-moss" /><div><p className="eyebrow">Exact travel window</p><h2 className="mt-1 text-xl font-bold">{displayDate(details.departureDate)} → {displayDate(details.returnDate)}</h2><p className="mt-1 text-sm text-stone-500">{details.origin} to {details.destination} · arrival {displayDate(arrivalDate)} · {nights} hotel nights</p></div></div></section>
      {sabreStatus === 'error' && <section><div><p className="eyebrow text-moss">Fallback packages · curated demo inventory</p><h2 className="mt-1 text-2xl font-bold text-ink">Three understandable backup choices</h2><p className="mt-2 text-sm text-stone-600">Live CERT inventory was unavailable, so these destination-aware demo packages remain available while you refresh the Sabre check.</p></div><div className="mt-4 grid gap-4 xl:grid-cols-3">{bundles.map((bundle) => <button key={bundle.id} disabled={busy} onClick={() => void chooseBundle(bundle)} className={`flex h-full flex-col rounded-[24px] border p-5 text-left transition ${bundleId === bundle.id ? 'border-moss bg-[#eff6f1] ring-2 ring-moss/10' : 'border-stone-200 bg-white hover:border-moss/40'}`}><div className="flex items-center justify-between gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${bundle.id === 'overall' ? 'bg-moss text-white' : 'bg-stone-100 text-stone-600'}`}>{bundle.label}</span>{bundleId === bundle.id && <CheckCircle2 size={18} className="text-moss" />}</div><h3 className="mt-4 text-xl font-bold text-ink">{bundle.title}</h3><p className="mt-2 min-h-[44px] text-sm leading-5 text-stone-600">{bundle.reason}</p><div className="mt-4 space-y-3 rounded-2xl bg-white/75 p-4"><div className="flex gap-2"><Plane size={17} className="mt-0.5 shrink-0 text-moss" /><div><b className="text-sm">{bundle.flight.airline} {bundle.flight.code}</b><p className="text-xs text-stone-500">{bundle.flight.departure} {bundle.flight.departureTime} → {bundle.flight.arrival} {bundle.flight.arrivalTime}</p></div></div><div className="flex gap-2"><Hotel size={17} className="mt-0.5 shrink-0 text-coral" /><div><b className="text-sm">{bundle.staySummary}</b><p className="text-xs text-stone-500">All {nights} nights covered</p></div></div></div><div className="mt-auto pt-5"><b className="text-2xl text-ink">{money(bundle.total)}</b><p className="text-xs text-stone-500">flight + stays · group total</p></div></button>)}</div></section>}
      <section className="rounded-[28px] border border-sky-200 bg-sky-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow text-sky-800">Required Sabre CERT check</p><h2 className="mt-1 text-lg font-bold">Sabre live inventory</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-sky-900/70">This search starts automatically when Booking opens. The three best live flight-and-stay combinations appear below; refresh rechecks Sabre CERT for the same dates. Results are reference-only until revalidated for booking.</p></div><button disabled={sabreStatus === 'loading'} onClick={() => void loadSabreOffers(undefined, true)} className="rounded-xl bg-sky-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{sabreStatus === 'loading' ? 'Checking Sabre CERT…' : 'Refresh Sabre bundle price'}</button></div>
        {sabreConfirmation && <div role="status" className="mt-4 rounded-2xl border border-sky-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-sky-800">Ready to search Sabre CERT</p><h3 className="mt-1 text-lg font-bold text-ink">Search live inventory for {sabreConfirmation.origin} → {sabreConfirmation.destination}?</h3><p className="mt-1 text-xs leading-5 text-stone-600">This checks certification inventory only. It will not select or book an offer.</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void loadSabreOffers(sabreConfirmation, true)} className="rounded-xl bg-sky-800 px-4 py-2.5 text-sm font-bold text-white">Search Sabre CERT</button><button onClick={() => setSabreConfirmation(null)} className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold text-stone-600">Not now</button></div></div>}
        {sabreStatus !== 'idle' && <p className={`mt-3 text-sm font-semibold ${sabreStatus === 'ready' ? 'text-moss' : sabreStatus === 'error' ? 'text-coral' : 'text-stone-600'}`}>{sabreNote}</p>}
        {sabreStatus === 'ready' && <>{liveBundles.length > 0 && <div className="mt-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow text-sky-800">Live Sabre CERT bundles</p><h3 className="mt-1 text-lg font-bold text-ink">Three clear choices from live inventory</h3><p className="mt-1 text-xs leading-5 text-stone-600">These totals combine the returned flight and hotel offers. Select one to review; revalidation is required before any supplier booking.</p></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-sky-800">{liveBundles.length} live options</span></div><div className="mt-4 grid gap-4 xl:grid-cols-3">{liveBundles.map((bundle) => <button key={bundle.id} onClick={() => { setLiveBundleId(bundle.id); setCertFulfillment({ status: 'idle', message: '' }); setCertAcknowledged(false); onTrip(trip, `${bundle.label} selected for review. Sabre CERT offer keys must be revalidated before booking.`); }} className={`flex h-full flex-col rounded-[24px] border p-5 text-left transition ${liveBundleId === bundle.id ? 'border-sky-700 bg-sky-50 ring-2 ring-sky-200' : 'border-sky-200 bg-white hover:border-sky-500'}`}><div className="flex items-center justify-between gap-2"><span className="rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-800">{bundle.label}</span>{liveBundleId === bundle.id && <CheckCircle2 size={18} className="text-sky-800" />}</div><h4 className="mt-4 text-xl font-bold text-ink">{bundle.label}</h4><p className="mt-2 min-h-[44px] text-sm leading-5 text-stone-600">{bundle.reason}</p><div className="mt-4 space-y-3 rounded-2xl bg-white/80 p-4"><div className="flex gap-2"><Plane size={17} className="mt-0.5 shrink-0 text-sky-800" /><div><b className="text-sm text-ink">{bundle.flight.title}</b><p className="mt-1 text-xs text-stone-500">{bundle.flight.detail}</p></div></div><div className="flex gap-2"><Hotel size={17} className="mt-0.5 shrink-0 text-coral" /><div><b className="text-sm text-ink">{bundle.hotel.title}</b><p className="mt-1 text-xs text-stone-500">{bundle.hotel.detail}</p></div></div></div><div className="mt-auto pt-5"><b className="text-2xl text-ink">{money(bundle.total)}</b><p className="text-xs text-stone-500">live flight + stay · group total</p><p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-sky-800">Sabre CERT · recheck before booking</p></div></button>)}</div></div>}<div className="mt-5 grid gap-4 lg:grid-cols-2"><LiveOfferList title="Sabre CERT round-trip flight references" offers={liveOffers.flights} empty="No certification flights returned for this window." /><LiveOfferList title={`Sabre CERT stay references · ${nights} nights`} offers={liveOffers.hotels} empty="No certification hotels returned for these dates." /></div></>}
      </section>
      <section className="flex flex-col justify-between gap-4 rounded-[28px] bg-[#eff6f1] p-6 sm:flex-row sm:items-center"><div><p className="eyebrow text-moss">Admin confirmation</p><h2 className="mt-1 text-2xl font-bold">{selectedLiveBundle ? `Confirm ${selectedLiveBundle.label}` : 'Choose one live Sabre option'}</h2><p className="mt-2 text-sm text-stone-600">{selectedLiveBundle ? `${selectedLiveBundle.flight.title} plus ${selectedLiveBundle.hotel.title} · ${money(bookingTotal)} group total.` : 'Select one of the returned live flight-and-stay options before continuing to payment.'}</p></div><button disabled={!selectedLiveBundle} onClick={() => { setConfirmed(true); setStage('payment'); }} className="rounded-xl bg-moss px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 className="mr-2 inline" size={16} />Confirm & open admin payment</button></section>
    </> : <>
      <section className="grid gap-6 xl:grid-cols-[1fr_0.75fr]">
        <div className="rounded-[28px] border border-stone-200 bg-white p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Step 1 · Admin advance</p><h2 className="mt-1 text-2xl font-bold">{admin?.name ?? 'Admin'} pays {money(bookingTotal)}</h2><p className="mt-2 text-sm text-stone-500">One payment covers the selected flight and every overnight stay. Reimbursement shares are calculated only after this succeeds.</p></div><button onClick={() => setStage('review')} className="text-xs font-bold text-moss">Edit bundle</button></div>
          <div className="mt-5 space-y-3 rounded-2xl bg-[#f6fbf7] p-5 text-sm"><div className="flex justify-between gap-3"><span className="text-stone-500">Flight</span><b className="text-right">{fulfillmentFlight.title}</b></div><div className="flex justify-between gap-3"><span className="text-stone-500">Stays</span><b className="text-right">{fulfillmentHotel.title}</b></div><div className="flex justify-between gap-3 border-t border-moss/10 pt-3"><span className="font-bold">Admin pays now</span><b className="text-moss">{money(bookingTotal)}</b></div></div>
          <p className="mt-4 text-xs leading-5 text-stone-500">PayPal collects the sandbox payment into Odyssey&apos;s merchant account. Sabre shopping and supplier booking remain separate integration steps; this checkout does not automatically distribute money to an airline or hotel.</p>
        </div>
        <aside className="rounded-[28px] bg-[#fff8e9] p-6"><div className="flex items-center gap-2"><CreditCard className="text-[#0070ba]" /><p className="eyebrow text-[#0070ba]">PayPal sandbox · admin payment</p></div><h2 className="mt-2 text-2xl font-bold">Pay the booking total once.</h2><p className="mt-3 text-sm leading-6 text-stone-600">Sign in with the Personal sandbox buyer account representing {admin?.name ?? 'the admin'}, approve the order, then capture it here.</p>{order ? <div className="mt-5"><div className={`rounded-xl px-3 py-2 text-xs font-bold ${order.mock ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-900'}`}>{order.mock ? 'Simulation fallback · no real PayPal order' : `PayPal sandbox order · ${order.id}`}</div><div className="mt-3 flex justify-between border-b border-amber-200 py-2 text-sm"><span>{admin?.name ?? 'Admin'} pays</span><b>{money(bookingTotal)}</b></div>{order.approveUrl && order.status !== 'COMPLETED' && <a href={order.approveUrl} target="_blank" rel="noreferrer" className="mt-4 block rounded-xl bg-[#0070ba] px-4 py-3 text-center text-sm font-bold text-white">Open admin PayPal approval</a>}{order.status === 'COMPLETED' ? <div className="mt-4 rounded-xl bg-moss px-3 py-3 text-sm font-bold text-white">{order.mock ? 'Admin payment simulation complete' : 'Admin sandbox payment captured'}</div> : <button disabled={busy} onClick={() => void capture()} className="mt-3 w-full rounded-xl bg-[#ffc439] px-4 py-3 text-sm font-bold">{order.mock ? 'Complete admin payment simulation' : 'Capture approved admin payment'}</button>}{paymentCaptureMessage && <p className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${order.status === 'COMPLETED' ? 'bg-emerald-100 text-moss' : 'bg-amber-100 text-amber-900'}`}>{paymentCaptureMessage}</p>}</div> : <button disabled={busy || !admin} onClick={() => void createOrder()} className="mt-6 w-full rounded-xl bg-[#ffc439] px-4 py-3 text-sm font-bold disabled:opacity-40"><CreditCard className="mr-2 inline" size={16} />Admin pays with PayPal sandbox</button>}</aside>
      </section>
      {order?.status === 'COMPLETED' && <section ref={fulfillmentSectionRef} className="scroll-mt-6 rounded-[28px] border border-moss/20 bg-[#f6fbf7] p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow text-moss">Payment recorded · supplier fulfillment pending</p><h2 className="mt-1 text-2xl font-bold text-ink">Your selected trip is ready for supplier booking.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">Odyssey has recorded the selected flight and stay with the admin&apos;s payment status. It has not submitted a Sabre airline ticket or hotel reservation.</p></div><span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900">Not supplier-confirmed</span></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2"><article className="rounded-2xl bg-white p-5 ring-1 ring-moss/10"><div className="flex gap-3"><Plane className="mt-0.5 shrink-0 text-moss" size={20} /><div><p className="text-xs font-bold uppercase tracking-wide text-stone-500">Selected flight</p><h3 className="mt-1 font-bold text-ink">{fulfillmentFlight.title}</h3><p className="mt-2 text-sm leading-6 text-stone-600">{fulfillmentFlight.detail}</p><p className="mt-3 text-xs font-semibold text-stone-500">Status: selected for Sabre revalidation and booking</p></div></div></article><article className="rounded-2xl bg-white p-5 ring-1 ring-moss/10"><div className="flex gap-3"><Hotel className="mt-0.5 shrink-0 text-coral" size={20} /><div><p className="text-xs font-bold uppercase tracking-wide text-stone-500">Selected hotel</p><h3 className="mt-1 font-bold text-ink">{fulfillmentHotel.title}</h3><p className="mt-2 text-sm leading-6 text-stone-600">{fulfillmentHotel.detail}</p><p className="mt-3 text-xs font-semibold text-stone-500">Stay: {displayDate(arrivalDate)}–{displayDate(details.returnDate)} · rate recheck required</p></div></div></article></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-2xl border border-sky-100 bg-sky-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-sky-800">Payment</p><p className="mt-2 text-sm font-semibold text-ink">{order.mock ? 'Admin advance payment simulated in Odyssey; no money moved.' : 'Admin advance paid to Odyssey via PayPal Sandbox.'}</p><p className="mt-1 text-xs leading-5 text-stone-600">The payment is not distributed to an airline or hotel by this checkout.</p></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-amber-800">Supplier fulfillment</p><p className="mt-2 text-sm font-semibold text-ink">Pending — Sabre booking not yet submitted.</p><p className="mt-1 text-xs leading-5 text-stone-600">A fresh Sabre offer/rate, traveler identity, and supplier-booking workflow are required before confirmation numbers exist.</p></div></div>
      </section>}
      {order?.status === 'COMPLETED' && <CertTestBookingCard
        selectedLiveBundle={selectedLiveBundle}
        fulfillment={certFulfillment}
        traveler={certTraveler}
        acknowledged={certAcknowledged}
        busy={busy}
        onTravelerChange={(patch) => setCertTraveler((current) => ({ ...current, ...patch }))}
        onAcknowledgedChange={setCertAcknowledged}
        onRevalidate={() => void revalidateCertBooking()}
        onCreate={() => void createCertTestBooking()}
      />}
      {order?.status === 'COMPLETED' && <section className="rounded-[28px] border border-stone-200 bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow text-moss">Step 2 · Reimbursement plan</p><h2 className="mt-1 text-2xl font-bold">Split the admin&apos;s advance.</h2><p className="mt-2 text-sm text-stone-500">These are amounts each friend owes toward the booking. They are not additional airline or hotel charges.</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${validSplit ? 'bg-emerald-100 text-moss' : 'bg-red-50 text-coral'}`}>{totalPercent.toFixed(2)}% of 100%</span></div><div className="mt-5 flex rounded-xl bg-stone-100 p-1"><button onClick={() => setView('admin')} className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${view === 'admin' ? 'bg-white shadow-sm' : 'text-stone-500'}`}>Admin split</button><button onClick={() => setView('traveler')} className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${view === 'traveler' ? 'bg-white shadow-sm' : 'text-stone-500'}`}>Traveler preview</button></div>{view === 'admin' ? <div className="mt-5 space-y-2">{trip.travelers.map((person) => <label key={person.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 px-3 py-3"><span className="text-sm font-semibold">{person.name}{person.id === admin?.id ? ' · admin' : ''}</span><span className="flex items-center gap-2"><input aria-label={`${person.name} reimbursement percentage`} type="number" min="0" max="100" step="0.01" value={shares[person.id] ?? 0} onChange={(event) => setShares({ ...shares, [person.id]: Number(event.target.value) })} className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-right" /><span className="text-xs text-stone-400">%</span><b className="w-24 text-right text-sm text-moss">{money(bookingTotal * (shares[person.id] ?? 0) / 100)}</b></span></label>)}<div className="mt-4 flex flex-wrap items-center gap-3"><button onClick={() => setShares(equalShares())} className="text-xs font-bold text-moss">Reset to equal shares</button><button disabled={!validSplit || busy} onClick={() => void createAllFriendRequests()} className="rounded-xl bg-sky-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Preparing…' : 'Collect payment from friends'}</button></div><p className="text-xs leading-5 text-stone-500">Prepares each friend&apos;s amount, PayPal sandbox link, and message preview. Nothing is sent automatically.</p></div> : <div className="mt-5 rounded-2xl bg-[#f6fbf7] p-5"><p className="eyebrow text-moss">What {travelerPreview?.name} will receive</p><p className="mt-2 text-2xl font-bold">{money(bookingTotal * (shares[travelerPreview?.id ?? ''] ?? 0) / 100)}</p><p className="mt-2 text-sm text-stone-600">A private reimbursement request for their agreed part of the admin-paid booking. Sending links or SMS is intentionally not enabled yet.</p></div>}</section>}
      {order?.status === 'COMPLETED' && validSplit && <section className="rounded-[28px] border border-sky-200 bg-sky-50 p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow text-sky-800">Step 3 · Payment requests</p><h2 className="mt-1 text-2xl font-bold">Request each friend’s agreed share.</h2><p className="mt-2 text-sm text-sky-900/70">This prepares a private PayPal sandbox link and a message showing exactly what each friend owes. It does not send SMS, email, or any real payment request.</p></div><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => void createAllFriendRequests()} className="rounded-xl bg-sky-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Preparing…' : 'Prepare payment requests'}</button><button disabled={Object.keys(friendOrders).length === 0} onClick={() => void copyFriendRequests()} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-sky-900 ring-1 ring-sky-200 disabled:opacity-50"><Copy className="mr-2 inline" size={15} />Copy payment messages</button></div></div><div className="mt-5 grid gap-3 lg:grid-cols-2">{trip.travelers.filter((person) => person.id !== admin?.id && (shares[person.id] ?? 0) > 0).map((person) => { const request = friendOrders[person.id]; const amount = bookingTotal * (shares[person.id] ?? 0) / 100; return <article key={person.id} className="rounded-2xl bg-white p-4 ring-1 ring-sky-100"><div className="flex items-start justify-between gap-3"><div><b>{person.name}</b><p className="mt-1 text-xs text-stone-500">Private booking reimbursement</p></div><b className="text-moss">{money(amount)}</b></div>{request ? <div className="mt-4"><p className="break-all rounded-lg bg-sky-50 p-2 text-[10px] text-sky-900">{request.approveUrl ?? `${request.mock ? 'Simulation' : 'PayPal'} order ${request.id}`}</p><p className="mt-2 text-xs text-stone-600">Message: “Hi {person.name}, your agreed share is {money(amount)}. Pay securely using this PayPal link.”</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{request.approveUrl && request.status !== 'COMPLETED' && <a href={request.approveUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-[#0070ba] px-3 py-2 text-center text-xs font-bold text-white"><Link2 className="mr-1 inline" size={13} />Open approval</a>}{request.status === 'COMPLETED' ? <span className="rounded-lg bg-moss px-3 py-2 text-center text-xs font-bold text-white">Reimbursed</span> : <button disabled={busy} onClick={() => void captureFriendRequest(person.id)} className="rounded-lg bg-[#ffc439] px-3 py-2 text-xs font-bold">Capture approval</button>}</div></div> : <button disabled={busy} onClick={() => void createFriendRequest(person.id)} className="mt-4 w-full rounded-lg bg-sky-800 px-3 py-2.5 text-xs font-bold text-white">Prepare {person.name}&apos;s PayPal link</button>}</article>; })}</div></section>}
      {order?.status === 'COMPLETED' && <p className="rounded-2xl bg-stone-50 px-5 py-4 text-xs leading-5 text-stone-600">Sandbox only: payment requests are prepared for the demo. Supplier ticketing and hotel confirmation require a fresh Sabre booking workflow and are not claimed here.</p>}
      <section className="rounded-[24px] border border-stone-200 bg-white p-5"><div className="flex items-start gap-3"><MapPinned className="mt-1 text-moss" /><div><p className="eyebrow">What happens later</p><h3 className="mt-1 text-lg font-bold">Shared expenses remain separate.</h3><p className="mt-2 text-sm leading-6 text-stone-600">Meals, rides and activity receipts go to Shared expenses. Odyssey nets those receipts at trip end and never charges these flight-and-stay costs twice.</p></div></div></section>
    </>}
  </div>;
}

type BookingVoiceContext = {
  trip: Trip;
  selectedFlight: { title: string; detail: string };
  selectedHotel: { title: string; detail: string };
  bookingTotal: number;
  onSelectBundle: (id: BundleId) => void;
  onConfirm: () => void;
  onCollectPayment: () => void;
};

function BookingAgentVoice(props: BookingVoiceContext) {
  return <VocalBridgeProvider options={{ auth: { tokenUrl: '/api/booking-voice-token' }, participantName: 'Odyssey booking traveler', debug: true }}>
    <BookingAgentVoiceControls {...props} />
  </VocalBridgeProvider>;
}

function BookingAgentVoiceControls({ trip, selectedFlight, selectedHotel, bookingTotal, onSelectBundle, onConfirm, onCollectPayment }: BookingVoiceContext) {
  const voice = useVocalBridge();
  const { transcript } = useTranscript();
  const { onAction, sendAction } = useAgentActions();
  const connected = voice.state === 'connected' || voice.state === 'connecting' || voice.state === 'waiting_for_agent';

  useEffect(() => {
    if (voice.state !== 'connected') return;
    void sendAction('journeyos_context', {
      page: 'Booking and payment',
      trip: {
        origin: trip.request.origin,
        destination: trip.request.destination,
        departureDate: trip.request.departureDate,
        returnDate: trip.request.returnDate,
        travelers: trip.travelers.map((person) => person.name),
      },
      selectedFlight,
      selectedHotel,
      bookingTotal,
      instruction: 'You are the separate Odyssey Booking Agent. This trip and selected options are authoritative. Explain or compare the selected flight and hotel, help the admin review a bundle, and prepare them for PayPal Sandbox. Do not restart planning. Do not claim supplier booking, airline ticketing, hotel confirmation, or payment capture without an explicit app confirmation.',
    });
  }, [bookingTotal, selectedFlight, selectedHotel, sendAction, trip, voice.state]);

  useEffect(() => onAction('select_bundle', (payload) => {
    const id = typeof payload.id === 'string' ? payload.id : '';
    if (id === 'value' || id === 'overall' || id === 'neighborhood') onSelectBundle(id);
  }), [onAction, onSelectBundle]);
  useEffect(() => onAction('confirm_booking', () => onConfirm()), [onAction, onConfirm]);
  useEffect(() => onAction('collect_payment', () => onCollectPayment()), [onAction, onCollectPayment]);

  const toggle = async () => {
    if (connected) await voice.disconnect();
    else {
      await new Promise<void>((resolve) => {
        let settled = false;
        const done = () => { if (!settled) { settled = true; resolve(); } };
        window.dispatchEvent(new CustomEvent('odyssey:stop-planner-voice', { detail: { done } }));
        window.setTimeout(done, 750);
      });
      await voice.connect();
    }
  };
  const latest = transcript[transcript.length - 1];
  return <section className="rounded-[28px] border border-sky-200 bg-sky-50 p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
    <div><p className="eyebrow text-sky-800">Separate Vocal Bridge agent</p><h2 className="mt-1 text-xl font-bold text-ink">Talk to the Booking Agent</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">It knows this page&apos;s selected flight, hotel, travel dates, and total. It can explain options and prepare the admin for PayPal Sandbox, but never claims a Sabre supplier booking.</p>{latest && <p className="mt-3 max-w-2xl truncate text-xs text-sky-900"><b>{latest.role === 'user' ? 'You' : 'Booking Agent'}:</b> {latest.text}</p>}{voice.error && <p className="mt-2 text-xs font-semibold text-coral">{voice.error.message}</p>}</div>
    <button type="button" onClick={() => void toggle()} aria-label={connected ? 'End Booking Agent conversation' : 'Talk to Booking Agent'} className={`mt-4 inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white sm:mt-0 ${connected ? 'bg-coral' : 'bg-sky-800 hover:bg-sky-950'}`}><CreditCard size={17} />{voice.state === 'connecting' ? 'Connecting…' : connected ? 'End Booking Agent call' : 'Talk to Booking Agent'}</button>
  </section>;
}

function CertTestBookingCard({ selectedLiveBundle, fulfillment, traveler, acknowledged, busy, onTravelerChange, onAcknowledgedChange, onRevalidate, onCreate }: {
  selectedLiveBundle?: LiveBundle;
  fulfillment: CertFulfillmentState;
  traveler: CertTraveler;
  acknowledged: boolean;
  busy: boolean;
  onTravelerChange: (patch: Partial<CertTraveler>) => void;
  onAcknowledgedChange: (acknowledged: boolean) => void;
  onRevalidate: () => void;
  onCreate: () => void;
}) {
  const isWorking = fulfillment.status === 'revalidating' || fulfillment.status === 'creating' || busy;
  const canCreate = Boolean(selectedLiveBundle && fulfillment.revalidationId && acknowledged && fulfillment.status !== 'creating' && fulfillment.status !== 'confirmed');
  const confirmationUrl = fulfillment.booking ? `/api/sabre/cert-bookings/${encodeURIComponent(fulfillment.booking.bookingId)}/confirmation.pdf` : undefined;
  return <section className="rounded-[28px] border border-sky-200 bg-white p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow text-sky-800">Optional supplier test · Sabre CERT</p>
        <h2 className="mt-1 text-2xl font-bold text-ink">Create a CERT test booking confirmation.</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">Use this only after payment is recorded and a live Sabre CERT bundle is selected. Odyssey creates a PDF only when Sabre returns a real test PNR/reference.</p>
      </div>
      <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${fulfillment.status === 'confirmed' ? 'bg-emerald-100 text-moss' : fulfillment.status === 'pending' ? 'bg-amber-100 text-amber-900' : fulfillment.status === 'error' ? 'bg-red-50 text-coral' : 'bg-sky-100 text-sky-800'}`}>
        {fulfillment.status === 'confirmed' ? 'CERT reference returned' : fulfillment.status === 'pending' ? 'Fulfillment pending' : fulfillment.status === 'ready' ? 'Revalidated' : fulfillment.status === 'error' ? 'Needs attention' : 'Not supplier-confirmed'}
      </span>
    </div>
    <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <article className="rounded-2xl bg-sky-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-sky-800">Safe demo sequence</p>
        <ol className="mt-3 space-y-2 text-sm leading-6 text-sky-950/80">
          <li>1. Search live Sabre CERT offers.</li>
          <li>2. Select and revalidate one offer/rate.</li>
          <li>3. Submit one explicit CERT test booking request.</li>
          <li>4. Generate the PDF only from a returned PNR/reference.</li>
        </ol>
        {!selectedLiveBundle && <p className="mt-4 rounded-xl bg-white p-3 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">Select a live Sabre bundle before revalidation.</p>}
        {selectedLiveBundle && <div className="mt-4 rounded-xl bg-white p-3 text-xs leading-5 text-stone-600 ring-1 ring-sky-100"><b className="text-ink">{selectedLiveBundle.label}</b><br />{selectedLiveBundle.flight.title}<br />{selectedLiveBundle.hotel.title}</div>}
      </article>
      <article className="rounded-2xl border border-stone-200 p-4">
        <div className="flex flex-wrap gap-2">
          <button disabled={!selectedLiveBundle || isWorking} onClick={onRevalidate} className="rounded-xl bg-sky-800 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{fulfillment.status === 'revalidating' ? 'Revalidating…' : 'Revalidate selected CERT bundle'}</button>
          {confirmationUrl && <a href={confirmationUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-moss px-4 py-2.5 text-sm font-bold text-white"><Link2 className="mr-2 inline" size={15} />Download CERT test PDF</a>}
        </div>
        {fulfillment.message && <p className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${fulfillment.status === 'error' ? 'bg-red-50 text-coral' : fulfillment.status === 'confirmed' ? 'bg-emerald-100 text-moss' : fulfillment.status === 'pending' ? 'bg-amber-100 text-amber-900' : 'bg-sky-50 text-sky-900'}`}>{fulfillment.message}</p>}
        {fulfillment.status === 'confirmed' && fulfillment.booking && <div className="mt-4 rounded-2xl border border-moss/20 bg-[#f6fbf7] p-4"><div className="flex items-center gap-2"><Sparkles className="text-moss" size={18} /><p className="text-xs font-bold uppercase tracking-wide text-moss">CERT test booking</p></div><p className="mt-2 text-sm text-stone-600">Sabre returned test reference:</p><p className="mt-1 font-mono text-xl font-bold text-ink">{fulfillment.booking.reference}</p><p className="mt-2 text-xs leading-5 text-stone-500">This confirmation is certification/sandbox evidence only and is not valid for travel.</p></div>}
        {fulfillment.status === 'pending' && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-bold text-amber-900">Payment recorded; supplier fulfillment pending.</p><p className="mt-1 text-xs leading-5 text-stone-600">Sabre did not return a PNR/reference, so Odyssey did not create a confirmation PDF.</p></div>}
        {fulfillment.revalidationId && fulfillment.status !== 'confirmed' && fulfillment.status !== 'pending' && <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input value={traveler.firstName} onChange={(event) => onTravelerChange({ firstName: event.target.value })} placeholder="Test first name" className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm text-ink" />
          <input value={traveler.lastName} onChange={(event) => onTravelerChange({ lastName: event.target.value })} placeholder="Test last name" className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm text-ink" />
          <input value={traveler.email} onChange={(event) => onTravelerChange({ email: event.target.value })} placeholder="test@example.com" className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm text-ink" />
          <input value={traveler.phone} onChange={(event) => onTravelerChange({ phone: event.target.value })} placeholder="+14155550101" className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm text-ink" />
          <label className="flex gap-2 rounded-xl bg-stone-50 p-3 text-xs leading-5 text-stone-600 sm:col-span-2"><input type="checkbox" checked={acknowledged} onChange={(event) => onAcknowledgedChange(event.target.checked)} className="mt-1" />I understand this submits one explicit Sabre CERT test-booking request and any PDF must be marked CERT test booking.</label>
          <button disabled={!canCreate || isWorking} onClick={onCreate} className="rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-2">{fulfillment.status === 'creating' ? 'Submitting CERT test booking…' : 'Create CERT test booking'}</button>
        </div>}
      </article>
    </div>
  </section>;
}

function LiveOfferList({ title, offers, empty }: { title: string; offers: LiveOffer[]; empty: string }) {
  return <div><p className="text-xs font-bold uppercase tracking-wide text-stone-500">{title}</p><div className="mt-2 space-y-2">{offers.length ? offers.map((offer) => <article key={offer.id} className="rounded-2xl border border-sky-200 bg-white p-4 text-sm"><span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-800">{offer.label}</span><div className="mt-3 flex flex-col justify-between gap-2 sm:flex-row"><div><b>{offer.title}</b><p className="mt-1 text-xs leading-5 text-stone-500">{offer.detail}</p></div><div className="shrink-0 sm:text-right"><b>{offer.price}</b>{offer.groupPrice && <p className="mt-1 text-xs font-semibold text-moss">{offer.groupPrice}</p>}</div></div><p className="mt-3 border-t border-sky-100 pt-3 text-[10px] font-bold uppercase tracking-wide text-stone-400">{offer.source} · recheck before booking</p></article>) : <p className="rounded-xl bg-white p-3 text-sm text-stone-500">{empty}</p>}</div></div>;
}
