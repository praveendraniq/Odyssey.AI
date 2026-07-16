import type { PaymentOrder, PreferenceCollection, ReplanType, Trip, TripRequest } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...init?.headers }, ...init });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Something went wrong');
  return body;
}

export const api = {
  getDemo: () => request<{ trip: Trip }>('/api/trips/demo'),
  extractPlan: (conversation: string) => request<{ request: TripRequest; source: string; confidence: number; summary: string; itinerarySource: 'google-places' | 'curated-fallback'; placesDiagnostic?: string; trip: Trip }>('/api/planner/extract', { method: 'POST', body: JSON.stringify({ conversation }) }),
  collectPreferences: (adminName: string, adminPhone: string, phones: Record<string, string>, trip: Trip) => request<{ collection: PreferenceCollection; trip: Trip }>('/api/planner/collect-preferences', { method: 'POST', body: JSON.stringify({ adminName, adminPhone, phones, trip }) }),
  approvePreferences: (interestScores: Trip['groupPreference']['interestScores'], trip: Trip) => request<{ trip: Trip }>('/api/planner/approve-preferences', { method: 'POST', body: JSON.stringify({ interestScores, trip }) }),
  selectFlight: (id: string, trip?: Trip) => request<{ trip: Trip }>('/api/bookings/flight', { method: 'POST', body: JSON.stringify({ id, trip }) }),
  selectHotel: (id: string, trip?: Trip) => request<{ trip: Trip }>('/api/bookings/hotel', { method: 'POST', body: JSON.stringify({ id, trip }) }),
  completeStop: (id: string, trip: Trip) => request<{ trip: Trip }>('/api/itinerary/complete', { method: 'POST', body: JSON.stringify({ id, trip }) }),
  replan: (type: ReplanType, trip: Trip) => request<{ trip: Trip; event: Trip['events'][number] }>('/api/operations/replan', { method: 'POST', body: JSON.stringify({ type, trip }) }),
  createOrder: (percentages?: Record<string, number>) => request<{ order: PaymentOrder }>('/api/payments/create-order', { method: 'POST', body: JSON.stringify({ percentages }) }),
  captureOrder: (id: string) => request<{ order: PaymentOrder }>(`/api/payments/${id}/capture`, { method: 'POST' }),
  scanReceipt: () => request<{ receipt: { restaurant: string; amount: number }; trip: Trip }>('/api/receipts/analyze', { method: 'POST', body: JSON.stringify({ restaurant: 'Sushi Dai', amount: 120 }) }),
};
