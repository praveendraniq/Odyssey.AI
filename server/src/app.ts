import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { config } from './config.js';
import { DemoStore } from './store/demo-store.js';
import { LandingAiService } from './services/landing-ai.service.js';
import { GooglePlacesService } from './services/google-places.service.js';
import { GoogleRoutesService } from './services/google-routes.service.js';
import type { PlaceAttraction } from './services/google-places.service.js';
import { knownBookingTotal, PayPalService } from './services/payment.service.js';
import { RouteOptimizer } from './services/route-optimizer.service.js';
import { SabreService } from './services/sabre.service.js';
import { VocalBridgeService } from './services/voice-planner.service.js';
import { WeatherService } from './services/weather.service.js';
import type { PaymentOrder, TripEvent } from './types.js';

const replanSchema = z.object({ type: z.enum(['late', 'rain', 'flight-delay', 'closed', 'tired']), activeDay: z.number().int().min(1).optional(), trip: z.unknown().optional() });
const requestSchema = z.object({ conversation: z.string().min(3).max(1000) });
const hydrateTripSchema = z.object({ trip: z.unknown() });
const preferenceCollectionSchema = z.object({ adminName: z.string().min(2).max(60), adminPhone: z.string().min(7).max(30), phones: z.record(z.string(), z.string().min(7).max(30)), trip: z.unknown().optional() });
const preferenceDecisionSchema = z.object({ interestScores: z.record(z.string(), z.number().min(1).max(5)), trip: z.unknown().optional() });
const selectionSchema = z.object({ id: z.string().min(1), trip: z.unknown().optional() });
const progressSchema = z.object({ id: z.string().min(1).optional(), action: z.enum(['start', 'complete', 'skip', 'delay']), actualDurationMins: z.number().int().min(1).max(720).optional(), minutes: z.number().int().min(1).max(240).optional(), trip: z.unknown().optional() });
const travelerSchema = z.object({ action: z.enum(['add', 'update', 'remove']), id: z.string().min(1).optional(), name: z.string().min(2).max(60).optional(), phone: z.string().max(30).optional(), budgetPreference: z.enum(['value', 'balanced', 'premium']).optional(), activityLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(), pacePreference: z.enum(['easy', 'balanced', 'full']).optional(), foodPreference: z.string().min(2).max(100).optional(), interests: z.object({ culture: z.number().min(1).max(5), history: z.number().min(1).max(5), food: z.number().min(1).max(5), photography: z.number().min(1).max(5), shopping: z.number().min(1).max(5), nightlife: z.number().min(1).max(5), nature: z.number().min(1).max(5) }).optional(), trip: z.unknown().optional() });
const tripDetailsSchema = z.object({ origin: z.string().min(2).max(80), destination: z.string().min(2).max(80), departureDate: z.string().date(), returnDate: z.string().date(), trip: z.unknown().optional() });
const receiptSchema = z.object({ amount: z.number().positive().optional(), restaurant: z.string().min(1).optional(), fileName: z.string().optional(), category: z.enum(['food', 'transport', 'activity', 'other']).optional(), paidBy: z.string().optional(), participantIds: z.array(z.string()).optional(), trip: z.unknown().optional() });
const orderSchema = z.object({ percentages: z.record(z.string(), z.number().min(0).max(100)).optional() }).superRefine((value, ctx) => { if (value.percentages && Math.abs(Object.values(value.percentages).reduce((sum, item) => sum + item, 0) - 100) > 0.01) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Custom split must total 100%' }); });
const weatherSchema = z.object({ destination: z.string().min(2).max(80) });
const voiceTokenSchema = z.object({ participant_name: z.string().min(1).max(80).optional() });

const polishedTripBrief = (request: { origin?: string; destination: string; departureDate?: string; returnDate?: string; duration: number; travelers: number; budget: number; interests: string[]; foodPreferences: string[]; travelStyle: string }) => {
  const dates = request.departureDate && request.returnDate ? ` between ${request.departureDate} and ${request.returnDate}` : '';
  const origin = request.origin ? `, departing from ${request.origin}` : '';
  const interests = request.interests.length ? ` Their priorities are ${request.interests.join(', ')}.` : '';
  const food = request.foodPreferences.length ? ` Food preferences: ${request.foodPreferences.join(', ')}.` : '';
  return `Plan a ${request.duration}-day ${request.travelStyle} trip for ${request.travelers} traveler${request.travelers === 1 ? '' : 's'} to ${request.destination}${origin}${dates}, with a total budget of $${request.budget.toLocaleString()}.${interests}${food}`;
};

export const createApp = () => {
  const store = new DemoStore();
  const sabre = new SabreService(store.getTrip());
  const planner = new VocalBridgeService();
  const payments = new PayPalService();
  const routeOptimizer = new RouteOptimizer();
  const receipts = new LandingAiService();
  const places = new GooglePlacesService();
  const routes = new GoogleRoutesService();
  const weather = new WeatherService();
  const orders = new Map<string, PaymentOrder>();
  const app = express();

  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, mockMode: config.mockMode }));
  app.post('/api/voice-token', async (req, res, next) => {
    try {
      const { participant_name } = voiceTokenSchema.parse(req.body ?? {});
      if (!config.vocalBridge.apiKey) return res.status(503).json({ error: 'Vocal Bridge is not configured on the server.' });
      const baseUrl = (config.vocalBridge.baseUrl || 'https://vocalbridgeai.com').replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/api/v1/token`, {
        method: 'POST',
        headers: {
          'X-API-Key': config.vocalBridge.apiKey,
          ...(config.vocalBridge.agentId ? { 'X-Agent-Id': config.vocalBridge.agentId } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ participant_name: participant_name ?? 'JourneyOS traveler' }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = typeof body === 'object' && body && 'error' in body ? String(body.error) : `Vocal Bridge returned ${response.status}`;
        return res.status(response.status).json({ error: detail });
      }
      return res.json(body);
    } catch (error) { next(error); }
  });
  app.get('/api/voice/outbound-context', (req, res) => {
    const suppliedSecret = req.header('X-JourneyOS-Context-Key');
    if (!config.vocalBridge.outboundContextSecret || suppliedSecret !== config.vocalBridge.outboundContextSecret) return res.status(401).json({ error: 'Unauthorized trip context request.' });
    const trip = store.getTrip();
    res.json({
      admin: trip.travelers[0]?.name ?? 'Trip admin',
      trip: {
        origin: trip.request.origin,
        destination: trip.request.destination,
        departureDate: trip.request.departureDate,
        returnDate: trip.request.returnDate,
        duration: trip.request.duration,
        travelers: trip.travelers.map(({ name, pacePreference, foodPreference }) => ({ name, pacePreference, foodPreference })),
        budget: trip.request.budget,
        travelStyle: trip.request.travelStyle,
        interests: trip.request.interests,
        foodPreferences: trip.request.foodPreferences,
      },
      instruction: 'Use this as established context. Do not ask the callee to repeat these facts. Ask only for their personal priorities, constraints, pace, food needs, and a compromise they would accept.',
    });
  });
  app.get('/api/trips/demo', (_req, res) => res.json({ trip: store.getTrip(), mode: config.mockMode ? 'demo' : 'live' }));
  app.get('/api/weather', async (req, res, next) => {
    try { const { destination } = weatherSchema.parse(req.query); res.json({ weather: await weather.current(destination) }); }
    catch (error) { next(error); }
  });
  app.post('/api/trips/hydrate', (req, res, next) => {
    try { const { trip } = hydrateTripSchema.parse(req.body); store.hydrate(trip as ReturnType<typeof store.getTrip>); res.json({ trip: store.getTrip() }); }
    catch (error) { next(error); }
  });
  app.post('/api/trips/reset', (_req, res) => res.json({ trip: store.reset() }));
  app.post('/api/trips/details', (req, res, next) => {
    try { const input = tripDetailsSchema.parse(req.body); if (input.trip) store.hydrate(input.trip as ReturnType<typeof store.getTrip>); res.json({ trip: store.updateTripDetails(input) }); }
    catch (error) { next(error); }
  });
  app.post('/api/travelers', (req, res, next) => {
    try {
      const input = travelerSchema.parse(req.body);
      if (input.trip) store.hydrate(input.trip as ReturnType<typeof store.getTrip>);
      if (input.action === 'add' && input.name) return res.json({ trip: store.addTraveler({ name: input.name, phone: input.phone }) });
      if (input.action === 'update' && input.id && input.name) return res.json({ trip: store.updateTraveler(input.id, { name: input.name, phone: input.phone, budgetPreference: input.budgetPreference, activityLevel: input.activityLevel, pacePreference: input.pacePreference, foodPreference: input.foodPreference, interests: input.interests }) });
      if (input.action === 'remove' && input.id) return res.json({ trip: store.removeTraveler(input.id) });
      return res.status(400).json({ error: 'Traveler action is missing required fields.' });
    } catch (error) { next(error); }
  });

  app.post('/api/planner/extract', async (req, res, next) => {
    try {
      const { conversation } = requestSchema.parse(req.body);
      const result = await planner.extractTrip(conversation);
      let attractions: PlaceAttraction[] = [];
      let placesDiagnostic: string | undefined;
      try { attractions = await places.searchAttractions(result.request.destination, result.request.duration * 3, { interests: result.request.interests, foodPreferences: result.request.foodPreferences }); }
      catch (error) {
        placesDiagnostic = error instanceof Error ? error.message : 'Google Places request failed';
        console.warn('Google Places unavailable; using curated itinerary.', placesDiagnostic);
      }
      if (attractions.length >= 3) {
        try { attractions = await routes.optimizeStops(result.request.destination, attractions); }
        catch (error) {
          const detail = error instanceof Error ? error.message : 'Google Routes request failed';
          placesDiagnostic = placesDiagnostic ? `${placesDiagnostic}; ${detail}` : detail;
          console.warn('Google Routes unavailable; preserving Places result order.', detail);
        }
      }
      const summary = polishedTripBrief(result.request);
      const trip = store.updateFromRequest(result.request, attractions, summary);
      const itinerarySource = attractions.length >= 2 ? 'google-places' : 'curated-fallback';
      res.json({ ...result, trip, itinerarySource, placesDiagnostic: placesDiagnostic ?? (itinerarySource === 'curated-fallback' ? 'Google Places returned fewer than two attractions.' : undefined), summary });
    } catch (error) { next(error); }
  });
  app.post('/api/planner/collect-preferences', async (req, res, next) => {
    try {
      const input = preferenceCollectionSchema.parse(req.body);
      if (input.trip) store.hydrate(input.trip as ReturnType<typeof store.getTrip>);
      const currentTrip = store.getTrip();
      const collection = await planner.collectPreferences({ ...input, travelers: currentTrip.travelers, destination: currentTrip.request.destination });
      const trip = store.applyPreferenceCollection(collection);
      res.json({ collection, trip });
    } catch (error) { next(error); }
  });
  app.post('/api/planner/approve-preferences', (req, res, next) => {
    try { const input = preferenceDecisionSchema.parse(req.body); if (input.trip) store.hydrate(input.trip as ReturnType<typeof store.getTrip>); res.json({ trip: store.applyPreferenceDecision(input.interestScores as ReturnType<typeof store.getTrip>['groupPreference']['interestScores']) }); }
    catch (error) { next(error); }
  });

  app.get('/api/flights/search', async (req, res, next) => {
    try { res.json({ results: await sabre.searchFlights({ origin: String(req.query.origin ?? 'SFO'), destination: String(req.query.destination ?? 'TYO'), departureDate: String(req.query.departureDate ?? '2026-10-12') }), source: config.mockMode ? 'mock' : 'sabre' }); }
    catch (error) { next(error); }
  });
  app.get('/api/hotels/search', async (req, res, next) => {
    try { res.json({ results: await sabre.searchHotels({ cityCode: String(req.query.cityCode ?? 'TYO'), checkInDate: String(req.query.checkInDate ?? '2026-10-12'), checkOutDate: String(req.query.checkOutDate ?? '2026-10-15') }), source: config.mockMode ? 'mock' : 'sabre' }); }
    catch (error) { next(error); }
  });
  app.post('/api/bookings/flight', (req, res, next) => {
    try { const input = selectionSchema.parse(req.body); if (input.trip) store.hydrate(input.trip as ReturnType<typeof store.getTrip>); res.json({ trip: store.selectFlight(input.id) }); }
    catch (error) { next(error); }
  });
  app.post('/api/bookings/hotel', (req, res, next) => {
    try { const input = selectionSchema.parse(req.body); if (input.trip) store.hydrate(input.trip as ReturnType<typeof store.getTrip>); res.json({ trip: store.selectHotel(input.id) }); }
    catch (error) { next(error); }
  });
  app.post('/api/itinerary/progress', (req, res, next) => {
    try {
      const input = progressSchema.parse(req.body);
      if (input.trip) store.hydrate(input.trip as ReturnType<typeof store.getTrip>);
      if (input.action === 'delay') return res.json({ trip: store.reportDelay(input.minutes ?? 30) });
      if (!input.id) return res.status(400).json({ error: 'An itinerary stop is required.' });
      if (input.action === 'start') return res.json({ trip: store.startStop(input.id) });
      if (input.action === 'skip') return res.json({ trip: store.skipStop(input.id) });
      return res.json({ trip: store.completeStop(input.id, input.actualDurationMins) });
    }
    catch (error) { next(error); }
  });

  app.post('/api/itinerary/optimize', (_req, res) => {
    const trip = store.getTrip();
    res.json({ itinerary: routeOptimizer.optimize(trip.itinerary), explanation: 'The route groups nearby stops, respects booked times and opening windows, and minimizes backtracking between Tokyo and Kyoto neighborhoods.' });
  });

  app.post('/api/operations/replan', (req, res, next) => {
    try {
      const { type, activeDay, trip: clientTrip } = replanSchema.parse(req.body);
      if (clientTrip) store.hydrate(clientTrip as ReturnType<typeof store.getTrip>);
      const trip = store.replan(type as TripEvent['type'], activeDay);
      res.json({ trip, event: trip.events[0], itinerary: routeOptimizer.optimize(trip.itinerary, { raining: type === 'rain' }) });
    } catch (error) { next(error); }
  });

  app.post('/api/payments/create-order', async (req, res, next) => {
    try {
      const trip = store.getTrip();
      const { percentages } = orderSchema.parse(req.body ?? {});
      const order = await payments.createOrder(knownBookingTotal(trip), trip.travelers, percentages);
      orders.set(order.id, order);
      res.json({ order });
    } catch (error) { next(error); }
  });
  app.post('/api/payments/:orderId/capture', async (req, res, next) => {
    try {
      const order = orders.get(req.params.orderId);
      if (!order) return res.status(404).json({ error: 'Payment order not found' });
      const captured = await payments.captureOrder(order);
      orders.set(captured.id, captured);
      res.json({ order: captured });
    } catch (error) { next(error); }
  });

  app.post('/api/receipts/analyze', async (req, res, next) => {
    try {
      const input = receiptSchema.parse(req.body);
      if (input.trip) store.hydrate(input.trip as ReturnType<typeof store.getTrip>);
      const result = await receipts.analyzeReceipt(input);
      const amount = Number((result as { amount: number }).amount);
      const restaurant = String((result as { restaurant: string }).restaurant);
      res.json({ receipt: result, trip: store.addReceipt(amount, restaurant, input.paidBy, input.participantIds, input.category) });
    } catch (error) { next(error); }
  });

  app.delete('/api/receipts/:receiptId', (req, res, next) => {
    try {
      if (req.body?.trip) store.hydrate(req.body.trip as ReturnType<typeof store.getTrip>);
      res.json({ trip: store.deleteReceipt(req.params.receiptId) });
    } catch (error) { next(error); }
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(', ') : error instanceof Error ? error.message : 'Unexpected error';
    res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  });

  return app;
};
