import assert from 'node:assert/strict';
import test from 'node:test';
import { DemoStore } from './demo-store.js';
import { groupHappiness } from '../services/happiness.service.js';

test('migrates legacy hydrated state without resetting its destination', () => {
  const store = new DemoStore();
  const legacy = store.getTrip();
  legacy.schemaVersion = undefined;
  legacy.progressState = undefined;
  legacy.request.destination = 'Bali';
  legacy.name = 'Bali, together';

  store.hydrate(legacy);
  const hydrated = store.getTrip();
  assert.equal(hydrated.schemaVersion, 2);
  assert.equal(hydrated.request.destination, 'Bali');
  assert.ok(hydrated.progressState);
});

test('adds and removes travelers, recalculates totals, and invalidates approval', () => {
  const store = new DemoStore();
  const before = store.getTrip();
  const added = store.addTraveler({ name: 'Mina', phone: '+14155550199' });
  assert.equal(added.travelers.length, before.travelers.length + 1);
  assert.equal(added.request.travelers, added.travelers.length);
  assert.ok(added.budget.flight > before.budget.flight);

  const mina = added.travelers.find((traveler) => traveler.name === 'Mina');
  assert.ok(mina);
  const removed = store.removeTraveler(mina.id);
  assert.equal(removed.travelers.length, before.travelers.length);
});

test('tracks start, late completion, route variance, and Travel DNA evidence', () => {
  const store = new DemoStore();
  const stop = store.getTrip().itinerary.find((item) => item.status === 'current');
  assert.ok(stop);

  const started = store.startStop(stop.id);
  assert.equal(started.progressState?.activeStopId, stop.id);
  assert.equal(started.itinerary.find((item) => item.id === stop.id)?.status, 'in-progress');

  const completed = store.completeStop(stop.id, stop.durationMins + 35);
  assert.equal(completed.itinerary.find((item) => item.id === stop.id)?.varianceMins, 35);
  assert.ok((completed.progressState?.scheduleVarianceMins ?? 0) >= 35);
  assert.match(completed.travelDna.changes?.[0]?.reason ?? '', /versus .* planned/);
});

test('skip and deterministic reset restore a reproducible demo', () => {
  const store = new DemoStore();
  const stop = store.getTrip().itinerary.find((item) => item.status === 'upcoming');
  assert.ok(stop);
  assert.equal(store.skipStop(stop.id).itinerary.find((item) => item.id === stop.id)?.status, 'skipped');
  const reset = store.reset();
  assert.equal(reset.id, 'trip-tokyo-2026');
  assert.deepEqual(reset.travelers.map((traveler) => traveler.name), ['Hema', 'Prabhu', 'Deepu', 'Sanjay']);
  assert.equal(reset.request.destination, 'Tokyo');
  assert.equal(reset.schemaVersion, 2);
});

test('calculates deterministic individual happiness and fairness', () => {
  const trip = new DemoStore().getTrip();
  const first = groupHappiness(trip.travelers, trip.itinerary, trip.request.duration);
  const second = groupHappiness(trip.travelers, trip.itinerary, trip.request.duration);
  assert.deepEqual(first, second);
  assert.ok(first.groupHappiness >= 0 && first.groupHappiness <= 100);
  assert.equal(first.individual.length, trip.travelers.length);
  assert.ok(first.individual.every((result) => result.breakdown.interestMatch > 0));
});

test('updates editable trip dates and calculates inclusive duration', () => {
  const store = new DemoStore();
  const updated = store.updateTripDetails({ origin: 'San Francisco', destination: 'Japan', departureDate: '2026-10-12', returnDate: '2026-10-18' });
  assert.equal(updated.request.duration, 7);
  assert.equal(updated.request.departureDate, '2026-10-12');
  assert.equal(updated.request.returnDate, '2026-10-18');
  assert.throws(() => store.updateTripDetails({ origin: 'SFO', destination: 'Japan', departureDate: '2026-10-18', returnDate: '2026-10-12' }), /Return date/);
});

test('preserves the exact user brief after creating a trip', () => {
  const store = new DemoStore();
  const request = store.getTrip().request;
  const transcript = 'I want seven quiet days in Kyoto with gardens, noodles, and no rushed mornings.';
  const updated = store.updateFromRequest({ ...request, destination: 'Kyoto', duration: 7 }, [], transcript);
  assert.equal(updated.briefTranscript, transcript);
});

test('trip brief group size reconciles the editable traveler roster', () => {
  const store = new DemoStore();
  const request = store.getTrip().request;
  const updated = store.updateFromRequest({ ...request, travelers: 2 }, [], 'China for two people');
  assert.equal(updated.request.travelers, 2);
  assert.equal(updated.travelers.length, 2);
});

test('records payer and participants for final expense settlement', () => {
  const store = new DemoStore();
  const trip = store.getTrip();
  const payer = trip.travelers[1];
  const participants = trip.travelers.slice(0, 3).map((traveler) => traveler.id);
  const updated = store.addReceipt(90, 'Shared ramen dinner', payer.id, participants, 'food');
  assert.equal(updated.expenses?.[0]?.paidBy, payer.id);
  assert.deepEqual(updated.expenses?.[0]?.participantIds, participants);
  assert.equal(updated.expenses?.[0]?.amount, 90);
});

test('deletes an incorrect receipt and reverses budget totals', () => {
  const store = new DemoStore();
  const before = store.getTrip();
  const withReceipt = store.addReceipt(90, 'Incorrect receipt', before.travelers[0].id, before.travelers.map((traveler) => traveler.id), 'food');
  const receiptId = withReceipt.expenses?.[0]?.id;
  assert.ok(receiptId);
  const updated = store.deleteReceipt(receiptId);
  assert.equal(updated.expenses?.some((expense) => expense.id === receiptId), false);
  assert.equal(updated.budget.spent, before.budget.spent);
  assert.equal(updated.budget.food, before.budget.food);
  assert.equal(updated.budget.remaining, before.budget.remaining);
});

test('applies generated-trip disruptions to the active day', () => {
  const store = new DemoStore();
  const request = store.getTrip().request;
  store.updateFromRequest({ ...request, destination: 'China', duration: 6 }, [], 'China for six days');
  const updated = store.replan('rain', 2);
  const changed = updated.itinerary.find((item) => item.day === 2 && item.status === 'moved');
  assert.ok(changed);
  assert.match(changed.title, /Indoor cultural alternative/);
});
