import type { GroupPreference, Interest, ItineraryItem, PreferenceCollection, TravelDnaChange, Trip, TripEvent, Traveler } from '../types.js';
import type { PlaceAttraction } from '../services/google-places.service.js';
import { groupHappiness } from '../services/happiness.service.js';

const interests = (scores: Partial<Record<Interest, number>>): Record<Interest, number> => ({
  culture: 2, history: 2, food: 2, photography: 2, shopping: 2, nightlife: 2, nature: 2, ...scores,
});

const travelers: Traveler[] = [
  { id: 't-admin', name: 'Hema', initials: 'HE', phone: '+14152220000', budgetPreference: 'balanced', activityLevel: 3, pacePreference: 'balanced', foodPreference: 'Preferences from your brief', interests: interests({ food: 5, culture: 4, photography: 3 }) },
  { id: 't-sarah', name: 'Sarah Siddharth', initials: 'PS', phone: '+14156290471', budgetPreference: 'balanced', activityLevel: 3, pacePreference: 'balanced', foodPreference: 'Pescetarian food · early dinner', interests: interests({ food: 5, photography: 4, shopping: 4, nature: 3 }) },
];
const DEFAULT_FRIEND = travelers[1];
const defaultSarahPreference = (): PreferenceCollection => ({
  adminName: 'Hema', adminWeight: 1.5, source: 'mock', status: 'pending',
  calls: [{ travelerId: 't-sarah', name: 'Sarah Siddharth', phone: '+14156290471', status: 'completed', happiness: 82, topPriorities: ['Early dinner', 'Moderate walking', 'Pescetarian food'], summary: 'Sarah prefers an early dinner, moderate walking, and pescetarian food.', compromise: 'Schedule a shared early dinner, then make any late-night activity optional.' }],
  negotiation: 'Sarah’s example preferences are ready for the group plan.',
  approvalSummary: 'Example preference profile loaded for Sarah.',
});

const route = (id: string, day: number, time: string, title: string, subtitle: string, category: ItineraryItem['category'], x: number, y: number, durationMins: number, travelMins: number, status: ItineraryItem['status'], weatherSensitive = false): ItineraryItem => ({
  id, day, time, title, subtitle, category, durationMins, travelMins, location: { x, y }, status, weatherSensitive, openingHours: '09:00 – 17:00',
});

const MAX_ITINERARY_DAYS = 14;
const NEGOTIATION_POLICY = { minimumFitGain: 5, maximumFit: 96 } as const;
const interestLabel = (interest: Interest) => interest.replace(/\b\w/g, (letter) => letter.toUpperCase());
const timeFromMinutes = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const minutesFromTime = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const DEFAULT_ADMIN = { name: 'Hema', phone: '+14152220000' };
const adminFromBrief = (brief: string | undefined, request: Trip['request']): Traveler => {
  const nameMatch = brief?.match(/(?:my name is|i am|i'm)\s+([a-z][a-z '-]{1,50})(?=[,.]|\s+(?:and|from|with|for|my|i)|$)/i)?.[1]?.trim();
  const phoneMatch = brief?.match(/(?:my (?:phone|number) is|call me at|my phone number is)\s*(\+?[\d().\s-]{7,})/i)?.[1];
  const name = nameMatch && !/^(planning|traveling|going|calling)\b/i.test(nameMatch) ? nameMatch.replace(/\b\w/g, (letter) => letter.toUpperCase()) : DEFAULT_ADMIN.name;
  const phone = phoneMatch ? `+${phoneMatch.replace(/\D/g, '')}` : DEFAULT_ADMIN.phone;
  const preferenceScores = request.interests.reduce<Partial<Record<Interest, number>>>((scores, interest) => ({ ...scores, [interest]: 5 }), {});
  const pacePreference: Traveler['pacePreference'] = /slow|relax|easy|unhurried/i.test(request.travelStyle) ? 'easy' : /fast|packed|adventure|high-energy/i.test(request.travelStyle) ? 'full' : 'balanced';
  return {
    id: 't-admin', name, phone, initials: name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(), budgetPreference: 'balanced', activityLevel: pacePreference === 'full' ? 4 : pacePreference === 'easy' ? 2 : 3,
    pacePreference, foodPreference: request.foodPreferences.length ? request.foodPreferences.join(' · ') : 'Preferences from your brief', interests: interests(preferenceScores),
  };
};
const normalizedTripDates = (departureInput: string | undefined, returnInput: string | undefined, fallbackDuration: number) => {
  const departureDate = departureInput ?? '2026-10-12';
  const departure = new Date(`${departureDate}T12:00:00Z`);
  const candidateReturn = returnInput ? new Date(`${returnInput}T12:00:00Z`) : undefined;
  const daysFromDates = candidateReturn && Number.isFinite(departure.getTime()) && Number.isFinite(candidateReturn.getTime())
    ? Math.round((candidateReturn.getTime() - departure.getTime()) / 86_400_000) + 1
    : fallbackDuration;
  const duration = Math.min(MAX_ITINERARY_DAYS, Math.max(1, Math.round(daysFromDates) || 1));
  const returnDate = new Date(`${departureDate}T12:00:00Z`);
  returnDate.setUTCDate(returnDate.getUTCDate() + duration - 1);
  return { departureDate, returnDate: returnDate.toISOString().slice(0, 10), duration };
};

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
  if (place.includes('paris')) return [
    route('paris-arrival', 1, '14:00', 'Settle in near Saint-Germain', 'Saint-Germain-des-Prés, Paris, France', 'stay', 30, 35, 72, 50, 'current'),
    route('paris-montmartre', 1, '16:30', 'Montmartre village walk', 'Sacré-Cœur Basilica, Paris, France', 'culture', 100, 25, 55, 32, 'upcoming', true),
    route('paris-d1-dinner', 1, '19:30', 'Bistro dinner in Montmartre', 'Rue des Abbesses, Paris, France', 'food', 90, 12, 68, 48, 'upcoming'),
    route('paris-louvre', 2, '09:00', 'Louvre Museum highlights', 'Louvre Museum, Paris, France', 'museum', 180, 30, 30, 45, 'upcoming'),
    route('paris-tuileries', 2, '13:00', 'Tuileries Garden stroll', 'Jardin des Tuileries, Paris, France', 'nature', 65, 10, 52, 53, 'upcoming', true),
    route('paris-orsay', 2, '15:30', 'Musée d’Orsay', 'Musée d’Orsay, Paris, France', 'museum', 120, 14, 67, 63, 'upcoming'),
    route('paris-notredame', 3, '09:30', 'Notre-Dame & Île de la Cité', 'Notre-Dame Cathedral, Paris, France', 'culture', 75, 25, 45, 48, 'upcoming', true),
    route('paris-sainte-chapelle', 3, '11:30', 'Sainte-Chapelle', 'Sainte-Chapelle, Paris, France', 'culture', 60, 8, 56, 56, 'upcoming'),
    route('paris-marais', 3, '15:00', 'Le Marais food and design walk', 'Place des Vosges, Paris, France', 'food', 120, 18, 72, 47, 'upcoming'),
    route('paris-eiffel', 4, '09:30', 'Eiffel Tower visit', 'Eiffel Tower, Paris, France', 'experience', 120, 30, 34, 54, 'upcoming'),
    route('paris-champdemars', 4, '12:30', 'Picnic at Champ de Mars', 'Champ de Mars, Paris, France', 'nature', 65, 8, 50, 63, 'upcoming', true),
    route('paris-arc', 4, '16:00', 'Arc de Triomphe at golden hour', 'Arc de Triomphe, Paris, France', 'culture', 80, 24, 72, 47, 'upcoming'),
    route('paris-versailles', 5, '09:00', 'Château de Versailles', 'Palace of Versailles, Versailles, France', 'culture', 210, 65, 34, 55, 'upcoming'),
    route('paris-gardens', 5, '13:30', 'Versailles gardens walk', 'Gardens of Versailles, Versailles, France', 'nature', 110, 10, 52, 63, 'upcoming', true),
    route('paris-farewell', 5, '19:30', 'Seine farewell dinner', 'Saint-Germain-des-Prés, Paris, France', 'food', 105, 60, 70, 48, 'upcoming'),
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

const itineraryFromPlaces = (destination: string, duration: number, places: PlaceAttraction[], hotel: { name: string; location: string }): ItineraryItem[] => {
  const perDay = Math.max(1, Math.ceil(places.length / duration));
  return Array.from({ length: duration }, (_, dayIndex) => {
    const day = dayIndex + 1;
    const candidates = places.slice(dayIndex * perDay, (dayIndex + 1) * perDay);
    const food = candidates.filter((place) => place.category === 'food');
    const experiences = candidates.filter((place) => place.category !== 'food');
    const morning = experiences[0] ?? candidates[0];
    const afternoon = experiences[1];
    const lunch = food[0];
    const dinner = food[1];
    const items: ItineraryItem[] = [];
    if (day === 1) items.push(route(`hotel-start-${day}`, day, '14:30', `Check in · ${hotel.name}`, hotel.location, 'stay', 30, 0, 50, 50, 'current'));
    else items.push(route(`hotel-start-${day}`, day, '08:00', `Breakfast · ${hotel.name}`, hotel.location, 'food', 50, 0, 50, 50, 'upcoming'));
    if (morning) items.push(route(`place-${morning.id}`, day, day === 1 ? '16:00' : '09:30', morning.name, morning.address, morning.category, 95, 25, 35, 45, 'upcoming', morning.category !== 'food'));
    if (day > 1) items.push(lunch ? route(`place-${lunch.id}`, day, '12:30', `Lunch · ${lunch.name}`, lunch.address, 'food', 75, 18, 55, 58, 'upcoming') : route(`lunch-${day}`, day, '12:30', 'Lunch near today’s route', `${destination} city center`, 'food', 70, 18, 55, 58, 'upcoming'));
    if (afternoon) items.push(route(`place-${afternoon.id}`, day, '15:30', afternoon.name, afternoon.address, afternoon.category, 95, 22, 68, 48, 'upcoming', afternoon.category !== 'food'));
    items.push(dinner ? route(`place-${dinner.id}`, day, '19:00', `Dinner · ${dinner.name}`, dinner.address, 'food', 90, 25, 72, 58, 'upcoming') : route(`dinner-${day}`, day, '19:00', `Dinner near ${hotel.name}`, hotel.location, 'food', 90, 25, 72, 58, 'upcoming'));
    items.push(route(`hotel-return-${day}`, day, '21:00', `Return to · ${hotel.name}`, hotel.location, 'stay', 10, 20, 50, 50, 'upcoming'));
    return items;
  }).flat();
};

const groupPreference: GroupPreference = {
  interestScores: { culture: 4.75, history: 3.5, food: 4.25, photography: 3.5, shopping: 2, nightlife: 2.25, nature: 3.25 },
  recommendedPace: 'Balanced discovery',
  explanation: 'The route balances Hema’s food and culture priorities with Sarah’s local-food, photography, and shopping interests.',
};

export class DemoStore {
  private trip: Trip;

  constructor() {
    this.trip = {
      schemaVersion: 2,
      id: 'trip-tokyo-2026', name: 'Tokyo, together', dates: '12–16 Oct 2026',
      request: { origin: 'San Francisco', destination: 'Tokyo', departureDate: '2026-10-12', returnDate: '2026-10-16', duration: 5, travelers: 2, budget: 4000, travelStyle: 'balanced discovery', foodPreferences: ['vegetarian friendly', 'local food'], interests: ['food', 'culture', 'photography'] },
      travelers: structuredClone(travelers),
      groupPreference: structuredClone(groupPreference),
      flights: [
        { id: 'f-aa', airline: 'American Airlines', code: 'AA 8400', departure: 'SFO', arrival: 'HND', departureTime: '11:45', arrivalTime: '16:20 +1', price: 990, duration: '11h 35m', stops: 0, selected: true },
        { id: 'f-ana', airline: 'ANA', code: 'NH 107', departure: 'SFO', arrival: 'HND', departureTime: '13:10', arrivalTime: '17:45 +1', price: 1055, duration: '11h 35m', stops: 0 },
        { id: 'f-united', airline: 'United', code: 'UA 875', departure: 'SFO', arrival: 'HND', departureTime: '10:40', arrivalTime: '15:30 +1', price: 980, duration: '11h 50m', stops: 0 },
      ],
      hotels: [
        { id: 'h-k5', name: 'Hotel K5', location: 'Nihonbashi, Tokyo', rating: 4.8, price: 298, totalPrice: 894, image: 'K5', amenities: ['Design hotel', 'Walkable', 'Breakfast'], selected: true },
        { id: 'h-nol', name: 'nol kyoto sanjo', location: 'Sanjo, Kyoto', rating: 4.7, price: 235, totalPrice: 470, image: 'nol', amenities: ['Central Kyoto', 'Family room', 'Laundry'] },
        { id: 'h-thegate', name: 'THE GATE HOTEL', location: 'Kaminarimon, Tokyo', rating: 4.6, price: 208, totalPrice: 624, image: 'Gate', amenities: ['Rooftop', 'Metro access', 'Gym'] },
      ],
      itinerary: structuredClone(itinerary),
      budget: { total: 4000, spent: 3486, remaining: 514, flight: 990 * 2, hotel: 894, activities: 410, food: 202 },
      travelDna: { culture: 4, history: 2, photography: 4, shopping: 4, nightlife: 2, food: 5, learning: 'The group values local food, photography, and flexible neighborhood time.' },
      events: [],
      progress: 28,
      progressState: { completionPercent: 23, scheduleVarianceMins: 0, completedStopIds: ['i-hotel', 'i-sensoji', 'i-izakaya'], skippedStopIds: [] },
      preferenceCollection: defaultSarahPreference(),
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
    const normalizedDates = normalizedTripDates(migrated.request.departureDate, migrated.request.returnDate, migrated.request.duration);
    migrated.request = { ...migrated.request, ...normalizedDates };

    // Browser storage may still contain the former default roster. Those IDs
    // identify seeded demo data (not a user-created Sarah), so migrate them
    // in place before the app renders the consent card.
    const legacyFriend = migrated.travelers.find((traveler) => traveler.id === 't-sarah');
    if (legacyFriend) {
      Object.assign(legacyFriend, structuredClone(DEFAULT_FRIEND));
      const legacyAdmin = migrated.travelers.find((traveler) => traveler.id === 't-admin');
      if (legacyAdmin?.name === 'Sarah Siddharth') {
        legacyAdmin.name = DEFAULT_ADMIN.name;
        legacyAdmin.phone = DEFAULT_ADMIN.phone;
        legacyAdmin.initials = 'HE';
      }
      if (migrated.preferenceCollection) {
        migrated.preferenceCollection.adminName = legacyAdmin?.name ?? DEFAULT_ADMIN.name;
        migrated.preferenceCollection.calls = migrated.preferenceCollection.calls.map((call) => call.travelerId === 't-sarah'
          ? { ...call, ...defaultSarahPreference().calls[0] }
          : call,
        );
        const agreement = migrated.preferenceCollection.agreement;
        if (agreement?.counterpartId === 't-sarah') {
          agreement.counterpartId = 't-sarah';
          agreement.counterpartName = DEFAULT_FRIEND.name;
        }
      }
    }
    const sarah = migrated.travelers.find((traveler) => traveler.id === 't-sarah');
    if (sarah) Object.assign(sarah, structuredClone(DEFAULT_FRIEND));
    if (migrated.preferenceCollection && sarah) {
      const canonicalSarahCall = defaultSarahPreference().calls[0];
      const sarahCall = migrated.preferenceCollection.calls.find((call) => call.travelerId === 't-sarah');
      if (sarahCall) Object.assign(sarahCall, canonicalSarahCall);
      else migrated.preferenceCollection.calls.unshift(canonicalSarahCall);
    }
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
    this.normalizeMealWindows();
    // Upgrade saved demo trips created before the labeled AA bundle inventory.
    // Real Sabre selections are never replaced because they do not use the
    // Journey Air placeholder brand.
    if (this.trip.flights.some((flight) => flight.airline === 'Journey Air')) {
      this.setBookingOptions(this.trip.request.destination, this.trip.request.origin);
    }
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
    const rawDuration = Math.round((returning.getTime() - departure.getTime()) / 86_400_000) + 1;
    if (rawDuration > MAX_ITINERARY_DAYS) throw new Error(`For this demo, choose a trip of up to ${MAX_ITINERARY_DAYS} days.`);
    const duration = rawDuration;
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
    if (stop.status === 'in-progress') return this.getTrip();
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
    if (stop.status === 'completed') return this.getTrip();
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
    if (stop.status === 'skipped') return this.getTrip();
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

  completePreferenceCall(input: {
    travelerId: string;
    outcome: 'completed' | 'no-answer' | 'failed' | 'canceled';
    mustDo?: string[];
    avoid?: string[];
    pace?: string;
    food?: string;
    summary: string;
  }): Trip {
    const collection = this.trip.preferenceCollection;
    if (!collection) throw new Error('Start preference calls before submitting a call result.');
    const traveler = this.trip.travelers.find((item) => item.id === input.travelerId)
      ?? this.trip.travelers.find((item) => item.name.toLowerCase() === input.travelerId.trim().toLowerCase());
    const call = traveler ? collection.calls.find((item) => item.travelerId === traveler.id) : undefined;
    if (!traveler || !call) throw new Error('The traveler is not part of the active preference calls.');

    const mustDo = input.mustDo?.filter(Boolean) ?? [];
    const avoid = input.avoid?.filter(Boolean) ?? [];
    const priorities = [...mustDo, ...(input.food ? [input.food] : []), ...(input.pace ? [`${input.pace} pace`] : [])].slice(0, 4);
    Object.assign(call, {
      status: input.outcome,
      summary: input.summary,
      topPriorities: input.outcome === 'completed' ? priorities : [],
      compromise: input.outcome === 'completed'
        ? `${mustDo.length ? `Protect ${mustDo[0]}. ` : ''}${avoid.length ? `Avoid ${avoid.join(' and ')}. ` : ''}JourneyOS will rebalance the group itinerary.`
        : input.outcome === 'no-answer' ? 'No preferences were collected; keep this traveler’s plan fit neutral until they respond.' : 'No preferences were collected from this call.',
    });

    if (input.outcome === 'completed') {
      const pace = /^(easy|slow|relaxed|unhurried)$/i.test(input.pace ?? '') ? 'easy' : /^(full|fast|packed|active)$/i.test(input.pace ?? '') ? 'full' : 'balanced';
      const preferenceText = `${mustDo.join(' ')} ${avoid.join(' ')} ${input.food ?? ''}`.toLowerCase();
      const nextInterests = { ...traveler.interests };
      if (/anime|shopping|market|fashion/.test(preferenceText)) nextInterests.shopping = 5;
      if (/food|street food|restaurant|sushi|vegetarian|vegan/.test(preferenceText)) nextInterests.food = 5;
      if (/museum|history|temple|culture|art/.test(preferenceText)) { nextInterests.culture = 5; nextInterests.history = Math.max(nextInterests.history, 4); }
      if (/photo|photography|view|scenic/.test(preferenceText)) nextInterests.photography = 5;
      if (/nature|hike|park|beach/.test(preferenceText)) nextInterests.nature = 5;
      Object.assign(traveler, { pacePreference: pace, activityLevel: pace === 'easy' ? 2 : pace === 'full' ? 4 : 3, ...(input.food ? { foodPreference: input.food } : {}), interests: nextInterests });
      this.afterTravelerChange(`${traveler.name}'s voice preferences were collected`);
    } else {
      this.recalculateHappiness();
      this.trip.events.unshift({ id: `preference-call-${Date.now()}`, type: 'tired', title: `${traveler.name}'s preference call ${input.outcome}`, createdAt: new Date().toISOString(), explanation: input.summary });
    }

    const completed = collection.calls.filter((item) => item.status === 'completed').length;
    collection.approvalSummary = completed
      ? `${completed} traveler preference${completed === 1 ? '' : 's'} collected. JourneyOS has refreshed group fit and the compromise route.`
      : 'No preference calls have completed yet.';
    return this.getTrip();
  }

  startNegotiation(travelerId: string, source: PreferenceCollection['source'] = 'mock'): Trip {
    const traveler = this.trip.travelers.find((item) => item.id === travelerId);
    if (!traveler || traveler === this.trip.travelers[0]) throw new Error('Choose one friend to negotiate with.');
    const admin = this.trip.travelers[0];
    const savedCalls = this.trip.preferenceCollection?.calls ?? [];
    // Keep the admin's live brief and the first friend's collected profile available
    // before Friend 2 is called. The live caller is never treated as a known profile.
    const knownProfiles = [
      ...(admin ? [admin] : []),
      ...this.trip.travelers.filter((item) => item.id !== traveler.id && item.id !== admin?.id),
    ].slice(0, 2);
    const counterpart = knownProfiles.find((profile) => profile.id !== admin?.id) ?? admin;
    if (!counterpart) throw new Error('Add another traveler before starting a negotiation.');
    const priorities = (Object.entries(traveler.interests) as Array<[Interest, number]>).sort((left, right) => right[1] - left[1]);
    const availableDays = [...new Set(this.trip.itinerary.map((item) => item.day))].sort((left, right) => left - right);
    const affectedDay = availableDays.find((day) => day >= 2) ?? availableDays[0] ?? 1;
    const agreementId = `negotiation-${Date.now()}`;
    const currentFit = groupHappiness(this.trip.travelers, this.trip.itinerary, this.trip.request.duration);
    const beforeHappiness = currentFit.groupHappiness;
    const pendingConflict = `Waiting to hear ${traveler.name}'s live priority before detecting a conflict.`;
    this.trip.preferenceCollection = {
      adminName: admin?.name ?? 'Trip admin', adminWeight: 1.5, source, status: 'pending',
      calls: [
        ...knownProfiles.map((profile) => {
          const saved = savedCalls.find((call) => call.travelerId === profile.id && call.status === 'completed');
          return saved
            ? { ...saved, name: profile.name, phone: profile.phone ?? saved.phone }
            : { travelerId: profile.id, name: profile.name, phone: profile.phone ?? '', status: 'completed' as const, happiness: beforeHappiness, topPriorities: (Object.entries(profile.interests) as Array<[Interest, number]>).sort((left, right) => right[1] - left[1]).slice(0, 2).map(([interest]) => interestLabel(interest)), summary: `${profile.name}'s preferences are already available for live comparison.`, compromise: 'Saved context for the live negotiation.' };
        }),
        { travelerId: traveler.id, name: traveler.name, phone: traveler.phone ?? '', status: source === 'vocal-bridge' ? 'dialing' : 'queued', happiness: beforeHappiness, topPriorities: priorities.slice(0, 2).map(([interest]) => interestLabel(interest)), summary: `JourneyOS will hear ${traveler.name}'s live preference, compare it with the saved profiles, and negotiate only if a conflict emerges.`, compromise: 'Waiting for the traveler to speak.' },
      ],
      negotiation: pendingConflict,
      approvalSummary: `${knownProfiles.length} preference profile${knownProfiles.length === 1 ? '' : 's'} loaded. The live conflict has not been assumed.`,
      agreement: {
        id: agreementId, travelerId: traveler.id, travelerName: traveler.name, counterpartId: counterpart.id, counterpartName: counterpart.name, conflict: pendingConflict,
        rationale: `JourneyOS will compare ${traveler.name}'s spoken request with the saved group profiles before naming any conflict.`,
        proposal: 'No compromise has been proposed yet.', accepted: false, status: 'calling', affectedDay, beforeHappiness, afterHappiness: beforeHappiness,
        agreedChanges: [], preview: [], itineraryChanges: [], dialogue: [],
      },
    };
    this.trip.events.unshift({ id: `negotiation-start-${Date.now()}`, type: 'tired', title: `AI Negotiator called ${traveler.name}`, createdAt: new Date().toISOString(), explanation: pendingConflict });
    return this.getTrip();
  }

  completeNegotiation(input: { travelerId: string; accepted: boolean; travelerResponse: string; statedPreference?: string; counterpartId?: string; conflict?: string; rationale?: string; proposal?: string; affectedDay?: number; agreedChanges?: string[]; itineraryChanges?: Array<{ time: string; title: string; subtitle: string; category: 'food' | 'experience' }>; dialogue?: Array<{ speaker: 'agent' | 'traveler'; text: string }> }): Trip {
    const collection = this.trip.preferenceCollection;
    const agreement = collection?.agreement;
    if (!collection || !agreement || agreement.travelerId !== input.travelerId) throw new Error('Start this negotiation before submitting its result.');
    const call = collection.calls.find((item) => item.travelerId === input.travelerId);
    if (!call) throw new Error('The traveler is not part of this negotiation.');
    const traveler = this.trip.travelers.find((item) => item.id === input.travelerId);
    const savedProfiles = this.trip.travelers.filter((item) => item.id !== input.travelerId && item.id !== this.trip.travelers[0]?.id);
    const spokenPreference = (input.statedPreference ?? input.travelerResponse).trim();
    const counterpart = this.trip.travelers.find((item) => item.id === input.counterpartId)
      ?? (/night|late|party|bar|club/i.test(spokenPreference) ? savedProfiles.find((item) => /vegetarian|vegan|allergy|shellfish|gluten/i.test(item.foodPreference) || item.pacePreference === 'easy') : undefined)
      ?? (/packed|many|fast|adventure|hike/i.test(spokenPreference) ? savedProfiles.find((item) => item.pacePreference === 'easy') : undefined)
      ?? savedProfiles[0]
      ?? this.trip.travelers[0];
    if (!traveler || !counterpart) throw new Error('The active negotiation needs both a caller and a saved traveler profile.');
    const counterpartCall = collection.calls.find((item) => item.travelerId === counterpart.id);
    const constraint = counterpart.foodPreference && counterpart.foodPreference !== 'No preference added' ? counterpart.foodPreference.toLowerCase() : `${counterpart.pacePreference} pace`;
    const isEveningRequest = /night|late|party|bar|club|music|concert|evening/i.test(spokenPreference);
    const hasEarlyDinner = /early dinner/i.test(counterpartCall?.topPriorities.join(' ') ?? '') || /early dinner/i.test(counterpartCall?.summary ?? '');
    const dallasDinnerTrade = /dallas/i.test(this.trip.request.destination) && isEveningRequest && hasEarlyDinner;
    const requestedExperience = /music|concert/i.test(spokenPreference) ? 'live music' : /night|party|bar|club/i.test(spokenPreference) ? 'nightlife' : /food|dinner|lunch|restaurant|vegan|vegetarian/i.test(spokenPreference) ? 'food' : /photo/i.test(spokenPreference) ? 'photography' : /shop|market/i.test(spokenPreference) ? 'shopping' : /hike|nature|park/i.test(spokenPreference) ? 'nature' : 'requested experience';
    const destination = this.trip.request.destination;
    const affectedDay = Math.min(Math.max(1, input.affectedDay ?? agreement.affectedDay), this.trip.request.duration);
    const dayTimes = this.trip.itinerary.filter((item) => item.day === affectedDay && !['stay', 'transport'].includes(item.category)).map((item) => minutesFromTime(item.time)).filter((time) => time < 20 * 60);
    const lastCoreTime = dayTimes.length ? Math.max(...dayTimes) : 16 * 60;
    const sharedTime = timeFromMinutes(Math.min(19 * 60, Math.max(17 * 60, lastCoreTime + 120)));
    const optionalTime = timeFromMinutes(minutesFromTime(sharedTime) + 150);
    const generatedChanges = input.itineraryChanges?.length ? input.itineraryChanges.map((change, index) => ({ ...change, id: `${agreement.id}-change-${index + 1}` })) : dallasDinnerTrade ? [
      { id: `${agreement.id}-shared`, time: '18:00', title: 'Early vegetarian-friendly group dinner', subtitle: `${destination} · protects ${counterpart.name}'s early dinner and pescetarian needs`, category: 'food' as const },
      { id: `${agreement.id}-optional`, time: '20:00', title: 'Optional live music', subtitle: `${destination} · protects ${traveler.name}'s evening-out priority`, category: 'experience' as const },
    ] : [
      { id: `${agreement.id}-shared`, time: sharedTime, title: /vegetarian/i.test(constraint) ? 'Vegetarian group dinner' : /vegan/i.test(constraint) ? 'Vegan group dinner' : 'Shared group activity', subtitle: `${destination} · protects ${counterpart.name}'s constraint`, category: 'food' as const },
      { id: `${agreement.id}-optional`, time: optionalTime, title: `Optional ${requestedExperience}`, subtitle: `${destination} · protects ${traveler.name}'s live request`, category: 'experience' as const },
    ];
    const currentFit = groupHappiness(this.trip.travelers, this.trip.itinerary, this.trip.request.duration);
    const beforeHappiness = currentFit.groupHappiness;
    const afterHappiness = Math.min(NEGOTIATION_POLICY.maximumFit, beforeHappiness + Math.max(NEGOTIATION_POLICY.minimumFitGain, Math.ceil(currentFit.fairnessGap / 2)));
    agreement.counterpartId = counterpart.id;
    agreement.counterpartName = counterpart.name;
    agreement.conflict = input.conflict?.trim() || (dallasDinnerTrade
      ? `${traveler.name}'s request for late live music competes with ${counterpart.name}'s early vegetarian-friendly dinner.`
      : `${traveler.name}'s live request for ${requestedExperience} competes with ${counterpart.name}'s ${constraint} constraint.`);
    agreement.rationale = input.rationale?.trim() || (dallasDinnerTrade
      ? `${traveler.name} wants an evening out, while ${counterpart.name} has already asked for an early pescetarian-friendly dinner. Moving the shared dinner late would make both priorities harder to protect.`
      : `${traveler.name} asked for “${spokenPreference},” while the saved profile says ${counterpart.name} needs ${constraint}. Both can be protected with a shared-first, optional-after sequence.`);
    agreement.proposal = input.proposal?.trim() || (dallasDinnerTrade
      ? 'Dinner together around 18:00, followed by optional live music for anyone who wants to continue.'
      : `Schedule ${generatedChanges[0].title.toLowerCase()} at ${generatedChanges[0].time}, then keep ${requestedExperience} optional from ${generatedChanges[1]?.time ?? optionalTime}.`);
    agreement.affectedDay = affectedDay;
    agreement.beforeHappiness = beforeHappiness;
    agreement.afterHappiness = afterHappiness;
    agreement.itineraryChanges = generatedChanges;
    agreement.agreedChanges = input.agreedChanges?.length ? input.agreedChanges : generatedChanges.map((change) => `${change.title} at ${change.time}`);
    agreement.preview = generatedChanges.map((change) => ({ label: change.category === 'food' ? 'Shared plan' : 'Traveler request', before: agreement.conflict, after: `${change.time} ${change.title}` }));
    collection.negotiation = agreement.conflict;
    const dialogue = input.dialogue?.length ? input.dialogue : [
      { speaker: 'agent' as const, text: `Hi ${agreement.travelerName}. ${collection.adminName} is organizing ${this.trip.request.destination}, and I already know the group's priorities. I need your help resolving one conflict.` },
      { speaker: 'traveler' as const, text: spokenPreference },
      { speaker: 'agent' as const, text: `${agreement.rationale} ${agreement.proposal} Would that work for you?` },
      { speaker: 'traveler' as const, text: input.travelerResponse },
      { speaker: 'agent' as const, text: input.accepted ? `Perfect. I found a compromise that protects both your priority and ${agreement.counterpartName}'s constraint. I'll send it to ${collection.adminName} for review.` : `Understood. I won't change the itinerary; ${collection.adminName} can review another option.` },
    ];
    Object.assign(call, { status: 'completed' as const, summary: input.accepted ? `${agreement.travelerName} accepted the proposed trade with ${agreement.counterpartName}.` : `${agreement.travelerName} declined the proposed trade.`, compromise: input.accepted ? agreement.proposal : 'No agreement yet.', happiness: input.accepted ? agreement.afterHappiness : agreement.beforeHappiness, dialogue });
    Object.assign(agreement, { accepted: input.accepted, status: input.accepted ? 'accepted' as const : 'declined' as const, travelerResponse: input.travelerResponse, dialogue });
    collection.approvalSummary = input.accepted ? `Conflict resolved. Group plan fit rises from ${agreement.beforeHappiness}% to ${agreement.afterHappiness}% after admin approval.` : 'The traveler declined this proposal; no itinerary change was made.';
    const currentGap = this.trip.groupPreference.fairnessGap ?? 0;
    Object.assign(this.trip.groupPreference, { groupHappiness: input.accepted ? agreement.afterHappiness : agreement.beforeHappiness, averageHappiness: input.accepted ? agreement.afterHappiness : agreement.beforeHappiness, fairnessGap: input.accepted ? Math.max(0, currentGap - (agreement.afterHappiness - agreement.beforeHappiness)) : currentGap, fairnessPenalty: 0, explanation: input.accepted ? agreement.proposal : agreement.conflict });
    this.trip.events.unshift({ id: `negotiation-result-${Date.now()}`, type: 'tired', title: input.accepted ? 'Conflict resolved by voice' : 'Negotiation needs admin review', createdAt: new Date().toISOString(), explanation: collection.approvalSummary });
    return this.getTrip();
  }

  applyNegotiation(): Trip {
    const collection = this.trip.preferenceCollection;
    const agreement = collection?.agreement;
    if (!collection || !agreement?.accepted) throw new Error('An accepted negotiation is required before changing the itinerary.');
    const changes = agreement.itineraryChanges.map((change, index) => route(change.id, agreement.affectedDay, change.time, change.title, change.subtitle, change.category, 64 + index * 8, 54 + index * 12, index === 0 ? 90 : 75, index === 0 ? 25 : 18, 'moved'));
    this.trip.itinerary = this.trip.itinerary.filter((item) => !changes.some((change) => change.id === item.id));
    this.trip.itinerary.push(...changes);
    this.trip.itinerary.sort((left, right) => left.day - right.day || left.time.localeCompare(right.time));
    agreement.status = 'applied';
    collection.status = 'approved';
    collection.approvalSummary = `${collection.adminName} approved the negotiated trade. Day ${agreement.affectedDay} now includes ${agreement.agreedChanges.join(' and ')}.`;
    this.trip.events.unshift({ id: `negotiation-applied-${Date.now()}`, type: 'tired', title: `Negotiated agreement applied to Day ${agreement.affectedDay}`, createdAt: new Date().toISOString(), explanation: collection.approvalSummary });
    return this.getTrip();
  }

  restoreStop(id: string): Trip {
    const stop = this.trip.itinerary.find((item) => item.id === id);
    if (!stop) throw new Error('That itinerary stop no longer exists.');
    if (stop.status === 'upcoming' && !stop.completedAt && !stop.startedAt) return this.getTrip();
    const progress = this.ensureProgress();
    if (progress.activeStopId === stop.id) progress.activeStopId = undefined;
    if (typeof stop.varianceMins === 'number') progress.scheduleVarianceMins -= stop.varianceMins;
    stop.status = 'upcoming';
    delete stop.startedAt;
    delete stop.completedAt;
    delete stop.actualDurationMins;
    delete stop.varianceMins;
    this.recordProgressEvent(`${stop.title} restored`, 'The stop is active again and can be completed, skipped, or changed by voice.');
    this.updateProgress();
    return this.getTrip();
  }

  applyItineraryCommand(query: string, activeDay: number): { trip: Trip; message: string; affectedStopIds: string[] } {
    const spoken = query.toLowerCase().trim();
    const dayItems = this.trip.itinerary.filter((item) => item.day === activeDay).sort((a, b) => a.time.localeCompare(b.time));
    if (!dayItems.length) throw new Error(`Day ${activeDay} has no itinerary stops.`);

    const ordinal = spoken.match(/(?:place|stop|activity|item)\s*(\d+)/i)?.[1];
    const targetWords = spoken.split(/[^a-z0-9]+/).filter((word) => word.length > 3 && !['mark', 'complete', 'completed', 'cancel', 'remove', 'restore', 'undo', 'activity', 'place', 'stop', 'today', 'evening', 'morning', 'afternoon'].includes(word));
    const unfinished = dayItems.filter((item) => !['completed', 'skipped'].includes(item.status));
    let targets = ordinal ? dayItems.slice(Math.max(0, Number(ordinal) - 1), Number(ordinal)) : [];
    if (!targets.length && /\b(evening|tonight)\b/.test(spoken)) targets = dayItems.filter((item) => Number(item.time.slice(0, 2)) >= 17 && !['stay', 'transport'].includes(item.category));
    if (!targets.length && /\b(morning)\b/.test(spoken)) targets = dayItems.filter((item) => Number(item.time.slice(0, 2)) < 12 && !['stay', 'transport'].includes(item.category));
    if (!targets.length && /\b(afternoon)\b/.test(spoken)) targets = dayItems.filter((item) => { const hour = Number(item.time.slice(0, 2)); return hour >= 12 && hour < 17 && !['stay', 'transport'].includes(item.category); });
    if (!targets.length && /\b(rest|remaining)\b/.test(spoken)) targets = unfinished.filter((item) => !['stay', 'transport'].includes(item.category));
    if (!targets.length && targetWords.length) {
      const scored = dayItems.map((item) => ({ item, score: targetWords.filter((word) => `${item.title} ${item.subtitle}`.toLowerCase().includes(word)).length })).sort((a, b) => b.score - a.score);
      if (scored[0]?.score) targets = [scored[0].item];
    }
    if (!targets.length) targets = [this.trip.itinerary.find((item) => item.id === this.ensureProgress().activeStopId && item.day === activeDay) ?? unfinished[0] ?? dayItems[0]];

    let action: 'complete' | 'restore' | 'start' | 'skip' | 'delay';
    if (/\b(undo|restore|reopen|not done|uncomplete)\b/.test(spoken)) action = 'restore';
    else if (/\b(saw|visited|done|finished|complete|completed)\b/.test(spoken)) action = 'complete';
    else if (/\b(start|begin|arrived|here now)\b/.test(spoken)) action = 'start';
    else if (/\b(cancel|skip|remove|drop)\b/.test(spoken)) action = 'skip';
    else if (/\b(late|delay|delayed|behind|stuck)\b/.test(spoken)) action = 'delay';
    else throw new Error('Say what to change, for example “mark place 2 complete”, “undo place 2”, or “cancel the evening activity”.');

    if (action === 'delay') {
      const minutes = Math.min(240, Math.max(1, Number(spoken.match(/(\d+)\s*(?:minute|min)/)?.[1] ?? 30)));
      const trip = this.reportDelay(minutes);
      return { trip, message: `Day ${activeDay} is updated for a ${minutes}-minute delay.`, affectedStopIds: targets.map((item) => item.id) };
    }
    for (const target of targets) {
      if (action === 'complete') this.completeStop(target.id);
      else if (action === 'restore') this.restoreStop(target.id);
      else if (action === 'start') this.startStop(target.id);
      else this.skipStop(target.id);
    }
    const verb = action === 'complete' ? 'completed' : action === 'restore' ? 'restored' : action === 'start' ? 'started' : 'removed from today';
    return { trip: this.getTrip(), message: `${targets.map((item) => item.title).join(', ')} ${verb}.`, affectedStopIds: targets.map((item) => item.id) };
  }

  completeSimulatedSarahInterview(): Trip {
    const maya = this.trip.travelers.find((traveler) => traveler.name === 'Sarah') ?? this.trip.travelers[1];
    if (!maya) throw new Error('Add a traveler before starting the preference interview.');
    Object.assign(maya, {
      name: 'Sarah', initials: 'PR', pacePreference: 'balanced' as const, foodPreference: 'Street food',
      interests: interests({ culture: 1, history: 1, food: 5, photography: 3, shopping: 5, nightlife: 3, nature: 2 }),
    });
    const shrine = this.trip.itinerary.find((item) => item.id === 'i-meiji');
    if (shrine) Object.assign(shrine, { time: '11:00', title: 'Meiji Shrine · later start', status: 'moved' as const });
    const teamLab = this.trip.itinerary.find((item) => item.id === 'i-teamlab');
    if (teamLab) Object.assign(teamLab, { time: '18:00', status: 'moved' as const });
    if (!this.trip.itinerary.some((item) => item.id === 'maya-akihabara')) this.trip.itinerary.push(route('maya-akihabara', 2, '15:30', 'Akihabara anime shopping', 'Akihabara · Tokyo · must-do for Maya', 'experience', 58, 52, 100, 18, 'moved'));
    this.trip.itinerary.sort((left, right) => left.day - right.day || left.time.localeCompare(right.time));
    this.afterTravelerChange('Maya’s simulated voice interview completed');
    this.trip.preferenceCollection = {
      adminName: this.trip.travelers[0]?.name ?? 'Trip admin', adminWeight: 1.5, source: 'mock', status: 'pending',
      calls: [{ travelerId: maya.id, name: 'Maya', phone: 'Simulated traveler agent', status: 'completed', happiness: 81, topPriorities: ['anime shopping', 'street food', 'later mornings'], summary: 'Maya wants anime shopping in Akihabara, street food, moderate walking, and no early mornings or temple-heavy days.', compromise: 'Akihabara is protected on Day 2. The family’s highest-priority shrine begins later, and the evening experience remains intact.', happinessExplanation: 'Maya’s must-do is now protected without removing the group’s core culture highlight.', dialogue: [{ speaker: 'agent', text: 'What is the one thing you definitely want to do in Tokyo?' }, { speaker: 'traveler', text: 'Anime shopping in Akihabara.' }, { speaker: 'agent', text: 'Anything you would rather avoid?' }, { speaker: 'traveler', text: 'Too many temples and early mornings.' }, { speaker: 'agent', text: 'How much walking is comfortable?' }, { speaker: 'traveler', text: 'Moderate walking is fine.' }] }],
      negotiation: 'Maya’s anime-shopping must-do conflicts with the culture-heavy Day 2. JourneyOS kept the family shrine, added Akihabara, and moved the first activity later.',
      approvalSummary: 'Maya’s plan fit rises from 42% to 81%; the revised plan keeps every traveler above the demo fairness floor of 72%.',
    };
    Object.assign(this.trip.groupPreference, { groupHappiness: 86, averageHappiness: 86, fairnessGap: 9, fairnessPenalty: 0, explanation: 'The Day 2 compromise protects Maya’s Akihabara must-do, preserves the family shrine, and avoids an early start.' });
    this.trip.events.unshift({ id: `maya-preferences-${Date.now()}`, type: 'tired', title: 'Maya preference interview completed', createdAt: new Date().toISOString(), explanation: 'Akihabara was added to Day 2, the shrine moved later, and group satisfaction was recalculated.' });
    return this.getTrip();
  }

  completeSimulatedMayaInterview(): Trip {
    return this.completeSimulatedSarahInterview();
  }

  startSarahPreferenceCall(): Trip {
    const maya = this.trip.travelers.find((traveler) => traveler.name === 'Sarah') ?? this.trip.travelers[1];
    if (!maya) throw new Error('Add a traveler before starting the preference interview.');
    this.trip.preferenceCollection = {
      adminName: this.trip.travelers[0]?.name ?? 'Trip admin', adminWeight: 1.5, source: 'vocal-bridge', status: 'pending',
      calls: [{ travelerId: maya.id, name: 'Maya', phone: 'Vocal Bridge simulated traveler agent', status: 'dialing', happiness: 42, topPriorities: [], summary: 'Calling Maya to collect activity, food, pace, and must-do preferences.', compromise: 'Awaiting Maya’s short preference interview.' }],
      negotiation: 'JourneyOS is collecting Maya’s preferences before generating a fair group compromise.',
      approvalSummary: 'Preference call in progress.',
    };
    this.trip.events.unshift({ id: `maya-call-${Date.now()}`, type: 'tired', title: 'Calling Maya’s simulated traveler agent', createdAt: new Date().toISOString(), explanation: 'JourneyOS started a short outbound Vocal Bridge call to collect only activity, food, pace, and must-do preferences.' });
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
    if (selected) {
      this.recalculateBudget(this.trip.budget.flight, selected.totalPrice);
      this.trip.itinerary = this.trip.itinerary.map((item) => {
        if (item.id.startsWith('hotel-start-')) return { ...item, title: item.day === 1 ? `Check in · ${selected.name}` : `Breakfast · ${selected.name}`, subtitle: selected.location };
        if (item.id.startsWith('hotel-return-')) return { ...item, title: `Return to · ${selected.name}`, subtitle: selected.location };
        if (item.id.startsWith('dinner-')) return { ...item, title: `Dinner near ${selected.name}`, subtitle: selected.location };
        return item;
      });
      this.trip.events.unshift({ id: `hotel-route-${Date.now()}`, type: 'tired', title: `Daily routes rebased to ${selected.name}`, createdAt: new Date().toISOString(), explanation: 'Every daily map route now starts and ends at the hotel selected in Booking & payment.' });
    }
    return this.getTrip();
  }

  updateFromRequest(request: Trip['request'], places: PlaceAttraction[] = [], briefTranscript?: string): Trip {
    const hadPriorBrief = Boolean(this.trip.briefTranscript);
    const dates = normalizedTripDates(request.departureDate ?? this.trip.request.departureDate, request.returnDate, request.duration);
    const normalizedRequest = { ...this.trip.request, ...request, ...dates, travelers: Math.max(2, Number(request.travelers) || 2) };
    this.trip.request = normalizedRequest;
    const { departureDate, returnDate, duration } = normalizedRequest;
    const departure = new Date(`${departureDate}T12:00:00Z`);
    const returning = new Date(`${returnDate}T12:00:00Z`);
    this.trip.dates = `${departure.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}–${returning.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
    // Partner voice flow: the first traveler is the organizer inferred from
    // the brief; the remaining slots are friends who can receive preference calls.
    if (!hadPriorBrief) {
      const inferredAdmin = adminFromBrief(briefTranscript, normalizedRequest);
      this.trip.travelers = [{ ...inferredAdmin, id: 't-admin' }, structuredClone(DEFAULT_FRIEND)];
    }
    this.trip.travelers = this.trip.travelers.slice(0, normalizedRequest.travelers);
    if (this.trip.travelers.length === 1) this.trip.travelers.push(structuredClone(DEFAULT_FRIEND));
    while (this.trip.travelers.length < normalizedRequest.travelers) {
      const number = this.trip.travelers.length + 1;
      const friendNumber = number - 1;
      this.trip.travelers.push({ id: `t-friend-${friendNumber}-${Date.now().toString(36)}`, name: `Friend ${friendNumber}`, initials: `F${friendNumber}`, budgetPreference: 'balanced', activityLevel: 3, pacePreference: 'balanced', foodPreference: 'No preference added', interests: interests({ culture: 3, food: 3, nature: 3 }) });
    }
    this.setBookingOptions(normalizedRequest.destination, normalizedRequest.origin);
    this.trip.name = `${normalizedRequest.destination}, together`;
    const selectedHotelForRoute = this.trip.hotels.find((hotel) => hotel.selected) ?? this.trip.hotels[0];
    this.trip.itinerary = places.length >= 2 && selectedHotelForRoute ? itineraryFromPlaces(normalizedRequest.destination, duration, places, selectedHotelForRoute) : itineraryFor(normalizedRequest.destination, duration);
    const selectedFlight = this.trip.flights.find((flight) => flight.selected) ?? this.trip.flights[0];
    const hotelNights = Math.max(1, duration - 1 - (selectedFlight?.arrivalTime.includes('+1') ? 1 : 0));
    this.trip.hotels = this.trip.hotels.map((hotel) => ({ ...hotel, totalPrice: hotel.price * hotelNights }));
    const selectedHotel = this.trip.hotels.find((hotel) => hotel.selected) ?? this.trip.hotels[0];
    if (selectedFlight && selectedHotel) this.recalculateBudget(selectedFlight.price * normalizedRequest.travelers, selectedHotel.totalPrice);
    this.trip.events = [{ id: `brief-${Date.now()}`, type: 'tired', title: `${normalizedRequest.destination} trip brief created`, createdAt: new Date().toISOString(), explanation: `${places.length >= 2 ? 'Google Places sourced real attractions for' : 'A curated route is ready for'} your ${duration}-day ${normalizedRequest.destination} itinerary. Every page now reflects this proposed trip.` }];
    this.trip.groupPreference = { ...this.trip.groupPreference, explanation: `The ${normalizedRequest.destination} route prioritizes ${normalizedRequest.interests.slice(0, 3).join(', ')} while keeping the group’s preferred pace.` };
    this.trip.preferenceCollection = defaultSarahPreference();
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
        'flight-delay': { title: 'Flight delayed by 4 hours', explanation: `JourneyOS protected late hotel check-in, shortened the arrival-day plan in ${this.trip.request.destination}, and moved the displaced priority to tomorrow.` },
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
      this.normalizeMealWindows();
      this.trip.itinerary.sort((left, right) => left.day - right.day || left.time.localeCompare(right.time));
      return this.getTrip();
    }
    const activeFlexibleStop = () => this.trip.itinerary.find((item) =>
      item.day === activeDay
      && !['completed', 'skipped', 'closed'].includes(item.status)
      && !['stay', 'transport'].includes(item.category))
      ?? this.trip.itinerary.find((item) => item.status === 'upcoming' && !['stay', 'transport'].includes(item.category));
    const changes: Record<TripEvent['type'], { title: string; explanation: string; mutate: () => void }> = {
      late: {
        title: 'Running late +90 minutes',
        explanation: 'The tea ceremony moved to Day 4 at 16:30. We kept your booked Shinkansen and removed the low-priority shopping buffer, so the group still reaches Arashiyama before closing.',
        mutate: () => {
          if (!activeDay) { this.move('i-tea', 4, '16:30', 'moved'); return; }
          const item = activeFlexibleStop();
          if (!item) return;
          const [hour, minute] = item.time.split(':').map(Number);
          const shifted = hour * 60 + minute + 90;
          Object.assign(item, { time: `${String(Math.floor(shifted / 60) % 24).padStart(2, '0')}:${String(shifted % 60).padStart(2, '0')}`, status: 'moved' as const });
        },
      },
      rain: {
        title: 'Heavy rain forecast',
        explanation: `JourneyOS replaced an outdoor stop on Day ${activeDay ?? 1} with an indoor alternative, preserving the group’s interests and the selected day’s route.`,
        mutate: () => {
          const item = activeFlexibleStop();
          if (item) Object.assign(item, { title: `Indoor alternative · ${item.title}`, category: 'museum' as const, weatherSensitive: false, status: 'moved' as const });
        },
      },
      'flight-delay': {
        title: 'Flight delayed by 4 hours',
        explanation: `JourneyOS shortened the selected Day ${activeDay ?? 1} plan for the delayed arrival and preserved the remaining fixed commitments.`,
        mutate: () => {
          const item = activeFlexibleStop();
          if (item) Object.assign(item, { title: `Delayed-arrival version · ${item.title}`, durationMins: Math.min(item.durationMins, 60), travelMins: Math.min(item.travelMins, 20), status: 'moved' as const });
        },
      },
      closed: {
        title: 'Attraction closed',
        explanation: `JourneyOS replaced the unavailable Day ${activeDay ?? 1} stop with a nearby option that preserves the group’s priorities and route order.`,
        mutate: () => {
          const item = activeFlexibleStop();
          if (item) Object.assign(item, { title: `Nearby replacement · ${item.title}`, status: 'moved' as const });
        },
      },
      tired: {
        title: 'Traveler energy is low',
        explanation: 'The full Fushimi Inari climb is now the first 45 minutes of gates, followed by a nearby café. This protects the group’s cultural highlight while reducing walking by 3.2 km.',
        mutate: () => {
          const item = activeDay ? activeFlexibleStop() : this.trip.itinerary.find((entry) => entry.id === 'i-fushimi');
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

  addReceipt(amount: number, restaurant: string, paidBy?: string, participantIds?: string[], category: 'food' | 'transport' | 'activity' | 'other' = 'food', splitPercentages?: Record<string, number>): Trip {
    const payer = this.trip.travelers.find((traveler) => traveler.id === paidBy)?.id ?? this.trip.travelers[0].id;
    const participants = participantIds?.filter((id) => this.trip.travelers.some((traveler) => traveler.id === id)) ?? this.trip.travelers.map((traveler) => traveler.id);
    this.trip.expenses ??= [];
    const validParticipants = participants.length ? participants : [payer];
    const customSplit = splitPercentages
      ? Object.fromEntries(validParticipants.map((id) => [id, splitPercentages[id] ?? 0]))
      : undefined;
    this.trip.expenses.unshift({ id: `expense-${Date.now()}`, description: restaurant, category, amount, paidBy: payer, participantIds: validParticipants, splitPercentages: customSplit, createdAt: new Date().toISOString() });
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

  private normalizeMealWindows() {
    for (const item of this.trip.itinerary) {
      if (item.id.startsWith('hotel-start-') && item.day > 1 && item.title.startsWith('Breakfast')) item.time = '08:00';
      else if ((item.id.startsWith('lunch-') || item.title.startsWith('Lunch')) && item.category === 'food') item.time = '12:30';
      else if ((item.id.startsWith('dinner-') || item.title.startsWith('Dinner')) && item.category === 'food') item.time = '19:00';
    }
  }

  private reprioritizeItinerary(scores: GroupPreference['interestScores']) {
    const scoreFor = (item: ItineraryItem) => item.category === 'food' ? scores.food : item.category === 'nature' ? (scores.nature + scores.photography) / 2 : item.category === 'culture' ? (scores.culture + scores.history) / 2 : item.category === 'museum' ? (scores.history + scores.culture) / 2 : item.category === 'experience' ? (scores.photography + scores.shopping + scores.nightlife) / 3 : 0;
    for (const day of new Set(this.trip.itinerary.map((item) => item.day))) {
      const flexible = this.trip.itinerary.filter((item) => item.day === day && !['completed', 'skipped', 'closed'].includes(item.status) && !['stay', 'transport', 'food'].includes(item.category)).sort((a, b) => a.time.localeCompare(b.time));
      const slots = flexible.map((item) => item.time);
      const ordered = flexible.slice().sort((a, b) => scoreFor(b) - scoreFor(a) || a.time.localeCompare(b.time));
      ordered.forEach((item, index) => {
        if (item.time !== slots[index]) item.status = 'moved';
        item.time = slots[index];
      });
    }
    this.normalizeMealWindows();
    this.trip.itinerary.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
  }

  private move(id: string, day: number, time: string, status: ItineraryItem['status']) {
    const item = this.trip.itinerary.find((entry) => entry.id === id);
    if (item) Object.assign(item, { day, time, status });
  }

  private setBookingOptions(destination: string, origin = this.trip.request.origin) {
    const place = destination.toLowerCase();
    const isYellowstone = place.includes('yellowstone') || place.includes('yellow stone');
    const isTahoe = place.includes('lake tahoe') || place.includes('tahoe');
    const isTokyo = place.includes('tokyo') || place.includes('japan');
    const airportCode = (value: string | undefined, fallback: string) => {
      const key = (value ?? '').trim().toLowerCase();
      const known: Record<string, string> = {
        'san francisco': 'SFO', 'new york': 'JFK', nyc: 'JFK', 'los angeles': 'LAX', chicago: 'ORD', seattle: 'SEA', boston: 'BOS', miami: 'MIA', dallas: 'DFW', 'san diego': 'SAN',
        hawaii: 'HNL', honolulu: 'HNL', maui: 'OGG', yellowstone: 'BZN', 'lake tahoe': 'RNO', tahoe: 'RNO',
        london: 'LHR', paris: 'CDG', rome: 'FCO', milan: 'MXP', barcelona: 'BCN', madrid: 'MAD', lisbon: 'LIS', amsterdam: 'AMS', berlin: 'BER', zurich: 'ZRH', vienna: 'VIE', istanbul: 'IST', athens: 'ATH',
        tokyo: 'NRT', japan: 'NRT', osaka: 'KIX', kyoto: 'KIX', seoul: 'ICN', beijing: 'PEK', shanghai: 'PVG', 'hong kong': 'HKG', singapore: 'SIN', bangkok: 'BKK', bali: 'DPS', phuket: 'HKT', sydney: 'SYD', auckland: 'AKL',
        delhi: 'DEL', mumbai: 'BOM', bangalore: 'BLR', bengaluru: 'BLR', chennai: 'MAA', hyderabad: 'HYD', kolkata: 'CCU', pune: 'PNQ', kochi: 'COK', ahmedabad: 'AMD', goa: 'GOI', india: 'DEL',
        dubai: 'DXB', 'abu dhabi': 'AUH', doha: 'DOH', mexico: 'MEX', cancun: 'CUN', 'new zealand': 'AKL', australia: 'SYD',
      };
      return known[key] ?? (/^[a-z]{3}$/i.test(key) ? key.toUpperCase() : fallback);
    };
    const arrival = isYellowstone ? 'BZN' : isTahoe ? 'RNO' : airportCode(destination, 'DST');
    const hotelName = isYellowstone ? 'Canyon Lodge & Cabins' : isTahoe ? 'Basecamp Tahoe South' : `${destination} Explorer Lodge`;
    const location = isYellowstone ? 'Canyon Village · Yellowstone' : isTahoe ? 'South Lake Tahoe · California' : destination.toLowerCase() === 'japan' ? 'Tokyo · Japan' : `Central ${destination}`;
    const valueLocation = isYellowstone ? 'West Yellowstone' : isTahoe ? 'Stateline · Lake Tahoe' : `Arts district · ${destination}`;
    const departure = airportCode(origin, 'SFO');
    this.trip.flights = [
      { id: 'f-primary', airline: isYellowstone ? 'United' : isTahoe ? 'Alaska' : 'American Airlines', code: isTokyo ? 'AA 8400' : isYellowstone ? 'UA 2146' : isTahoe ? 'AS 3381' : 'AA 48', departure, arrival, departureTime: isTokyo ? '11:45' : isYellowstone || isTahoe ? '08:10' : '16:10', arrivalTime: isTokyo ? '16:20 +1' : isYellowstone || isTahoe ? '11:42' : '11:25 +1', price: isTokyo ? 990 : isYellowstone || isTahoe ? 390 : 845, duration: isTokyo ? '11h 35m' : isYellowstone || isTahoe ? '3h 32m' : '10h 15m', stops: 0, selected: true },
      { id: 'f-value', airline: isTokyo ? 'Japan Airlines' : isYellowstone ? 'Delta' : isTahoe ? 'Southwest' : 'One-stop partner', code: isTokyo ? 'JL 001' : isYellowstone ? 'DL 1862' : isTahoe ? 'WN 2674' : 'BA 286', departure, arrival, departureTime: isTokyo ? '13:50' : '13:40', arrivalTime: isTokyo ? '18:25 +1' : '10:50 +1', price: isTokyo ? 935 : isYellowstone || isTahoe ? 335 : 735, duration: isTokyo ? '11h 35m' : isYellowstone || isTahoe ? '4h 15m' : '13h 10m', stops: isTokyo || isYellowstone ? 0 : 1 },
    ];
    this.trip.hotels = [
      { id: 'h-primary', name: hotelName, location, rating: 4.6, price: 290, totalPrice: 580, image: 'Primary stay', amenities: ['Central location', 'Breakfast'], selected: true },
      { id: 'h-value', name: `${destination} Basecamp`, location: valueLocation, rating: 4.4, price: 220, totalPrice: 440, image: 'Value stay', amenities: ['Neighborhood access', 'Local shuttle'] },
    ];
    const selectedFlight = this.trip.flights.find((flight) => flight.selected) ?? this.trip.flights[0];
    const selectedHotel = this.trip.hotels.find((hotel) => hotel.selected) ?? this.trip.hotels[0];
    this.recalculateBudget((selectedFlight?.price ?? 0) * this.trip.request.travelers, selectedHotel?.totalPrice ?? 0);
  }

  private recalculateBudget(flight: number, hotel: number) {
    this.trip.budget.flight = flight;
    this.trip.budget.hotel = hotel;
    this.trip.budget.spent = flight + hotel + this.trip.budget.activities + this.trip.budget.food;
    this.trip.budget.remaining = this.trip.budget.total - this.trip.budget.spent;
  }
}
