import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { config } from './config.js';
import { DemoStore } from './store/demo-store.js';
import { LandingAiService } from './services/landing-ai.service.js';
import { GooglePlacesService } from './services/google-places.service.js';
import type { PlaceAttraction } from './services/google-places.service.js';
import { PayPalService } from './services/payment.service.js';
import { RouteOptimizer } from './services/route-optimizer.service.js';
import { SabreService } from './services/sabre.service.js';
import { VocalBridgeService } from './services/voice-planner.service.js';
import type { PaymentOrder, TripEvent } from './types.js';

const replanSchema = z.object({ type: z.enum(['late', 'rain', 'flight-delay', 'closed', 'tired']), trip: z.unknown().optional() });
const requestSchema = z.object({ conversation: z.string().min(3).max(1000) });
const preferenceCollectionSchema = z.object({ adminName: z.string().min(2).max(60), adminPhone: z.string().min(7).max(30), phones: z.record(z.string(), z.string().min(7).max(30)), trip: z.unknown().optional() });
const preferenceDecisionSchema = z.object({ interestScores: z.record(z.string(), z.number().min(1).max(5)), trip: z.unknown().optional() });
const selectionSchema = z.object({ id: z.string().min(1), trip: z.unknown().optional() });
const completeStopSchema = z.object({ id: z.string().min(1), trip: z.unknown().optional() });
const receiptSchema = z.object({ amount: z.number().positive().optional(), restaurant: z.string().min(1).optional(), fileName: z.string().optional() });
const orderSchema = z.object({ percentages: z.record(z.string(), z.number().min(0).max(100)).optional() }).superRefine((value, ctx) => { if (value.percentages && Math.abs(Object.values(value.percentages).reduce((sum, item) => sum + item, 0) - 100) > 0.01) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Custom split must total 100%' }); });

export const createApp = () => {
  const store = new DemoStore();
  const sabre = new SabreService(store.getTrip());
  const planner = new VocalBridgeService();
  const payments = new PayPalService();
  const routeOptimizer = new RouteOptimizer();
  const receipts = new LandingAiService();
  const places = new GooglePlacesService();
  const orders = new Map<string, PaymentOrder>();
  const app = express();

  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, mockMode: config.mockMode }));
  app.get('/api/trips/demo', (_req, res) => res.json({ trip: store.getTrip(), mode: config.mockMode ? 'demo' : 'live' }));

  app.post('/api/planner/extract', async (req, res, next) => {
    try {
      const { conversation } = requestSchema.parse(req.body);
      const result = await planner.extractTrip(conversation);
      let attractions: PlaceAttraction[] = [];
      let placesDiagnostic: string | undefined;
      try { attractions = await places.searchAttractions(result.request.destination, result.request.duration * 3); }
      catch (error) {
        placesDiagnostic = error instanceof Error ? error.message : 'Google Places request failed';
        console.warn('Google Places unavailable; using curated itinerary.', placesDiagnostic);
      }
      const trip = store.updateFromRequest(result.request, attractions);
      const itinerarySource = attractions.length >= 2 ? 'google-places' : 'curated-fallback';
      res.json({ ...result, trip, itinerarySource, placesDiagnostic: placesDiagnostic ?? (itinerarySource === 'curated-fallback' ? 'Google Places returned fewer than two attractions.' : undefined), summary: `${result.request.duration} days in ${result.request.destination} for ${result.request.travelers} travelers, with a $${result.request.budget.toLocaleString()} budget.` });
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
  app.post('/api/itinerary/complete', (req, res, next) => {
    try { const input = completeStopSchema.parse(req.body); if (input.trip) store.hydrate(input.trip as ReturnType<typeof store.getTrip>); res.json({ trip: store.completeStop(input.id) }); }
    catch (error) { next(error); }
  });

  app.post('/api/itinerary/optimize', (_req, res) => {
    const trip = store.getTrip();
    res.json({ itinerary: routeOptimizer.optimize(trip.itinerary), explanation: 'The route groups nearby stops, respects booked times and opening windows, and minimizes backtracking between Tokyo and Kyoto neighborhoods.' });
  });

  app.post('/api/operations/replan', (req, res, next) => {
    try {
      const { type, trip: clientTrip } = replanSchema.parse(req.body);
      if (clientTrip) store.hydrate(clientTrip as ReturnType<typeof store.getTrip>);
      const trip = store.replan(type as TripEvent['type']);
      res.json({ trip, event: trip.events[0], itinerary: routeOptimizer.optimize(trip.itinerary, { raining: type === 'rain' }) });
    } catch (error) { next(error); }
  });

  app.post('/api/payments/create-order', async (req, res, next) => {
    try {
      const trip = store.getTrip();
      const { percentages } = orderSchema.parse(req.body ?? {});
      const order = await payments.createOrder(trip.budget.spent, trip.travelers, percentages);
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
      const result = await receipts.analyzeReceipt(receiptSchema.parse(req.body));
      const amount = Number((result as { amount: number }).amount);
      const restaurant = String((result as { restaurant: string }).restaurant);
      res.json({ receipt: result, trip: store.addReceipt(amount, restaurant) });
    } catch (error) { next(error); }
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(', ') : error instanceof Error ? error.message : 'Unexpected error';
    res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  });

  return app;
};
