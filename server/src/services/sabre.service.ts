import { config } from '../config.js';
import type { Flight, Hotel } from '../types.js';

export class SabreService {
  private cachedToken?: { value: string; expiresAt: number };

  constructor(private readonly fixtures: { flights: Flight[]; hotels: Hotel[] }) {}

  async searchFlights(params: { origin?: string; destination?: string; departureDate?: string }): Promise<Flight[]> {
    if (!this.hasCredentials()) return this.fixtures.flights;
    const token = await this.accessToken();
    const search = new URLSearchParams({ originLocationCode: params.origin ?? 'SFO', destinationLocationCode: params.destination ?? 'TYO', departureDate: params.departureDate ?? '2026-10-12', adults: '4', currencyCode: 'USD', max: '6' });
    const response = await fetch(`${config.sabre.baseUrl}/v2/shop/flights?${search}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Sabre flight search returned ${response.status}`);
    const body = await response.json() as { data?: Array<Record<string, unknown>> };
    return (body.data ?? []).map((offer, index) => this.normalizeFlight(offer, index));
  }

  async searchHotels(params: { cityCode?: string; checkInDate?: string; checkOutDate?: string }): Promise<Hotel[]> {
    if (!this.hasCredentials()) return this.fixtures.hotels;
    // Sabre hotel endpoints vary by contracted API package. Keep this call isolated
    // and normalize the shared output before UI consumption.
    const token = await this.accessToken();
    const query = new URLSearchParams({ cityCode: params.cityCode ?? 'TYO', checkInDate: params.checkInDate ?? '2026-10-12', checkOutDate: params.checkOutDate ?? '2026-10-15' });
    const response = await fetch(`${config.sabre.baseUrl}/v1.0.0/shop/hotels?${query}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Sabre hotel search returned ${response.status}`);
    const body = await response.json() as { Hotels?: Array<Record<string, unknown>> };
    return (body.Hotels ?? []).map((hotel, index) => this.normalizeHotel(hotel, index));
  }

  async accessToken(): Promise<string> {
    // Prefer a freshly minted CERT token when client credentials are present.
    // A pasted SABRE_ACCESS_TOKEN is commonly expired by the time the demo is
    // rehearsed; use it only when no OAuth credentials are configured.
    if (config.sabre.accessToken && !this.hasCredentials()) return config.sabre.accessToken;
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) return this.cachedToken.value;
    if (!this.hasCredentials()) throw new Error('Sabre CERT credentials are not configured on the server.');
    const authorization = config.sabre.authVersion === 'v2'
      ? this.v2Authorization()
      : `Basic ${Buffer.from(`${config.sabre.clientId}:${config.sabre.clientSecret}`).toString('base64')}`;
    const response = await fetch(`${config.sabre.baseUrl}/v2/auth/token`, {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    if (!response.ok) throw new Error(`Sabre authorization returned ${response.status}`);
    const body = await response.json() as { access_token: string; expires_in?: number };
    this.cachedToken = { value: body.access_token, expiresAt: Date.now() + Math.max(60, body.expires_in ?? 600) * 1000 };
    return body.access_token;
  }

  private hasCredentials(): boolean {
    if (config.mockMode) return false;
    return config.sabre.authVersion === 'v2'
      ? Boolean(config.sabre.v2UserId && config.sabre.v2Password)
      : Boolean(config.sabre.clientId && config.sabre.clientSecret);
  }

  private v2Authorization(): string {
    if (!config.sabre.v2UserId || !config.sabre.v2Password) throw new Error('Sabre v2 User ID and password are required');
    const parts = config.sabre.v2UserId.split(':');
    const identity = parts.length === 4
      ? `${parts[0]}:${parts[1]}:${config.sabre.v2Pcc}:${config.sabre.v2Domain}`
      : `V1:${config.sabre.v2UserId}:${config.sabre.v2Pcc}:${config.sabre.v2Domain}`;
    const encodedIdentity = Buffer.from(identity).toString('base64');
    const encodedPassword = Buffer.from(config.sabre.v2Password).toString('base64');
    return `Basic ${Buffer.from(`${encodedIdentity}:${encodedPassword}`).toString('base64')}`;
  }

  private normalizeFlight(offer: Record<string, unknown>, index: number): Flight {
    const itinerary = ((offer.itineraries as Array<{ segments?: Array<Record<string, unknown>>; duration?: string }> | undefined) ?? [])[0];
    const segments = itinerary?.segments ?? [];
    const first = segments[0] ?? {};
    const last = segments.at(-1) ?? {};
    const price = Number((offer.price as { total?: string } | undefined)?.total ?? 0);
    return { id: `sabre-flight-${index}`, airline: String((first.carrierCode ?? 'Sabre partner')), code: `${first.carrierCode ?? ''} ${first.number ?? ''}`.trim(), departure: String((first.departure as { iataCode?: string } | undefined)?.iataCode ?? ''), arrival: String((last.arrival as { iataCode?: string } | undefined)?.iataCode ?? ''), departureTime: String((first.departure as { at?: string } | undefined)?.at ?? ''), arrivalTime: String((last.arrival as { at?: string } | undefined)?.at ?? ''), price, duration: String(itinerary?.duration ?? ''), stops: Math.max(0, segments.length - 1) };
  }

  private normalizeHotel(hotel: Record<string, unknown>, index: number): Hotel {
    const price = Number((hotel as { Price?: { Total?: number } }).Price?.Total ?? 0);
    return { id: `sabre-hotel-${index}`, name: String(hotel.HotelName ?? 'Sabre hotel'), location: String(hotel.Address ?? 'Japan'), rating: Number(hotel.Rating ?? 0), price, totalPrice: price, image: 'Hotel', amenities: [] };
  }
}
