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
