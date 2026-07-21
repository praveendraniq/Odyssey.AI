import type { PaymentOrder, PreferenceCollection, ReplanType, Trip, TripRequest, WeatherObservation } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...init?.headers }, ...init });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Something went wrong');
  return body;
}

export const api = {
  getDemo: () => request<{ trip: Trip }>('/api/trips/demo'),
  getWeather: (destination: string) => request<{ weather: WeatherObservation }>(`/api/weather?destination=${encodeURIComponent(destination)}`),
  hydrateTrip: (trip: Trip) => request<{ trip: Trip }>('/api/trips/hydrate', { method: 'POST', body: JSON.stringify({ trip }) }),
  resetTrip: () => request<{ trip: Trip }>('/api/trips/reset', { method: 'POST' }),
  updateTripDetails: (input: { origin: string; destination: string; departureDate: string; returnDate: string }, trip: Trip) => request<{ trip: Trip }>('/api/trips/details', { method: 'POST', body: JSON.stringify({ ...input, trip }) }),
  mutateTraveler: (input: { action: 'add' | 'update' | 'remove'; id?: string; name?: string; phone?: string; budgetPreference?: string; activityLevel?: number; pacePreference?: string; foodPreference?: string; interests?: Trip['travelers'][number]['interests'] }, trip: Trip) => request<{ trip: Trip }>('/api/travelers', { method: 'POST', body: JSON.stringify({ ...input, trip }) }),
  extractPlan: (conversation: string) => request<{ request: TripRequest; source: string; confidence: number; summary: string; itinerarySource: 'google-places' | 'curated-fallback'; placesDiagnostic?: string; trip: Trip }>('/api/planner/extract', { method: 'POST', body: JSON.stringify({ conversation }) }),
  collectPreferences: (adminName: string, adminPhone: string, phones: Record<string, string>, trip: Trip) => request<{ collection: PreferenceCollection; trip: Trip }>('/api/planner/collect-preferences', { method: 'POST', body: JSON.stringify({ adminName, adminPhone, phones, trip }) }),
  approvePreferences: (interestScores: Trip['groupPreference']['interestScores'], trip: Trip) => request<{ trip: Trip }>('/api/planner/approve-preferences', { method: 'POST', body: JSON.stringify({ interestScores, trip }) }),
  simulateSarahInterview: (trip: Trip) => request<{ trip: Trip; summary: string }>('/api/planner/simulate-sarah-interview', { method: 'POST', body: JSON.stringify({ trip }) }),
  callSarah: (trip: Trip) => request<{ trip: Trip }>('/api/planner/call-sarah', { method: 'POST', body: JSON.stringify({ trip }) }),
  startNegotiation: (travelerId: string, trip: Trip) => request<{ trip: Trip; mode: 'live' | 'scripted' }>('/api/planner/negotiation/start', { method: 'POST', body: JSON.stringify({ travelerId, trip }) }),
  simulateNegotiation: (trip: Trip) => request<{ trip: Trip }>('/api/planner/negotiation/simulate', { method: 'POST', body: JSON.stringify({ trip }) }),
  applyNegotiation: (trip: Trip) => request<{ trip: Trip }>('/api/planner/negotiation/apply', { method: 'POST', body: JSON.stringify({ trip }) }),
  // Partner voice UI uses Maya as its demonstration traveler. Keep both
  // names wired to the same server workflow during the transition.
  simulateMayaInterview: (trip: Trip) => request<{ trip: Trip; summary: string }>('/api/planner/simulate-sarah-interview', { method: 'POST', body: JSON.stringify({ trip }) }),
  callMaya: (trip: Trip) => request<{ trip: Trip }>('/api/planner/call-sarah', { method: 'POST', body: JSON.stringify({ trip }) }),
  selectFlight: (id: string, trip?: Trip) => request<{ trip: Trip }>('/api/bookings/flight', { method: 'POST', body: JSON.stringify({ id, trip }) }),
  selectHotel: (id: string, trip?: Trip) => request<{ trip: Trip }>('/api/bookings/hotel', { method: 'POST', body: JSON.stringify({ id, trip }) }),
  searchSabreLive: (input: { origin: string; destination: string; departureDate: string; returnDate: string; adults: number }) => request<{ source: 'sabre-cert-mcp'; results: { flights: unknown; hotels: unknown } }>('/api/sabre/live-search', { method: 'POST', body: JSON.stringify(input) }),
  revalidateSabreBooking: (input: { origin: string; destination: string; departureDate: string; returnDate: string; adults: number; flightOffer: Record<string, unknown>; hotelRate: Record<string, unknown>; display: { flight: { title: string; detail: string }; hotel: { title: string; detail: string } } }) => request<{ source: 'sabre-cert-mcp'; revalidationId: string; expiresAt: string; message: string }>('/api/sabre/revalidate', { method: 'POST', body: JSON.stringify(input) }),
  createSabreCertBooking: (input: { revalidationId: string; traveler: { firstName: string; lastName: string; email: string; phone: string }; display: { flight: { title: string; detail: string }; hotel: { title: string; detail: string } } }) => request<{ source: 'sabre-cert-mcp'; status: 'confirmed' | 'pending'; message: string; booking?: { bookingId: string; reference: string; createdAt: string } }>('/api/sabre/create-booking', { method: 'POST', body: JSON.stringify({ ...input, confirmed: true }) }),
  progressStop: (action: 'start' | 'complete' | 'skip' | 'restore' | 'delay', trip: Trip, options: { id?: string; actualDurationMins?: number; minutes?: number } = {}) => request<{ trip: Trip }>('/api/itinerary/progress', { method: 'POST', body: JSON.stringify({ action, ...options, trip }) }),
  itineraryCommand: (query: string, activeDay: number, trip: Trip) => request<{ trip: Trip; message: string; affectedStopIds: string[] }>('/api/itinerary/command', { method: 'POST', body: JSON.stringify({ query, activeDay, trip }) }),
  replan: (type: ReplanType, trip: Trip, activeDay?: number) => request<{ trip: Trip; event: Trip['events'][number] }>('/api/operations/replan', { method: 'POST', body: JSON.stringify({ type, trip, activeDay }) }),
  createOrder: (percentages?: Record<string, number>, total?: number) => request<{ order: PaymentOrder }>('/api/payments/create-order', { method: 'POST', body: JSON.stringify({ percentages, total }) }),
  captureOrder: (id: string) => request<{ order: PaymentOrder }>(`/api/payments/${id}/capture`, { method: 'POST' }),
  scanReceipt: (trip: Trip, input: { restaurant?: string; amount?: number; category?: 'food' | 'transport' | 'activity' | 'other'; paidBy?: string; participantIds?: string[]; splitPercentages?: Record<string, number> } = {}) => request<{ receipt: { restaurant: string; amount: number }; trip: Trip }>('/api/receipts/analyze', { method: 'POST', body: JSON.stringify({ restaurant: 'Sushi Dai', amount: 120, ...input, trip }) }),
  deleteReceipt: (receiptId: string, trip: Trip) => request<{ trip: Trip }>(`/api/receipts/${receiptId}`, { method: 'DELETE', body: JSON.stringify({ trip }) }),
};
