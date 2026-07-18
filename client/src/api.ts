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
  selectFlight: (id: string, trip?: Trip) => request<{ trip: Trip }>('/api/bookings/flight', { method: 'POST', body: JSON.stringify({ id, trip }) }),
  selectHotel: (id: string, trip?: Trip) => request<{ trip: Trip }>('/api/bookings/hotel', { method: 'POST', body: JSON.stringify({ id, trip }) }),
  progressStop: (action: 'start' | 'complete' | 'skip' | 'delay', trip: Trip, options: { id?: string; actualDurationMins?: number; minutes?: number } = {}) => request<{ trip: Trip }>('/api/itinerary/progress', { method: 'POST', body: JSON.stringify({ action, ...options, trip }) }),
  replan: (type: ReplanType, trip: Trip, activeDay?: number) => request<{ trip: Trip; event: Trip['events'][number] }>('/api/operations/replan', { method: 'POST', body: JSON.stringify({ type, trip, activeDay }) }),
  createOrder: (percentages?: Record<string, number>) => request<{ order: PaymentOrder }>('/api/payments/create-order', { method: 'POST', body: JSON.stringify({ percentages }) }),
  captureOrder: (id: string) => request<{ order: PaymentOrder }>(`/api/payments/${id}/capture`, { method: 'POST' }),
  scanReceipt: (trip: Trip, input: { restaurant?: string; amount?: number; category?: 'food' | 'transport' | 'activity' | 'other'; paidBy?: string; participantIds?: string[] } = {}) => request<{ receipt: { restaurant: string; amount: number }; trip: Trip }>('/api/receipts/analyze', { method: 'POST', body: JSON.stringify({ restaurant: 'Sushi Dai', amount: 120, ...input, trip }) }),
  deleteReceipt: (receiptId: string, trip: Trip) => request<{ trip: Trip }>(`/api/receipts/${receiptId}`, { method: 'DELETE', body: JSON.stringify({ trip }) }),
};
