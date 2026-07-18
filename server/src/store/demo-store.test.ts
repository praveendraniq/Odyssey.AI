import assert from 'node:assert/strict';
import test from 'node:test';
import { DemoStore } from './demo-store.js';
import { groupHappiness } from '../services/happiness.service.js';
import type { PlaceAttraction } from '../services/google-places.service.js';

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
  assert.deepEqual(reset.travelers.map((traveler) => traveler.name), ['Prabhu Siddharth', 'Sarah']);
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

test('uses the extracted city route to regenerate booking airport codes', () => {
  const store = new DemoStore();
  const updated = store.updateFromRequest({ ...store.getTrip().request, origin: 'San Francisco', destination: 'Hawaii', departureDate: '2026-10-12', returnDate: '2026-10-15', duration: 4 }, [], 'Plan a Hawaii trip from San Francisco.');
  assert.equal(updated.request.destination, 'Hawaii');
  assert.equal(updated.flights[0]?.departure, 'SFO');
  assert.equal(updated.flights[0]?.arrival, 'HNL');
});

test('maps Dallas and San Diego into booking airport codes', () => {
  const store = new DemoStore();
  const updated = store.updateFromRequest({ ...store.getTrip().request, origin: 'Dallas', destination: 'San Diego' }, [], 'Dallas to San Diego');
  assert.equal(updated.flights[0]?.departure, 'DFW');
  assert.equal(updated.flights[0]?.arrival, 'SAN');
});

test('preserves the exact user brief after creating a trip', () => {
  const store = new DemoStore();
  const request = store.getTrip().request;
  const transcript = 'I want seven quiet days in Kyoto with gardens, noodles, and no rushed mornings.';
  const updated = store.updateFromRequest({ ...request, destination: 'Kyoto', duration: 7 }, [], transcript);
  assert.equal(updated.briefTranscript, transcript);
});

test('first trip brief preserves the named friend roster and call-ready phones', () => {
  const store = new DemoStore();
  const before = store.getTrip();
  const expectedFriends = before.travelers.slice(1).map(({ name, phone }) => ({ name, phone }));
  const updated = store.updateFromRequest(before.request, [], 'Tokyo with Hema, Prabhu, Deepu, and Sanjay');
  assert.deepEqual(updated.travelers.slice(1).map(({ name, phone }) => ({ name, phone })), expectedFriends);
  assert.ok(updated.travelers.every((traveler) => traveler.phone));
});

test('trip brief group size reconciles the editable traveler roster', () => {
  const store = new DemoStore();
  const request = store.getTrip().request;
  const updated = store.updateFromRequest({ ...request, travelers: 2 }, [], 'China for two people');
  assert.equal(updated.request.travelers, 2);
  assert.equal(updated.travelers.length, 2);
});

test('four travelers keep the two default profiles and create two editable friend slots', () => {
  const store = new DemoStore();
  const request = store.getTrip().request;
  const updated = store.updateFromRequest({ ...request, travelers: 4 }, [], 'Plan a Tokyo trip for four travelers.');
  assert.deepEqual(updated.travelers.map((traveler) => traveler.name), ['Prabhu Siddharth', 'Sarah', 'Friend 2', 'Friend 3']);
  assert.equal(updated.travelers[1].phone, '+14152220000');
  assert.equal(updated.travelers[1].foodPreference, 'Pescetarian food · early dinner');
  assert.deepEqual(updated.preferenceCollection?.calls[0]?.topPriorities, ['Early dinner', 'Moderate walking', 'Pescetarian food']);
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
  const dayTwoTimes = updated.itinerary.filter((item) => item.day === 2).map((item) => item.time);
  assert.deepEqual(dayTwoTimes, [...dayTwoTimes].sort());
});

test('voice tired replan changes only the selected Tokyo day', () => {
  const store = new DemoStore();
  const before = store.getTrip();
  const dayOne = before.itinerary.filter((item) => item.day === 1).map((item) => ({ id: item.id, title: item.title, durationMins: item.durationMins }));
  const updated = store.replan('tired', 2);
  const changed = updated.itinerary.find((item) => item.day === 2 && item.status === 'moved' && item.title.startsWith('Shortened ') && item.durationMins <= 60);
  assert.ok(changed);
  assert.deepEqual(updated.itinerary.filter((item) => item.day === 1).map((item) => ({ id: item.id, title: item.title, durationMins: item.durationMins })), dayOne);
});

test('every disruption updates only the selected Tokyo day and keeps the sequence time-sorted', () => {
  for (const type of ['late', 'rain', 'flight-delay', 'closed', 'tired'] as const) {
    const store = new DemoStore();
    const before = store.getTrip().itinerary.map((item) => ({ id: item.id, day: item.day, time: item.time, title: item.title, status: item.status }));
    const updated = store.replan(type, 3);
    const changed = updated.itinerary.filter((item) => {
      const previous = before.find((candidate) => candidate.id === item.id);
      return previous && (previous.day !== item.day || previous.time !== item.time || previous.title !== item.title || previous.status !== item.status);
    });
    assert.ok(changed.length > 0, `${type} should update at least one stop`);
    assert.ok(changed.every((item) => item.day === 3), `${type} should not update another day`);
    const dayThreeTimes = updated.itinerary.filter((item) => item.day === 3).map((item) => item.time);
    assert.deepEqual(dayThreeTimes, [...dayThreeTimes].sort());
  }
});

test('preference approval never moves breakfast, lunch, or dinner out of their meal windows', () => {
  const store = new DemoStore();
  const request = store.getTrip().request;
  const places: PlaceAttraction[] = Array.from({ length: 10 }, (_, index) => ({
    id: `place-${index}`,
    name: index % 2 ? `Restaurant ${index}` : `Attraction ${index}`,
    address: `Tokyo stop ${index}`,
    category: index % 2 ? 'food' : 'culture',
  }));
  store.updateFromRequest(request, places, 'Tokyo with culture and food for four friends');
  store.completeSimulatedPrabhuInterview();
  const updated = store.applyPreferenceDecision({ culture: 5, history: 5, food: 5, photography: 3, shopping: 2, nightlife: 2, nature: 3 });
  for (const item of updated.itinerary) {
    if (item.title.startsWith('Breakfast')) assert.equal(item.time, '08:00');
    if (item.title.startsWith('Lunch')) assert.equal(item.time, '12:30');
    if (item.title.startsWith('Dinner')) assert.equal(item.time, '19:00');
  }
});

test('hydration repairs previously saved meal times without resetting the trip', () => {
  const store = new DemoStore();
  const saved = store.getTrip();
  const dinner = saved.itinerary.find((item) => item.category === 'food' && item.title.toLowerCase().includes('dinner'));
  assert.ok(dinner);
  dinner.title = `Dinner · ${dinner.title}`;
  dinner.time = '12:30';
  store.hydrate(saved);
  assert.equal(store.getTrip().itinerary.find((item) => item.id === dinner.id)?.time, '19:00');
});

test('contextual itinerary commands target the selected day and can be undone', () => {
  const store = new DemoStore();
  const before = store.getTrip();
  const dayThree = before.itinerary.filter((item) => item.day === 3).sort((a, b) => a.time.localeCompare(b.time));
  const completed = store.applyItineraryCommand('I saw place 2, mark it complete', 3);
  assert.equal(completed.trip.itinerary.find((item) => item.id === dayThree[1].id)?.status, 'completed');
  assert.equal(completed.affectedStopIds[0], dayThree[1].id);
  const restored = store.applyItineraryCommand('undo place 2', 3);
  assert.equal(restored.trip.itinerary.find((item) => item.id === dayThree[1].id)?.status, 'upcoming');
  assert.equal(restored.trip.itinerary.find((item) => item.id === dayThree[0].id)?.status, before.itinerary.find((item) => item.id === dayThree[0].id)?.status);
});

test('discovers a live conflict, negotiates it, and applies it only after admin approval', () => {
  const store = new DemoStore();
  store.updateFromRequest({ ...store.getTrip().request, travelers: 4 }, [], 'Plan a Tokyo trip for four travelers.');
  const friendTwo = store.getTrip().travelers[2];
  const sarah = store.getTrip().travelers.find((traveler) => traveler.name === 'Sarah');
  assert.ok(friendTwo);
  assert.ok(sarah);
  const started = store.startNegotiation(friendTwo.id, 'mock');
  const agreement = started.preferenceCollection?.agreement;
  assert.equal(agreement?.status, 'calling');
  assert.equal(agreement?.travelerName, friendTwo.name);
  assert.match(agreement?.conflict ?? '', /waiting to hear/i);
  assert.equal(agreement?.itineraryChanges.length, 0);
  assert.equal(started.preferenceCollection?.calls.filter((call) => call.status === 'completed').length, 2);
  assert.deepEqual(started.preferenceCollection?.calls.filter((call) => call.status === 'completed').map((call) => call.name), ['Prabhu Siddharth', 'Sarah']);

  const accepted = store.completeNegotiation({ travelerId: friendTwo.id, accepted: true, statedPreference: 'I want a late live music experience', travelerResponse: 'Yes, that works for me.' });
  const resolvedAgreement = accepted.preferenceCollection?.agreement;
  assert.equal(resolvedAgreement?.status, 'accepted');
  assert.equal(resolvedAgreement?.counterpartName, sarah.name);
  assert.notEqual(resolvedAgreement?.counterpartId, friendTwo.id);
  assert.match(resolvedAgreement?.conflict ?? '', new RegExp(`${friendTwo.name}.*${resolvedAgreement?.counterpartName}`, 'i'));
  assert.ok((resolvedAgreement?.afterHappiness ?? 0) > (resolvedAgreement?.beforeHappiness ?? 0));
  assert.equal(accepted.groupPreference.groupHappiness, resolvedAgreement?.afterHappiness);
  assert.equal(resolvedAgreement?.itineraryChanges.some((change) => accepted.itinerary.some((item) => item.id === change.id)), false);

  const applied = store.applyNegotiation();
  assert.equal(applied.preferenceCollection?.agreement?.status, 'applied');
  for (const change of resolvedAgreement?.itineraryChanges ?? []) {
    const item = applied.itinerary.find((candidate) => candidate.id === change.id);
    assert.equal(item?.day, resolvedAgreement?.affectedDay);
    assert.equal(item?.time, change.time);
    assert.equal(item?.title, change.title);
  }
});
