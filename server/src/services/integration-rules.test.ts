import assert from 'node:assert/strict';
import test from 'node:test';
import { knownBookingTotal } from './payment.service.js';
import { weatherCodeLabel } from './weather.service.js';
import { VocalBridgeService } from './voice-planner.service.js';

test('pre-trip checkout includes flight and hotel but excludes variable expenses', () => {
  const trip = { budget: { total: 6_000, spent: 4_200, remaining: 1_800, flight: 2_400, hotel: 600, activities: 700, food: 500 } };
  assert.equal(knownBookingTotal(trip), 3_000);
  assert.notEqual(knownBookingTotal(trip), trip.budget.spent);
});

test('weather codes use human-readable WMO condition labels', () => {
  assert.equal(weatherCodeLabel(0), 'Clear sky');
  assert.equal(weatherCodeLabel(63), 'Rain');
  assert.equal(weatherCodeLabel(95), 'Thunderstorms');
});

test('mock extraction understands China phrasing and varies confidence by evidence', async () => {
  const planner = new VocalBridgeService();
  const detailed = await planner.extractTrip('My travel trip is China for 2 people, 6 days, under $5000 with food and history.');
  const sparse = await planner.extractTrip('Maybe China.');
  assert.equal(detailed.request.destination, 'China');
  assert.equal(detailed.request.travelers, 2);
  assert.notEqual(detailed.confidence, 0.94);
  assert.ok(detailed.confidence > sparse.confidence);
});

test('mock extraction accepts Chennai as both a brief and a bare destination', async () => {
  const planner = new VocalBridgeService();
  const brief = await planner.extractTrip('Plan a trip to Chennai for 4 friends with food and culture.');
  const bare = await planner.extractTrip('Chennai');
  assert.equal(brief.request.destination, 'Chennai');
  assert.equal(bare.request.destination, 'Chennai');
});

test('brief extraction uses a spoken origin-to-destination route instead of demo defaults', async () => {
  const planner = new VocalBridgeService();
  const result = await planner.extractTrip('Plan a four-day trip from San Francisco to Hawaii for two travelers, October 12th through October 15th, with a four-thousand-dollar budget.');
  assert.equal(result.request.origin, 'San Francisco');
  assert.equal(result.request.destination, 'Hawaii');
  assert.equal(result.request.departureDate, '2026-10-12');
  assert.equal(result.request.returnDate, '2026-10-15');
});

test('brief extraction supports a direct city-to-city route without the word from', async () => {
  const planner = new VocalBridgeService();
  const result = await planner.extractTrip('Dallas to San Diego');
  assert.equal(result.request.origin, 'Dallas');
  assert.equal(result.request.destination, 'San Diego');
});

test('brief extraction supports structured traveler wording with destination then departure city', async () => {
  const planner = new VocalBridgeService();
  const result = await planner.extractTrip('Plan a 4-day culture-forward, unhurried trip for 3 travelers to San Diego, departing from Dallas between 2026-10-12 and 2026-10-16, with a total budget of $4,000.');
  assert.equal(result.request.origin, 'Dallas');
  assert.equal(result.request.destination, 'San Diego');
  assert.equal(result.request.duration, 5);
  assert.equal(result.request.travelers, 3);
  assert.equal(result.request.budget, 4000);
});
