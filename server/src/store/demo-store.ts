import type { GroupPreference, Interest, ItineraryItem, PreferenceCollection, Trip, TripEvent, Traveler } from '../types.js';

const interests = (scores: Partial<Record<Interest, number>>): Record<Interest, number> => ({
  culture: 2, history: 2, food: 2, photography: 2, shopping: 2, nightlife: 2, nature: 2, ...scores,
});

const travelers: Traveler[] = [
  { id: 't-aya', name: 'Aya', initials: 'AY', budgetPreference: 'balanced', activityLevel: 4, pacePreference: 'full', foodPreference: 'Sushi & regional food', interests: interests({ culture: 5, history: 5, food: 4, photography: 3 }) },
  { id: 't-marcus', name: 'Marcus', initials: 'MR', budgetPreference: 'premium', activityLevel: 3, pacePreference: 'balanced', foodPreference: 'Street food', interests: interests({ food: 5, photography: 4, nightlife: 3, shopping: 3 }) },
  { id: 't-leila', name: 'Leila', initials: 'LE', budgetPreference: 'balanced', activityLevel: 4, pacePreference: 'balanced', foodPreference: 'Vegetarian friendly', interests: interests({ culture: 5, history: 4, photography: 5, nature: 4 }) },
  { id: 't-jon', name: 'Jon', initials: 'JO', budgetPreference: 'value', activityLevel: 3, pacePreference: 'easy', foodPreference: 'No shellfish', interests: interests({ culture: 4, food: 4, nature: 4, shopping: 1 }) },
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
];

const itineraryFor = (destination: string): ItineraryItem[] => {
  const place = destination.toLowerCase();
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
  ];
  return [
    route('arrival', 1, '14:00', `Arrive in ${destination}`, `${destination}`, 'transport', 20, 45, 75, 50, 'current'),
    route('welcome', 1, '18:00', 'Neighborhood welcome dinner', `${destination}`, 'food', 55, 58, 75, 90, 'upcoming'),
    route('highlight', 2, '09:00', 'Signature local landmark', `${destination}`, 'culture', 75, 62, 35, 45, 'upcoming', true),
    route('food', 2, '14:30', 'Local food experience', `${destination}`, 'food', 100, 25, 70, 55, 'upcoming'),
    route('daytrip', 3, '09:00', 'Scenic day trip', `${destination}`, 'nature', 150, 20, 62, 80, 'upcoming', true),
    route('culture', 4, '10:00', 'Culture and craft trail', `${destination}`, 'experience', 105, 35, 32, 42, 'upcoming'),
    route('farewell', 5, '18:00', 'Farewell dinner', `${destination}`, 'food', 100, 25, 60, 70, 'upcoming'),
  ];
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
      id: 'trip-japan-2026', name: 'Japan, together', dates: '12–16 Oct 2026',
      request: { destination: 'Japan', duration: 5, travelers: 4, budget: 6000, travelStyle: 'culture-forward, unhurried', foodPreferences: ['sushi', 'vegetarian friendly', 'street food'], interests: ['culture', 'history', 'food', 'photography'] },
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
    };
  }

  getTrip(): Trip { return structuredClone(this.trip); }

  applyPreferenceCollection(collection: PreferenceCollection): Trip {
    this.trip.preferenceCollection = collection;
    this.trip.groupPreference = {
      ...this.trip.groupPreference,
      recommendedPace: 'Admin-led balanced discovery',
      explanation: `${collection.adminName}'s priorities receive a 1.5× planning weight. ${collection.negotiation}`,
    };
    this.trip.events.unshift({ id: `preferences-${Date.now()}`, type: 'tired', title: 'Group preferences collected', createdAt: new Date().toISOString(), explanation: collection.approvalSummary });
    return this.getTrip();
  }

  selectFlight(flightId: string): Trip {
    this.trip.flights = this.trip.flights.map((flight) => ({ ...flight, selected: flight.id === flightId }));
    const selected = this.trip.flights.find((flight) => flight.id === flightId);
    if (selected) this.recalculateBudget(selected.price * 4, this.trip.budget.hotel);
    return this.getTrip();
  }

  selectHotel(hotelId: string): Trip {
    this.trip.hotels = this.trip.hotels.map((hotel) => ({ ...hotel, selected: hotel.id === hotelId }));
    const selected = this.trip.hotels.find((hotel) => hotel.id === hotelId);
    if (selected) this.recalculateBudget(this.trip.budget.flight, selected.totalPrice);
    return this.getTrip();
  }

  updateFromRequest(request: Trip['request']): Trip {
    this.trip.request = { ...this.trip.request, ...request };
    this.trip.name = `${request.destination}, together`;
    this.trip.itinerary = itineraryFor(request.destination);
    this.trip.events = [{ id: `brief-${Date.now()}`, type: 'tired', title: `${request.destination} trip brief created`, createdAt: new Date().toISOString(), explanation: `Your ${request.duration}-day ${request.destination} itinerary is ready to review. Every page now reflects this proposed trip.` }];
    this.trip.groupPreference = { ...this.trip.groupPreference, explanation: `The ${request.destination} route prioritizes ${request.interests.slice(0, 3).join(', ')} while keeping the group’s preferred pace.` };
    this.trip.preferenceCollection = undefined;
    return this.getTrip();
  }

  replan(type: TripEvent['type']): Trip {
    if (!this.trip.request.destination.toLowerCase().includes('japan')) {
      const next = this.trip.itinerary.find((item) => item.status === 'upcoming');
      const updates: Record<TripEvent['type'], { title: string; explanation: string }> = {
        late: { title: 'Running late +90 minutes', explanation: `JourneyOS moved the next ${this.trip.request.destination} stop later and protected the group’s highest-priority experience.` },
        rain: { title: 'Heavy rain forecast', explanation: `JourneyOS swapped the next outdoor ${this.trip.request.destination} moment for an indoor cultural option and kept travel time low.` },
        'flight-delay': { title: 'Flight delayed by 2 hours', explanation: `JourneyOS shortened the arrival-day plan in ${this.trip.request.destination} and held the next confirmed experience.` },
        closed: { title: 'Attraction closed', explanation: `JourneyOS replaced the unavailable ${this.trip.request.destination} stop with a nearby option that matches the group’s interests.` },
        tired: { title: 'Traveler energy is low', explanation: `JourneyOS reduced walking in ${this.trip.request.destination} while preserving one meaningful group highlight.` },
      };
      if (next) Object.assign(next, { time: type === 'late' || type === 'flight-delay' ? '16:00' : next.time, durationMins: type === 'tired' ? Math.min(next.durationMins, 60) : next.durationMins, status: 'moved' as const });
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

  addReceipt(amount: number, restaurant: string): Trip {
    this.trip.budget.food += amount;
    this.trip.budget.spent += amount;
    this.trip.budget.remaining = this.trip.budget.total - this.trip.budget.spent;
    this.trip.travelDna.food = Math.min(5, this.trip.travelDna.food + 0.15);
    this.trip.events.unshift({ id: `receipt-${Date.now()}`, type: 'late', title: `Receipt captured · ${restaurant}`, createdAt: new Date().toISOString(), explanation: `$${amount.toFixed(2)} was added to the live food budget and strengthens the group’s food preference signal.` });
    return this.getTrip();
  }

  private move(id: string, day: number, time: string, status: ItineraryItem['status']) {
    const item = this.trip.itinerary.find((entry) => entry.id === id);
    if (item) Object.assign(item, { day, time, status });
  }

  private recalculateBudget(flight: number, hotel: number) {
    this.trip.budget.flight = flight;
    this.trip.budget.hotel = hotel;
    this.trip.budget.spent = flight + hotel + this.trip.budget.activities + this.trip.budget.food;
    this.trip.budget.remaining = this.trip.budget.total - this.trip.budget.spent;
  }
}
