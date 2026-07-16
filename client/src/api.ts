import type { AgentRun, AgentSystem, PaymentOrder, ReplanType, Trip, TripRequest } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...init?.headers }, ...init });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Something went wrong');
  return body;
}

export const api = {
  getDemo: () => request<{ trip: Trip }>('/api/trips/demo'),
  getAgents: () => request<AgentSystem>('/api/agents'),
  queryAgents: (query: string) => request<{ response: string; trip: Trip; agentRun: AgentRun }>('/api/agents/query', { method: 'POST', body: JSON.stringify({ query }) }),
  extractPlan: (conversation: string) => request<{ request: TripRequest; source: string; confidence: number; summary: string; trip: Trip }>('/api/planner/extract', { method: 'POST', body: JSON.stringify({ conversation }) }),
  selectFlight: (id: string) => request<{ trip: Trip }>('/api/bookings/flight', { method: 'POST', body: JSON.stringify({ id }) }),
  selectHotel: (id: string) => request<{ trip: Trip }>('/api/bookings/hotel', { method: 'POST', body: JSON.stringify({ id }) }),
  replan: (type: ReplanType) => request<{ trip: Trip; event: Trip['events'][number] }>('/api/operations/replan', { method: 'POST', body: JSON.stringify({ type }) }),
  createOrder: () => request<{ order: PaymentOrder }>('/api/payments/create-order', { method: 'POST' }),
  captureOrder: (id: string) => request<{ order: PaymentOrder }>(`/api/payments/${id}/capture`, { method: 'POST' }),
  scanReceipt: () => request<{ receipt: { restaurant: string; amount: number }; trip: Trip }>('/api/receipts/analyze', { method: 'POST', body: JSON.stringify({ restaurant: 'Sushi Dai', amount: 120 }) }),
};
