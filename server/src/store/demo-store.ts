import type { GroupPreference, Interest, ItineraryItem, PreferenceCollection, TravelDnaChange, Trip, TripEvent, Traveler } from '../types.js';
import type { PlaceAttraction } from '../services/google-places.service.js';
import { groupHappiness } from '../services/happiness.service.js';

const interests = (scores: Partial<Record<Interest, number>>): Record<Interest, number> => ({
  culture: 2, history: 2, food: 2, photography: 2, shopping: 2, nightlife: 2, nature: 2, ...scores,
});

const travelers: Traveler[] = [
  { id: 't-aya', name: 'Aya', initials: 'AY', phone: '+1 (415) 555-0101', budgetPreference: 'balanced', activityLevel: 4, pacePreference: 'full', foodPreference: 'Sushi & regional food', interests: interests({ culture: 5, history: 5, food: 4, photography: 3 }) },
  { id: 't-marcus', name: 'Marcus', initials: 'MR', phone: '+1 (415) 555-0148', budgetPreference: 'premium', activityLevel: 3, pacePreference: 'balanced', foodPreference: 'Street food', interests: interests({ food: 5, photography: 4, nightlife: 3, shopping: 3 }) },
  { id: 't-leila', name: 'Leila', initials: 'LE', phone: '+1 (415) 555-0172', budgetPreference: 'balanced', activityLevel: 4, pacePreference: 'balanced', foodPreference: 'Vegetarian friendly', interests: interests({ culture: 5, history: 4, photography: 5, nature: 4 }) },
  { id: 't-jon', name: 'Jon', initials: 'JO', phone: '+1 (415) 555-0196', budgetPreference: 'value', activityLevel: 3, pacePreference: 'easy', foodPreference: 'No shellfish', interests: interests({ culture: 4, food: 4, nature: 4, shopping: 1 }) },
];

const route = (id: string, day: number, time: string, title: string, subtitle: string, category: ItineraryItem['category'], x: number, y: number, durationMins: number, travelMins: number, status: ItineraryItem['status'], weatherSensitive = false): ItineraryItem => ({
  id, day, time, title, subtitle, category, durationMins, travelMins, location: { x, y }, status, weatherSensitive, openingHours: '09:00 – 17:00',
});

const itinerary: ItineraryItem[] = [
  route('i-hotel', 1, '14:00', 'Check in · Hotel K5', 'Nihonbashi · Tokyo', 'stay', 20, 45, 82, 45, 'completed'),
  route('i-sensoji', 1, '16:00', 'Sensō-ji & Nakamise', 'Asakusa · Tokyo', 'culture', 75, 28, 56, 29, 'completed', true),
  route('i-izakaya', 1, '19:00', 'Izakaya dinner', 'Kanda · Tokyo', 'food', 90, 24, 68, 48, 'completed'),
  route('i-meiji', 2, '09:00', 'Meiji Shrine', 'Harajuku · Tokyo', 'culture', 70, 35, 28, 48, 'current', true),
  route('i-tsukiji', 2, '12:00', 'Tsukiji food crawl', 'Chūō · Tokyo', 'food', 105, 30, 54, 65, 'upcoming'),
  route('i-teamlab', 2, '16:00', 'teamLab Borderless', 'Azabudai · Tokyo', 'experience', 100, 21, 48, 79, 'upcoming'),
  route('i-shinkansen', 3, '09:00', 'Shinkansen to Kyoto', 'Tokyo → Kyoto', 'transport', 140, 20, 66, 80, 'upcoming'),
  route('i-arashiyama', 3, '13:00', 'Arashiyama bamboo grove', 'Sagano · Kyoto', 'nature', 90, 45, 33, 66, 'upcoming', true),
  route('i-tea', 3, '16:30', 'Private tea ceremony', 'Gion · Kyoto', 'experience', 75, 38, 57, 43, 'upcoming'),
  route('i-fushimi', 4, '08:30', 'Fushimi Inari sunrise', 'Fushimi · Kyoto', 'culture', 120, 24, 78, 71, 'upcoming', true),
  route('i-nishiki', 4, '13:00', 'Nishiki Market tasting', 'Downtown · Kyoto', 'food', 90, 32, 62, 51, 'upcoming'),
  route('i-kiyomizu', 5, '09:30', 'Kiyomizu-dera', 'Higashiyama · Kyoto', 'culture', 105, 25, 51, 31, 'upcoming', true),
  route('i-farewell', 5, '14:00', 'Kyoto farewell lunch', 'Gion · Kyoto', 'food', 85, 22, 62, 48, 'upcoming'),
];

const itineraryFor = (destination: string, duration: number): ItineraryItem[] => {
  const place = destination.toLowerCase();
  if (place.includes('yellowstone') || place.includes('yellow stone')) return [
    route('yellowstone-arrival', 1, '10:00', 'Arrive at Yellowstone', 'West Entrance · Yellowstone National Park', 'transport', 20, 45, 75, 50, 'current'),
    route('yellowstone-grand-prismatic', 1, '13:00', 'Grand Prismatic Spring', 'Midway Geyser Basin · Yellowstone', 'nature', 85, 30, 55, 58, 'upcoming', true),
    route('yellowstone-old-faithful', 1, '17:00', 'Old Faithful & Upper Geyser Basin', 'Old Faithful · Yellowstone', 'nature', 100, 24, 65, 35, 'upcoming', true),
    route('yellowstone-hayden', 2, '06:30', 'Hayden Valley wildlife drive', 'Hayden Valley · Yellowstone', 'nature', 110, 40, 43, 54, 'upcoming', true),
    route('yellowstone-canyon', 2, '11:30', 'Grand Canyon of the Yellowstone', 'Canyon Village · Yellowstone', 'nature', 105, 27, 58, 43, 'upcoming', true),
    route('yellowstone-artist-point', 2, '16:00', 'Artist Point sunset', 'South Rim · Yellowstone', 'experience', 75, 18, 65, 35, 'upcoming', true),
    route('yellowstone-lamar', 3, '06:30', 'Lamar Valley wildlife watch', 'Lamar Valley · Yellowstone', 'nature', 120, 55, 35, 55, 'upcoming', true),
    route('yellowstone-mammoth', 3, '13:30', 'Mammoth Hot Springs', 'Mammoth · Yellowstone', 'nature', 100, 35, 52, 43, 'upcoming', true),
  ].filter((item) => item.day <= duration);
  if (place.includes('lake tahoe') || place.includes('tahoe')) return [
    route('tahoe-arrival', 1, '10:00', 'Arrive in South Lake Tahoe', 'South Lake Tahoe, California', 'transport', 20, 45, 75, 50, 'current'),
    route('tahoe-heavenly', 1, '13:00', 'Heavenly Gondola', 'Heavenly Mountain Resort, South Lake Tahoe', 'experience', 90, 25, 54, 50, 'upcoming', true),
    route('tahoe-lakeside', 1, '18:00', 'Lakeside sunset walk', 'Lakeside Beach, South Lake Tahoe', 'nature', 70, 15, 66, 58, 'upcoming', true),
    route('tahoe-emerald', 2, '09:00', 'Emerald Bay overlook', 'Emerald Bay State Park, California', 'nature', 85, 35, 34, 52, 'upcoming', true),
    route('tahoe-vikingsholm', 2, '12:00', 'Vikingsholm Castle', 'Vikingsholm, Emerald Bay State Park', 'culture', 90, 18, 55, 62, 'upcoming', true),
    route('tahoe-eagle-falls', 2, '16:00', 'Eagle Falls trail', 'Eagle Falls Trailhead, California', 'nature', 95, 12, 63, 42, 'upcoming', true),
    route('tahoe-sand-harbor', 3, '09:00', 'Sand Harbor beach', 'Sand Harbor State Park, Nevada', 'nature', 100, 40, 47, 60, 'upcoming', true),
    route('tahoe-incline', 3, '14:00', 'Incline Village food stop', 'Incline Village, Nevada', 'food', 80, 20, 65, 45, 'upcoming'),
  ].filter((item) => item.day <= duration);
  if (place.includes('india')) return [
    route('india-arrival', 1, '14:00', 'Arrive in Delhi', 'Delhi · India', 'transport', 20, 45, 75, 50, 'current'),
    route('india-market', 1, '18:00', 'Old Delhi food walk', 'Chandni Chowk · Delhi', 'food', 55, 58, 75, 90, 'upcoming'),
    route('india-fort', 2, '09:00', 'Red Fort & heritage walk', 'Old Delhi · India', 'culture', 75, 62, 35, 45, 'upcoming', true),
    route('india-museum', 2, '14:30', 'National Museum', 'Janpath · Delhi', 'museum', 100, 25, 70, 55, 'upcoming'),
    route('india-agra', 3, '07:00', 'Train to Agra', 'Delhi → Agra · India', 'transport', 150, 20, 62, 80, 'upcoming'),
    route('india-taj', 3, '11:00', 'Taj Mahal', 'Agra · India', 'culture', 110, 30, 54, 48, 'upcoming', true),
    route('india-bazaar', 4, '10:00', 'Jaipur artisan bazaar', 'Jaipur · India', 'experience', 90, 55, 42, 62, 'upcoming'),
    route('india-palace', 4, '15:30', 'Amber Fort', 'Jaipur · India', 'culture', 105, 35, 32, 42, 'upcoming', true),
    route('india-farewell', 5, '18:00', 'Farewell dinner', 'Jaipur · India', 'food', 100, 25, 60, 70, 'upcoming'),
  ].filter((item) => item.day <= duration);
  if (place.includes('thailand') || place.includes('bangkok')) return [
    route('thai-arrival', 1, '10:00', 'Grand Palace & Wat Phra Kaew', 'Grand Palace, Bangkok, Thailand', 'culture', 24, 46, 72, 46, 'current', true),
    route('thai-watpho', 1, '13:00', 'Wat Pho & Reclining Buddha', 'Wat Pho, Bangkok, Thailand', 'culture', 54, 58, 88, 32, 'upcoming'),
    route('thai-river', 1, '18:00', 'Chao Phraya sunset ferry', 'Tha Maharaj, Bangkok, Thailand', 'experience', 72, 73, 78, 20, 'upcoming'),
    route('thai-market', 2, '09:00', 'Damnoen Saduak floating market', 'Damnoen Saduak Floating Market, Ratchaburi, Thailand', 'experience', 28, 52, 100, 70, 'upcoming'),
    route('thai-ayutthaya', 2, '14:30', 'Ayutthaya temple ruins', 'Wat Mahathat, Ayutthaya, Thailand', 'culture', 55, 63, 95, 42, 'upcoming', true),
    route('thai-chinatown', 2, '19:00', 'Yaowarat street-food walk', 'Yaowarat Road, Bangkok, Thailand', 'food', 74, 76, 80, 55, 'upcoming'),
    route('thai-jimthompson', 3, '10:00', 'Jim Thompson House', 'Jim Thompson House Museum, Bangkok, Thailand', 'museum', 42, 48, 85, 35, 'upcoming'),
    route('thai-lumpini', 3, '16:00', 'Lumphini Park & local dinner', 'Lumphini Park, Bangkok, Thailand', 'nature', 63, 60, 76, 28, 'upcoming', true),
  ].filter((item) => item.day <= duration);
  if (place.includes('bali')) return [
    route('bali-uluwatu', 1, '09:00', 'Uluwatu Temple', 'Uluwatu Temple, Bali, Indonesia', 'culture', 28, 46, 95, 42, 'current', true),
    route('bali-lunch', 1, '12:30', 'Clifftop Balinese lunch', 'Single Fin, Uluwatu, Bali, Indonesia', 'food', 52, 58, 75, 16, 'upcoming'),
    route('bali-cean', 1, '16:00', 'Kecak fire dance', 'Uluwatu Temple, Bali, Indonesia', 'experience', 72, 73, 80, 14, 'upcoming', true),
    route('bali-ubud', 2, '09:00', 'Tegalalang Rice Terrace', 'Tegalalang Rice Terrace, Bali, Indonesia', 'nature', 34, 48, 95, 40, 'upcoming', true),
    route('bali-monkey', 2, '13:00', 'Sacred Monkey Forest', 'Sacred Monkey Forest Sanctuary, Ubud, Bali, Indonesia', 'nature', 58, 61, 80, 22, 'upcoming', true),
    route('bali-palace', 2, '17:00', 'Ubud Palace walk', 'Ubud Palace, Bali, Indonesia', 'culture', 75, 78, 65, 12, 'upcoming'),
    route('bali-tirta', 3, '09:00', 'Tirta Empul water temple', 'Tirta Empul Temple, Bali, Indonesia', 'culture', 40, 50, 85, 30, 'upcoming'),
    route('bali-seminyak', 3, '16:00', 'Seminyak sunset dinner', 'Seminyak Beach, Bali, Indonesia', 'food', 68, 65, 80, 35, 'upcoming'),
  ].filter((item) => item.day <= duration);
  return [
    route('arrival', 1, '14:00', `Arrive in ${destination}`, `${destination}`, 'transport', 20, 45, 75, 50, 'current'),
    route('welcome', 1, '18:00', 'Neighborhood welcome dinner', `${destination}`, 'food', 55, 58, 75, 90, 'upcoming'),
    route('highlight', 2, '09:00', 'Signature local landmark', `${destination}`, 'culture', 75, 62, 35, 45, 'upcoming', true),
    route('food', 2, '14:30', 'Local food experience', `${destination}`, 'food', 100, 25, 70, 55, 'upcoming'),
    route('daytrip', 3, '09:00', 'Scenic day trip', `${destination}`, 'nature', 150, 20, 62, 80, 'upcoming', true),
    route('culture', 4, '10:00', 'Culture and craft trail', `${destination}`, 'experience', 105, 35, 32, 42, 'upcoming'),
    route('last-stop', 5, '10:00', 'Final local highlight', `${destination} city center`, 'culture', 80, 30, 48, 45, 'upcoming'),
    route('farewell', 5, '18:00', 'Farewell dinner', `${destination}`, 'food', 100, 25, 60, 70, 'upcoming'),
  ].filter((item) => item.day <= duration);
};

const itineraryFromPlaces = (duration: number, places: PlaceAttraction[]): ItineraryItem[] => {
  const slots = ['09:00', '12:30', '16:00'];
  return places.slice(0, duration * slots.length).map((place, index) => {
    const category: ItineraryItem['category'] = index % 3 === 1 ? 'food' : index % 3 === 2 ? 'experience' : 'culture';
    return route(
      `place-${place.id}`,
      Math.floor(index / slots.length) + 1,
      slots[index % slots.length],
      place.name,
      place.address,
      category,
      28 + ((index * 17) % 48),
      30 + ((index * 11) % 45),
      category === 'food' ? 75 : 95,
      20 + ((index * 13) % 35),
      index === 0 ? 'current' : 'upcoming',
      category !== 'food',
    );
  });
};

const groupPreference: GroupPreference = {
  interestScores: { culture: 4.75, history: 3.5, food: 4.25, photography: 3.5, shopping: 2, nightlife: 2.25, nature: 3.25 },
  recommendedPace: 'Balanced discovery',
  explanation: 'Kyoto leads the route because all four travelers value culture, and three of four also ranked history or photography highly.',
};

export class DemoStore {
  private trip: Trip;

  constructor() {
    this.trip = {
      schemaVersion: 2,
      id: 'trip-japan-2026', name: 'Japan, together', dates: '12–16 Oct 2026',
      request: { origin: 'San Francisco', destination: 'Japan', departureDate: '2026-10-12', returnDate: '2026-10-16', duration: 5, travelers: 4, budget: 6000, travelStyle: 'culture-forward, unhurried', foodPreferences: ['sushi', 'vegetarian friendly', 'street food'], interests: ['culture', 'history', 'food', 'photography'] },
      travelers,
      groupPreference,
      flights: [
        { id: 'f-jal', airline: 'Japan Airlines', code: 'JL 001', departure: 'SFO', arrival: 'HND', departureTime: '11:45', arrivalTime: '16:20 +1', price: 1120, duration: '11h 35m', stops: 0, selected: true },
        { id: 'f-ana', airline: 'ANA', code: 'NH 107', departure: 'SFO', arrival: 'HND', departureTime: '13:10', arrivalTime: '17:45 +1', price: 1055, duration: '11h 35m', stops: 0 },
        { id: 'f-united', airline: 'United', code: 'UA 875', departure: 'SFO', arrival: 'HND', departureTime: '10:40', arrivalTime: '15:30 +1', price: 980, duration: '11h 50m', stops: 0 },
      ],
      hotels: [
        { id: 'h-k5', name: 'Hotel K5', location: 'Nihonbashi, Tokyo', rating: 4.8, price: 298, totalPrice: 894, image: 'K5', amenities: ['Design hotel', 'Walkable', 'Breakfast'], selected: true },
        { id: 'h-nol', name: 'nol kyoto sanjo', location: 'Sanjo, Kyoto', rating: 4.7, price: 235, totalPrice: 470, image: 'nol', amenities: ['Central Kyoto', 'Family room', 'Laundry'] },
        { id: 'h-thegate', name: 'THE GATE HOTEL', location: 'Kaminarimon, Tokyo', rating: 4.6, price: 208, totalPrice: 624, image: 'Gate', amenities: ['Rooftop', 'Metro access', 'Gym'] },
      ],
      itinerary,
      budget: { total: 6000, spent: 4768, remaining: 1232, flight: 1120 * 4, hotel: 894, activities: 610, food: 384 },
      travelDna: { culture: 5, history: 5, photography: 4, shopping: 1, nightlife: 2, food: 5, learning: 'The group lingers at temples and food stops; preserve open time around cultural neighborhoods.' },
      events: [],
      progress: 28,
      progressState: { completionPercent: 23, scheduleVarianceMins: 0, completedStopIds: ['i-hotel', 'i-sensoji', 'i-izakaya'], skippedStopIds: [] },
    };
  }

  getTrip(): Trip { return structuredClone(this.trip); }

  hydrate(trip: Trip): void {
    if (!trip || !Array.isArray(trip.travelers) || !Array.isArray(trip.itinerary)) throw new Error('Saved trip data is invalid. Reset the demo to recover.');
    const migrated = structuredClone(trip);
    migrated.schemaVersion = 2;
    migrated.request.travelers = migrated.travelers.length;
    migrated.request.origin ??= 'San Francisco';
    migrated.request.departureDate ??= '2026-10-12';
    migrated.request.returnDate ??= '2026-10-16';
    migrated.travelDna.confidence ??= 50;
    migrated.travelDna.changes ??= [];
    migrated.expenses ??= [];
    migrated.progressState ??= {
      completionPercent: migrated.progress,
      scheduleVarianceMins: 0,
      activeStopId: migrated.itinerary.find((item) => item.status === 'in-progress')?.id,
      completedStopIds: migrated.itinerary.filter((item) => item.status === 'completed').map((item) => item.id),
      skippedStopIds: migrated.itinerary.filter((item) => item.status === 'skipped').map((item) => item.id),
    };
    this.trip = migrated;
    this.updateProgress();
  }

  reset(): Trip {
    this.trip = new DemoStore().getTrip();
    return this.getTrip();
  }

  addTraveler(input: Pick<Traveler, 'name' | 'phone'>): Trip {
    const name = input.name.trim();
    if (name.length < 2) throw new Error('Traveler name must contain at least two characters.');
    if (this.trip.travelers.some((traveler) => traveler.name.toLowerCase() === name.toLowerCase())) throw new Error('Traveler names must be unique.');
    const id = `t-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36)}`;
    this.trip.travelers.push({ id, name, phone: input.phone?.trim(), initials: name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(), budgetPreference: 'balanced', activityLevel: 3, pacePreference: 'balanced', foodPreference: 'No preference added', interests: interests({ culture: 3, food: 3, nature: 3 }) });
    this.afterTravelerChange(`${name} added to the trip`);
    return this.getTrip();
  }

  updateTraveler(id: string, input: Pick<Traveler, 'name' | 'phone'> & Partial<Pick<Traveler, 'budgetPreference' | 'activityLevel' | 'pacePreference' | 'foodPreference' | 'interests'>>): Trip {
    const traveler = this.trip.travelers.find((item) => item.id === id);
    if (!traveler) throw new Error('Traveler not found.');
    const name = input.name.trim();
    if (name.length < 2 || this.trip.travelers.some((item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase())) throw new Error('Use a unique traveler name with at least two characters.');
    Object.assign(traveler, { name, phone: input.phone?.trim(), initials: name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(), ...(input.budgetPreference ? { budgetPreference: input.budgetPreference } : {}), ...(input.activityLevel ? { activityLevel: input.activityLevel } : {}), ...(input.pacePreference ? { pacePreference: input.pacePreference } : {}), ...(input.foodPreference ? { foodPreference: input.foodPreference } : {}), ...(input.interests ? { interests: input.interests } : {}) });
    this.afterTravelerChange(`${name}'s traveler profile updated`);
    return this.getTrip();
  }

  removeTraveler(id: string): Trip {
    if (this.trip.travelers.length <= 2) throw new Error('A group trip must keep at least two travelers.');
    const traveler = this.trip.travelers.find((item) => item.id === id);
    if (!traveler) throw new Error('Traveler not found.');
    this.trip.travelers = this.trip.travelers.filter((item) => item.id !== id);
    this.afterTravelerChange(`${traveler.name} removed from the trip`);
    return this.getTrip();
  }

  updateTripDetails(input: { origin: string; destination: string; departureDate: string; returnDate: string }): Trip {
    const departure = new Date(`${input.departureDate}T12:00:00Z`);
    const returning = new Date(`${input.returnDate}T12:00:00Z`);
    if (!Number.isFinite(departure.getTime()) || !Number.isFinite(returning.getTime()) || returning <= departure) throw new Error('Return date must be after the departure date.');
    const destinationChanged = input.destination.trim().toLowerCase() !== this.trip.request.destination.toLowerCase();
    const duration = Math.round((returning.getTime() - departure.getTime()) / 86_400_000) + 1;
    this.trip.request = { ...this.trip.request, origin: input.origin.trim(), destination: input.destination.trim(), departureDate: input.departureDate, returnDate: input.returnDate, duration };
    this.trip.name = `${input.destination.trim()}, together`;
    this.trip.dates = `${departure.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}–${returning.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
    if (destinationChanged) {
      this.trip.itinerary = itineraryFor(input.destination, duration);
      this.setBookingOptions(input.destination);
      this.trip.preferenceCollection = undefined;
    }
    const selectedFlight = this.trip.flights.find((flight) => flight.selected) ?? this.trip.flights[0];
    const arrivalOffset = selectedFlight?.arrivalTime.includes('+1') ? 1 : 0;
    const hotelNights = Math.max(1, duration - 1 - arrivalOffset);
    this.trip.hotels = this.trip.hotels.map((hotel) => ({ ...hotel, totalPrice: hotel.price * hotelNights }));
    const selectedHotel = this.trip.hotels.find((hotel) => hotel.selected) ?? this.trip.hotels[0];
    if (selectedFlight && selectedHotel) this.recalculateBudget(selectedFlight.price * this.trip.travelers.length, selectedHotel.totalPrice);
    this.trip.events.unshift({ id: `trip-details-${Date.now()}`, type: 'tired', title: 'Trip dates updated', createdAt: new Date().toISOString(), explanation: `${duration} calendar days from ${input.departureDate} through ${input.returnDate}; hotel nights are calculated from destination arrival.` });
    this.updateProgress();
    this.recalculateHappiness();
    return this.getTrip();
  }

  startStop(id: string): Trip {
    const stop = this.trip.itinerary.find((item) => item.id === id);
    if (!stop) throw new Error('That itinerary stop no longer exists.');
    if (stop.status === 'completed' || stop.status === 'skipped') throw new Error('That stop is already finished.');
    this.trip.itinerary.forEach((item) => { if (item.status === 'in-progress') item.status = 'upcoming'; });
    stop.status = 'in-progress';
    stop.startedAt = new Date().toISOString();
    this.ensureProgress().activeStopId = stop.id;
    this.recordProgressEvent(`${stop.title} started`, `JourneyOS is tracking actual time against the planned ${stop.durationMins} minutes.`);
    this.updateProgress();
    return this.getTrip();
  }

  completeStop(id: string, actualDurationMins?: number): Trip {
    const stop = this.trip.itinerary.find((item) => item.id === id);
    if (!stop) throw new Error('That itinerary stop no longer exists.');
    stop.status = 'completed';
    stop.completedAt = new Date().toISOString();
    stop.actualDurationMins = actualDurationMins ?? stop.durationMins;
    stop.varianceMins = stop.actualDurationMins - stop.durationMins;
    const dnaKey: TravelDnaChange['dimension'] = stop.category === 'culture' || stop.category === 'museum' ? 'culture' : stop.category === 'food' ? 'food' : stop.category === 'nature' ? 'photography' : 'history';
    const before = this.trip.travelDna[dnaKey];
    const after = Math.min(5, Number((before + (stop.varianceMins > 0 ? 0.5 : 0.25)).toFixed(2)));
    this.trip.travelDna[dnaKey] = after;
    this.trip.travelDna.confidence = Math.min(100, (this.trip.travelDna.confidence ?? 50) + 4);
    const reason = `${stop.title} took ${stop.actualDurationMins} minutes versus ${stop.durationMins} planned; ${dnaKey} moved from ${before} to ${after}.`;
    this.trip.travelDna.changes = [{ id: `dna-${Date.now()}`, dimension: dnaKey, before, after, reason, createdAt: new Date().toISOString() }, ...(this.trip.travelDna.changes ?? [])].slice(0, 12);
    this.trip.travelDna.learning = reason;
    const progress = this.ensureProgress();
    progress.scheduleVarianceMins += stop.varianceMins;
    progress.activeStopId = undefined;
    this.recordProgressEvent(`${stop.title} completed`, reason);
    if (stop.varianceMins >= 20) this.shiftRemainingStops(stop.day, stop.id, stop.varianceMins);
    this.updateProgress();
    this.recalculateHappiness();
    return this.getTrip();
  }

  skipStop(id: string): Trip {
    const stop = this.trip.itinerary.find((item) => item.id === id);
    if (!stop) throw new Error('That itinerary stop no longer exists.');
    stop.status = 'skipped';
    this.ensureProgress().activeStopId = undefined;
    this.recordProgressEvent(`${stop.title} skipped`, 'JourneyOS removed the stop from progress and preserved the remaining route.');
    this.updateProgress();
    this.recalculateHappiness();
    return this.getTrip();
  }

  reportDelay(minutes: number): Trip {
    if (minutes < 1 || minutes > 240) throw new Error('Delay must be between 1 and 240 minutes.');
    const activeId = this.ensureProgress().activeStopId;
    const active = this.trip.itinerary.find((item) => item.id === activeId) ?? this.trip.itinerary.find((item) => !['completed', 'skipped'].includes(item.status));
    if (active) this.shiftRemainingStops(active.day, active.id, minutes);
    this.ensureProgress().scheduleVarianceMins += minutes;
    this.recordProgressEvent(`Group running ${minutes} minutes late`, 'Remaining flexible stops were retimed while booked travel and completed activities stayed fixed.');
    this.updateProgress();
    this.recalculateHappiness();
    return this.getTrip();
  }

  applyPreferenceCollection(collection: PreferenceCollection): Trip {
    const happiness = groupHappiness(this.trip.travelers, this.trip.itinerary, this.trip.request.duration);
    this.trip.preferenceCollection = {
      ...collection,
      status: 'pending',
      approvalSummary: `${this.trip.request.destination} proposal: ${happiness.groupHappiness}% group happiness, ${happiness.fairnessGap}-point fairness gap, and no traveler below ${Math.min(...happiness.individual.map((item) => item.happiness))}% plan fit.`,
      calls: collection.calls.map((call) => {
        const result = happiness.individual.find((item) => item.travelerId === call.travelerId);
        return result ? { ...call, happiness: result.happiness, happinessBreakdown: result.breakdown, happinessExplanation: result.explanation } : call;
      }),
    };
    this.trip.groupPreference = {
      ...this.trip.groupPreference,
      recommendedPace: 'Admin-led balanced discovery',
      explanation: `${collection.adminName}'s priorities receive a 1.5× planning weight. ${collection.negotiation}`,
      groupHappiness: happiness.groupHappiness,
      averageHappiness: happiness.averageHappiness,
      fairnessPenalty: happiness.fairnessPenalty,
      fairnessGap: happiness.fairnessGap,
    };
    this.trip.events.unshift({ id: `preferences-${Date.now()}`, type: 'tired', title: 'Group preferences collected', createdAt: new Date().toISOString(), explanation: collection.approvalSummary });
    return this.getTrip();
  }

  applyPreferenceDecision(interestScores: GroupPreference['interestScores']): Trip {
    if (!this.trip.preferenceCollection) throw new Error('Collect group preferences before approving a plan.');
    const ranked = Object.entries(interestScores).sort(([, left], [, right]) => right - left).slice(0, 3).map(([interest]) => interest);
    this.trip.groupPreference = {
      ...this.trip.groupPreference,
      interestScores,
      recommendedPace: 'Admin-approved balanced discovery',
      explanation: `${this.trip.preferenceCollection.adminName} approved the final weighting: ${ranked.join(', ')} lead the itinerary while the group compromises remain protected.`,
    };
    this.trip.preferenceCollection = {
      ...this.trip.preferenceCollection,
      status: 'approved',
      approvalSummary: `${this.trip.request.destination} is approved for planning. ${ranked.map((interest) => interest[0].toUpperCase() + interest.slice(1)).join(', ')} lead the group route.`,
    };
    this.reprioritizeItinerary(interestScores);
    this.recalculateHappiness();
    this.trip.events.unshift({ id: `preferences-approved-${Date.now()}`, type: 'tired', title: 'Admin approved group preferences', createdAt: new Date().toISOString(), explanation: this.trip.preferenceCollection.approvalSummary });
    return this.getTrip();
  }

  selectFlight(flightId: string): Trip {
    this.trip.flights = this.trip.flights.map((flight) => ({ ...flight, selected: flight.id === flightId }));
    const selected = this.trip.flights.find((flight) => flight.id === flightId);
    if (selected) this.recalculateBudget(selected.price * this.trip.travelers.length, this.trip.budget.hotel);
    return this.getTrip();
  }

  selectHotel(hotelId: string): Trip {
    this.trip.hotels = this.trip.hotels.map((hotel) => ({ ...hotel, selected: hotel.id === hotelId }));
    const selected = this.trip.hotels.find((hotel) => hotel.id === hotelId);
    if (selected) this.recalculateBudget(this.trip.budget.flight, selected.totalPrice);
    return this.getTrip();
  }

  updateFromRequest(request: Trip['request'], places: PlaceAttraction[] = [], briefTranscript?: string): Trip {
    this.trip.request = { ...this.trip.request, ...request };
    this.trip.travelers = this.trip.travelers.slice(0, Math.max(1, request.travelers));
    while (this.trip.travelers.length < request.travelers) {
      const number = this.trip.travelers.length + 1;
      this.trip.travelers.push({ id: `t-traveler-${number}`, name: `Traveler ${number}`, initials: `T${number}`, budgetPreference: 'balanced', activityLevel: 3, pacePreference: 'balanced', foodPreference: 'No preference added', interests: interests({ culture: 3, food: 3, nature: 3 }) });
    }
    this.trip.name = `${request.destination}, together`;
    this.trip.itinerary = places.length >= 2 ? itineraryFromPlaces(request.duration, places) : itineraryFor(request.destination, request.duration);
    this.setBookingOptions(request.destination);
    this.trip.events = [{ id: `brief-${Date.now()}`, type: 'tired', title: `${request.destination} trip brief created`, createdAt: new Date().toISOString(), explanation: `${places.length >= 2 ? 'Google Places sourced real attractions for' : 'A curated route is ready for'} your ${request.duration}-day ${request.destination} itinerary. Every page now reflects this proposed trip.` }];
    this.trip.groupPreference = { ...this.trip.groupPreference, explanation: `The ${request.destination} route prioritizes ${request.interests.slice(0, 3).join(', ')} while keeping the group’s preferred pace.` };
    this.trip.preferenceCollection = undefined;
    this.trip.briefTranscript = briefTranscript;
    this.trip.expenses = [];
    return this.getTrip();
  }

  replan(type: TripEvent['type'], activeDay?: number): Trip {
    if (!this.trip.request.destination.toLowerCase().includes('japan')) {
      const next = this.trip.itinerary.find((item) => item.status === 'upcoming' && (!activeDay || item.day === activeDay))
        ?? this.trip.itinerary.find((item) => item.status === 'upcoming');
      const updates: Record<TripEvent['type'], { title: string; explanation: string }> = {
        late: { title: 'Running late +90 minutes', explanation: `JourneyOS moved the next ${this.trip.request.destination} stop later and protected the group’s highest-priority experience.` },
        rain: { title: 'Heavy rain forecast', explanation: `JourneyOS swapped the next outdoor ${this.trip.request.destination} moment for an indoor cultural option and kept travel time low.` },
        'flight-delay': { title: 'Flight delayed by 2 hours', explanation: `JourneyOS shortened the arrival-day plan in ${this.trip.request.destination} and held the next confirmed experience.` },
        closed: { title: 'Attraction closed', explanation: `JourneyOS replaced the unavailable ${this.trip.request.destination} stop with a nearby option that matches the group’s interests.` },
        tired: { title: 'Traveler energy is low', explanation: `JourneyOS reduced walking in ${this.trip.request.destination} while preserving one meaningful group highlight.` },
      };
      if (next) {
        if (type === 'late') Object.assign(next, { time: '20:00', title: `Later ${next.title}`, status: 'moved' as const });
        else if (type === 'flight-delay') Object.assign(next, { time: '19:00', title: 'Late-arrival welcome stop', durationMins: Math.min(next.durationMins, 60), status: 'moved' as const });
        else if (type === 'rain') Object.assign(next, { title: 'Indoor cultural alternative', subtitle: `Central ${this.trip.request.destination}`, category: 'museum' as const, weatherSensitive: false, status: 'moved' as const });
        else if (type === 'closed') Object.assign(next, { title: 'Nearby priority-matched replacement', subtitle: `Central ${this.trip.request.destination}`, category: 'experience' as const, status: 'moved' as const });
        else Object.assign(next, { title: `Shortened ${next.title}`, durationMins: Math.min(next.durationMins, 60), travelMins: Math.min(next.travelMins, 20), status: 'moved' as const });
      }
      const update = updates[type];
      this.trip.events.unshift({ id: `event-${Date.now()}`, type, title: update.title, createdAt: new Date().toISOString(), explanation: update.explanation });
      return this.getTrip();
    }
    const changes: Record<TripEvent['type'], { title: string; explanation: string; mutate: () => void }> = {
      late: {
        title: 'Running late +90 minutes',
        explanation: 'The tea ceremony moved to Day 4 at 16:30. We kept your booked Shinkansen and removed the low-priority shopping buffer, so the group still reaches Arashiyama before closing.',
        mutate: () => this.move('i-tea', 4, '16:30', 'moved'),
      },
      rain: {
        title: 'Heavy rain forecast',
        explanation: 'Outdoor Arashiyama moved to the dry Day 5 morning. Kyoto National Museum replaces it on Day 3 because it is 18 minutes from the hotel and matches the group’s culture and history priorities.',
        mutate: () => {
          this.move('i-arashiyama', 5, '14:00', 'moved');
          if (!this.trip.itinerary.some((item) => item.id === 'i-museum')) this.trip.itinerary.push(route('i-museum', 3, '13:00', 'Kyoto National Museum', 'Higashiyama · Kyoto', 'museum', 115, 18, 51, 45, 'moved'));
        },
      },
      'flight-delay': {
        title: 'Flight delayed by 2 hours',
        explanation: 'Hotel check-in was held and the first evening is now a short Kanda dinner. Sensō-ji moved to tomorrow’s golden hour, when the transit time is 12 minutes shorter.',
        mutate: () => this.move('i-sensoji', 2, '17:30', 'moved'),
      },
      closed: {
        title: 'Attraction closed',
        explanation: 'Kiyomizu-dera is closed for maintenance. We substituted Ginkaku-ji, a culturally similar temple with available morning entry and no extra route backtracking.',
        mutate: () => {
          const item = this.trip.itinerary.find((entry) => entry.id === 'i-kiyomizu');
          if (item) Object.assign(item, { title: 'Ginkaku-ji Silver Pavilion', subtitle: 'Sakyō · Kyoto', location: { x: 38, y: 29 }, status: 'moved' });
        },
      },
      tired: {
        title: 'Traveler energy is low',
        explanation: 'The full Fushimi Inari climb is now the first 45 minutes of gates, followed by a nearby café. This protects the group’s cultural highlight while reducing walking by 3.2 km.',
        mutate: () => {
          const item = this.trip.itinerary.find((entry) => entry.id === 'i-fushimi');
          if (item) Object.assign(item, { durationMins: 45, subtitle: 'Fushimi · Kyoto · short route', status: 'moved' });
        },
      },
    };
    const change = changes[type];
    change.mutate();
    this.trip.events.unshift({ id: `event-${Date.now()}`, type, title: change.title, createdAt: new Date().toISOString(), explanation: change.explanation });
    this.trip.itinerary.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
    this.trip.travelDna = { ...this.trip.travelDna, culture: Math.min(5, this.trip.travelDna.culture + (type === 'rain' ? 0.25 : 0)), history: Math.min(5, this.trip.travelDna.history + (type === 'rain' ? 0.2 : 0)), learning: type === 'tired' ? 'The group prefers meaningful highlights with shorter walks; default to a balanced pace.' : this.trip.travelDna.learning };
    return this.getTrip();
  }

  addReceipt(amount: number, restaurant: string, paidBy?: string, participantIds?: string[], category: 'food' | 'transport' | 'activity' | 'other' = 'food'): Trip {
    const payer = this.trip.travelers.find((traveler) => traveler.id === paidBy)?.id ?? this.trip.travelers[0].id;
    const participants = participantIds?.filter((id) => this.trip.travelers.some((traveler) => traveler.id === id)) ?? this.trip.travelers.map((traveler) => traveler.id);
    this.trip.expenses ??= [];
    this.trip.expenses.unshift({ id: `expense-${Date.now()}`, description: restaurant, category, amount, paidBy: payer, participantIds: participants.length ? participants : [payer], createdAt: new Date().toISOString() });
    this.trip.budget.food += amount;
    this.trip.budget.spent += amount;
    this.trip.budget.remaining = this.trip.budget.total - this.trip.budget.spent;
    this.trip.travelDna.food = Math.min(5, this.trip.travelDna.food + 0.15);
    this.trip.events.unshift({ id: `receipt-${Date.now()}`, type: 'late', title: `Receipt captured · ${restaurant}`, createdAt: new Date().toISOString(), explanation: `$${amount.toFixed(2)} was added to the live food budget and strengthens the group’s food preference signal.` });
    return this.getTrip();
  }

  deleteReceipt(receiptId: string): Trip {
    const expense = (this.trip.expenses ?? []).find((item) => item.id === receiptId);
    if (!expense) throw new Error('Receipt not found');
    this.trip.expenses = (this.trip.expenses ?? []).filter((item) => item.id !== receiptId);
    this.trip.budget.spent = Math.max(0, this.trip.budget.spent - expense.amount);
    if (expense.category === 'food') this.trip.budget.food = Math.max(0, this.trip.budget.food - expense.amount);
    this.trip.budget.remaining = this.trip.budget.total - this.trip.budget.spent;
    this.trip.events.unshift({ id: `receipt-delete-${Date.now()}`, type: 'late', title: `Receipt removed · ${expense.description}`, createdAt: new Date().toISOString(), explanation: `$${expense.amount.toFixed(2)} was removed and every traveler settlement was recalculated.` });
    return this.getTrip();
  }

  private ensureProgress() {
    this.trip.progressState ??= { completionPercent: this.trip.progress, scheduleVarianceMins: 0, completedStopIds: [], skippedStopIds: [] };
    return this.trip.progressState;
  }

  private updateProgress() {
    const progress = this.ensureProgress();
    progress.completedStopIds = this.trip.itinerary.filter((item) => item.status === 'completed').map((item) => item.id);
    progress.skippedStopIds = this.trip.itinerary.filter((item) => item.status === 'skipped').map((item) => item.id);
    progress.completionPercent = this.trip.itinerary.length === 0 ? 0 : Math.round(((progress.completedStopIds.length + progress.skippedStopIds.length) / this.trip.itinerary.length) * 100);
    progress.lastUpdatedAt = new Date().toISOString();
    this.trip.progress = progress.completionPercent;
  }

  private recordProgressEvent(title: string, explanation: string) {
    this.trip.events.unshift({ id: `progress-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: 'late', title, createdAt: new Date().toISOString(), explanation });
  }

  private shiftRemainingStops(day: number, afterId: string, minutes: number) {
    let found = false;
    for (const item of this.trip.itinerary.filter((entry) => entry.day === day).sort((a, b) => a.time.localeCompare(b.time))) {
      if (item.id === afterId) { found = true; continue; }
      if (!found || item.status === 'completed' || item.category === 'transport' || item.category === 'stay') continue;
      const [hours, mins] = item.time.split(':').map(Number);
      const total = hours * 60 + mins + minutes;
      item.time = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
      item.status = 'moved';
    }
  }

  private afterTravelerChange(title: string) {
    this.trip.request.travelers = this.trip.travelers.length;
    const keys: Interest[] = ['culture', 'history', 'food', 'photography', 'shopping', 'nightlife', 'nature'];
    for (const key of keys) this.trip.groupPreference.interestScores[key] = Number((this.trip.travelers.reduce((sum, traveler) => sum + traveler.interests[key], 0) / this.trip.travelers.length).toFixed(2));
    if (this.trip.preferenceCollection) this.trip.preferenceCollection = { ...this.trip.preferenceCollection, status: 'pending', calls: this.trip.preferenceCollection.calls.filter((call) => this.trip.travelers.some((traveler) => traveler.id === call.travelerId)) };
    const selected = this.trip.flights.find((flight) => flight.selected);
    if (selected) this.recalculateBudget(selected.price * this.trip.travelers.length, this.trip.budget.hotel);
    this.trip.events.unshift({ id: `traveler-${Date.now()}`, type: 'tired', title, createdAt: new Date().toISOString(), explanation: 'Group preference averages, booking totals, payment participants, and prior approval were recalculated.' });
    this.recalculateHappiness();
  }

  private recalculateHappiness() {
    const result = groupHappiness(this.trip.travelers, this.trip.itinerary, this.trip.request.duration);
    Object.assign(this.trip.groupPreference, { groupHappiness: result.groupHappiness, averageHappiness: result.averageHappiness, fairnessPenalty: result.fairnessPenalty, fairnessGap: result.fairnessGap });
    if (this.trip.preferenceCollection) this.trip.preferenceCollection.calls = this.trip.preferenceCollection.calls.map((call) => {
      const individual = result.individual.find((item) => item.travelerId === call.travelerId);
      return individual ? { ...call, happiness: individual.happiness, happinessBreakdown: individual.breakdown, happinessExplanation: individual.explanation } : call;
    });
  }

  private reprioritizeItinerary(scores: GroupPreference['interestScores']) {
    const scoreFor = (item: ItineraryItem) => item.category === 'food' ? scores.food : item.category === 'nature' ? (scores.nature + scores.photography) / 2 : item.category === 'culture' ? (scores.culture + scores.history) / 2 : item.category === 'museum' ? (scores.history + scores.culture) / 2 : item.category === 'experience' ? (scores.photography + scores.shopping + scores.nightlife) / 3 : 0;
    for (const day of new Set(this.trip.itinerary.map((item) => item.day))) {
      const flexible = this.trip.itinerary.filter((item) => item.day === day && !['completed', 'skipped', 'closed'].includes(item.status) && !['stay', 'transport'].includes(item.category)).sort((a, b) => a.time.localeCompare(b.time));
      const slots = flexible.map((item) => item.time);
      const ordered = flexible.slice().sort((a, b) => scoreFor(b) - scoreFor(a) || a.time.localeCompare(b.time));
      ordered.forEach((item, index) => {
        if (item.time !== slots[index]) item.status = 'moved';
        item.time = slots[index];
      });
    }
    this.trip.itinerary.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
  }

  private move(id: string, day: number, time: string, status: ItineraryItem['status']) {
    const item = this.trip.itinerary.find((entry) => entry.id === id);
    if (item) Object.assign(item, { day, time, status });
  }

  private setBookingOptions(destination: string) {
    const place = destination.toLowerCase();
    const isYellowstone = place.includes('yellowstone') || place.includes('yellow stone');
    const isTahoe = place.includes('lake tahoe') || place.includes('tahoe');
    const arrival = isYellowstone ? 'BZN' : isTahoe ? 'RNO' : destination.slice(0, 3).toUpperCase();
    const hotelName = isYellowstone ? 'Canyon Lodge & Cabins' : isTahoe ? 'Basecamp Tahoe South' : `${destination} Explorer Lodge`;
    const location = isYellowstone ? 'Canyon Village · Yellowstone' : isTahoe ? 'South Lake Tahoe · California' : `Central ${destination}`;
    this.trip.flights = [
      { id: 'f-primary', airline: isYellowstone ? 'United' : isTahoe ? 'Alaska' : 'Journey Air', code: isYellowstone ? 'UA 2146' : isTahoe ? 'AS 3381' : 'JO 101', departure: 'SFO', arrival, departureTime: '08:10', arrivalTime: '11:42', price: 390, duration: '3h 32m', stops: 0, selected: true },
      { id: 'f-value', airline: isYellowstone ? 'Delta' : isTahoe ? 'Southwest' : 'Journey Air', code: isYellowstone ? 'DL 1862' : isTahoe ? 'WN 2674' : 'JO 205', departure: 'SFO', arrival, departureTime: '10:20', arrivalTime: '14:35', price: 335, duration: '4h 15m', stops: 1 },
    ];
    this.trip.hotels = [
      { id: 'h-primary', name: hotelName, location, rating: 4.6, price: 290, totalPrice: 580, image: 'Primary stay', amenities: ['Central location', 'Breakfast'], selected: true },
      { id: 'h-value', name: `${destination} Basecamp`, location, rating: 4.4, price: 220, totalPrice: 440, image: 'Value stay', amenities: ['Parking', 'Local shuttle'] },
    ];
    this.recalculateBudget(390 * this.trip.request.travelers, 580);
  }

  private recalculateBudget(flight: number, hotel: number) {
    this.trip.budget.flight = flight;
    this.trip.budget.hotel = hotel;
    this.trip.budget.spent = flight + hotel + this.trip.budget.activities + this.trip.budget.food;
    this.trip.budget.remaining = this.trip.budget.total - this.trip.budget.spent;
  }
}
