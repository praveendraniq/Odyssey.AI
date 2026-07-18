import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import type { PaymentOrder, Traveler, Trip } from '../types.js';

export const knownBookingTotal = (trip: Pick<Trip, 'budget'>): number => trip.budget.flight + trip.budget.hotel;

export class PayPalService {
  async createOrder(total: number, travelers: Traveler[], percentages?: Record<string, number>): Promise<PaymentOrder> {
    const split = travelers.map((traveler) => ({ travelerId: traveler.id, name: traveler.name, amount: Number((total * (percentages?.[traveler.id] ?? (100 / travelers.length)) / 100).toFixed(2)) }));
    // Make rounding whole without assigning a hidden charge to the user.
    split[0].amount = Number((total - split.slice(1).reduce((sum, item) => sum + item.amount, 0)).toFixed(2));
    if (config.mockMode || !config.paypal.clientId || !config.paypal.clientSecret) return { id: `MOCK-${randomUUID().slice(0, 8).toUpperCase()}`, status: 'CREATED', total, currency: 'USD', split, mock: true };

    const token = await this.accessToken();
    const url = `https://api-m.${config.paypal.environment === 'live' ? 'paypal.com' : 'sandbox.paypal.com'}/v2/checkout/orders`;
    const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': randomUUID() }, body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ amount: { currency_code: 'USD', value: total.toFixed(2) }, description: 'Odyssey.AI travel payment' }], application_context: { user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING', return_url: `${config.clientOrigin}/?paypal=approved`, cancel_url: `${config.clientOrigin}/?paypal=cancelled` } }) });
    if (!response.ok) throw new Error(`PayPal create order returned ${response.status}`);
    const body = await response.json() as { id: string; links?: Array<{ rel: string; href: string }> };
    return { id: body.id, status: 'CREATED', total, currency: 'USD', split, approveUrl: body.links?.find((link) => link.rel === 'approve')?.href, mock: false };
  }

  async captureOrder(order: PaymentOrder): Promise<PaymentOrder> {
    if (order.mock) return { ...order, status: 'COMPLETED' };
    const token = await this.accessToken();
    const url = `https://api-m.${config.paypal.environment === 'live' ? 'paypal.com' : 'sandbox.paypal.com'}/v2/checkout/orders/${order.id}/capture`;
    const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    if (!response.ok) throw new Error(`PayPal capture returned ${response.status}`);
    return { ...order, status: 'COMPLETED' };
  }

  private async accessToken(): Promise<string> {
    const response = await fetch(`https://api-m.${config.paypal.environment === 'live' ? 'paypal.com' : 'sandbox.paypal.com'}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${config.paypal.clientId}:${config.paypal.clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
    if (!response.ok) throw new Error(`PayPal authorization returned ${response.status}`);
    return (await response.json() as { access_token: string }).access_token;
  }
}
