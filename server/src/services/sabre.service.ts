import { config } from '../config.js';
import type { Flight, Hotel } from '../types.js';

export class SabreService {
  private cachedToken?: { value: string; expiresAt: number };
  private tokenRequest?: Promise<string>;
  private mcpConversation?: string;
  private mcpSetup?: Promise<string>;
  private mcpRequestId = 0;

  constructor(private readonly fixtures: { flights: Flight[]; hotels: Hotel[] }) {}

  async searchFlights(params: { origin?: string; destination?: string; departureDate?: string }): Promise<Flight[]> {
    if (config.mockMode || (!config.sabre.accessToken && (!config.sabre.eprUsername || !config.sabre.eprPassword))) return this.fixtures.flights;
    const body = await this.callMcpBusinessTool('search-flights', {
      journeys: [{
        departureLocation: { airportCode: (params.origin ?? 'SFO').toUpperCase() },
        arrivalLocation: { airportCode: (params.destination ?? 'TYO').toUpperCase() },
        departureDate: params.departureDate ?? '2026-10-12',
      }],
      travelers: [{ passengerTypeCode: 'ADT' }],
      sources: { distributionModels: ['ATPCO'] },
      processingOptions: { limitNumberOfOffers: 5, pseudoCityCode: config.sabre.pcc },
    }, [
      'skill://search-flights/SKILL.md',
      'skill://search-flights/assets/01-search-one-way-flight.yaml',
    ]);
    const offers = this.asRecords(body.offers ?? body.data);
    const flights = new Map(this.asRecords(body.flights).map((flight) => [String(flight.id), flight]));
    const journeys = new Map(this.asRecords(body.journeys).map((journey) => [String(journey.id), journey]));
    return offers.map((offer, index) => this.normalizeFlight(offer, index, flights, journeys));
  }

  async searchHotels(params: { cityCode?: string; checkInDate?: string; checkOutDate?: string }): Promise<Hotel[]> {
    if (config.mockMode || (!config.sabre.accessToken && (!config.sabre.eprUsername || !config.sabre.eprPassword))) return this.fixtures.hotels;
    const body = await this.callMcpBusinessTool('search-hotels', {
      radiusInMiles: 10,
      maxResults: 6,
      checkInDate: params.checkInDate ?? '2026-10-12',
      checkOutDate: params.checkOutDate ?? '2026-10-15',
      numberOfAdults: 2,
      referencePoint: { type: 'Airport', value: (params.cityCode ?? 'TYO').toUpperCase() },
      pos: { source: { pseudoCityCode: config.sabre.pcc } },
    }, [
      'skill://search-hotels/SKILL.md',
      'skill://search-hotels/assets/03-search-hotels-by-reference-point.yaml',
    ]);
    return this.asRecords(body.hotels).map((hotel, index) => this.normalizeHotel(hotel, index));
  }

  private async callMcpBusinessTool(name: string, args: Record<string, unknown>, skillUris: string[]): Promise<Record<string, unknown>> {
    const conversationId = await this.mcpConversationId();
    await this.mcpCall('read-resources', { uris: skillUris, conversationId });
    return this.parseMcpPayload(await this.mcpCall(name, { ...args, conversationId }));
  }

  private async mcpConversationId(): Promise<string> {
    if (this.mcpConversation) return this.mcpConversation;
    if (!this.mcpSetup) {
      this.mcpSetup = this.mcpCall('use-sabre-mcp-server-guidelines', {}).then((guidelines) => {
        const match = guidelines.match(/conversationId[^`]*`([^`]+)`/i);
        if (!match) throw new Error('Sabre MCP did not return a conversation ID');
        this.mcpConversation = match[1];
        return match[1];
      }).finally(() => {
        this.mcpSetup = undefined;
      });
    }
    return this.mcpSetup;
  }

  private async mcpCall(name: string, args: Record<string, unknown>): Promise<string> {
    const token = await this.token();
    const response = await fetch(config.sabre.mcpUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++this.mcpRequestId, method: 'tools/call', params: { name, arguments: args } }),
    });
    const payload = await response.json().catch(() => ({})) as {
      error?: { message?: string };
      result?: { content?: Array<{ type?: string; text?: string }>; isError?: boolean };
    };
    const text = payload.result?.content?.filter((item) => item.type === 'text').map((item) => item.text ?? '').join('\n') ?? '';
    if (!response.ok || payload.error || payload.result?.isError) {
      throw new Error(`Sabre MCP ${name} failed${payload.error?.message ? `: ${payload.error.message}` : text ? `: ${text.slice(0, 240)}` : ` (${response.status})`}`);
    }
    return text;
  }

  private parseMcpPayload(text: string): Record<string, unknown> {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error('Sabre MCP returned an unreadable result');
    }
  }

  private asRecords(value: unknown): Array<Record<string, unknown>> {
    return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null) : [];
  }

  private async token(): Promise<string> {
    // A manually generated CERT token is useful for MCP testing. It remains
    // server-side and takes precedence over a locally generated OAuth token.
    if (config.sabre.accessToken) return config.sabre.accessToken;
    // Sabre OAuth returns a short-lived bearer token. Reuse it until
    // one minute before expiry, then regenerate it server-side.
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) return this.cachedToken.value;
    if (this.tokenRequest) return this.tokenRequest;

    this.tokenRequest = this.createToken().finally(() => {
      this.tokenRequest = undefined;
    });
    return this.tokenRequest;
  }

  private async createToken(): Promise<string> {
    // Sabre OAuth v2: Base64(Base64(EPR username) + ":" + Base64(EPR password)).
    const username = Buffer.from(String(config.sabre.eprUsername), 'utf8').toString('base64');
    const password = Buffer.from(String(config.sabre.eprPassword), 'utf8').toString('base64');
    const basicAuth = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
    const response = await fetch(`${config.sabre.baseUrl}/${config.sabre.oauthVersion}/auth/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    const body = await response.json().catch(() => ({})) as {
      access_token?: string;
      expires_in?: number | string;
      error?: string;
      error_description?: string;
    };
    if (!response.ok) {
      const detail = [body.error, body.error_description]
        .filter((value): value is string => typeof value === 'string')
        .join(': ')
        .slice(0, 240);
      throw new Error(`Sabre authorization returned ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    if (!body.access_token) throw new Error('Sabre authorization response did not include an access token');
    const expiresInSeconds = Number(body.expires_in ?? 300);
    const refreshAfterSeconds = Math.max(5, expiresInSeconds - 60);
    this.cachedToken = { value: body.access_token, expiresAt: Date.now() + refreshAfterSeconds * 1_000 };
    return body.access_token;
  }

  private normalizeFlight(
    offer: Record<string, unknown>,
    index: number,
    flights: Map<string, Record<string, unknown>> = new Map(),
    journeys: Map<string, Record<string, unknown>> = new Map(),
  ): Flight {
    const journeyRef = (offer.journeyRefs as string[] | undefined)?.[0];
    const journey = journeys.get(String(journeyRef));
    const segments = ((journey?.flightRefs as string[] | undefined) ?? []).map((id) => flights.get(id)).filter((flight): flight is Record<string, unknown> => Boolean(flight));
    if (segments.length) {
      const first = segments[0];
      const last = segments.at(-1) ?? first;
      const duration = segments.reduce((total, segment) => total + Number(segment.durationInMinutes ?? 0), 0);
      const price = Number((offer.totalPrice as { amount?: string | number } | undefined)?.amount ?? 0);
      return {
        id: String(offer.id ?? `sabre-flight-${index}`),
        airline: String(first.marketingAirlineCode ?? first.operatingAirlineCode ?? 'Sabre partner'),
        code: `${first.marketingAirlineCode ?? first.operatingAirlineCode ?? ''} ${first.marketingFlightNumber ?? first.operatingFlightNumber ?? ''}`.trim(),
        departure: String(first.departureAirportCode ?? ''),
        arrival: String(last.arrivalAirportCode ?? ''),
        departureTime: `${first.departureDate ?? ''}T${first.departureTime ?? ''}`,
        arrivalTime: `${last.arrivalDate ?? ''}T${last.arrivalTime ?? ''}`,
        price,
        duration: duration ? `${Math.floor(duration / 60)}h ${duration % 60}m` : '',
        stops: Math.max(0, segments.length - 1),
      };
    }
    const itinerary = ((offer.itineraries as Array<{ segments?: Array<Record<string, unknown>>; duration?: string }> | undefined) ?? [])[0];
    const fallbackSegments = itinerary?.segments ?? [];
    const first = fallbackSegments[0] ?? {};
    const last = fallbackSegments.at(-1) ?? {};
    const price = Number((offer.price as { total?: string } | undefined)?.total ?? 0);
    return { id: `sabre-flight-${index}`, airline: String((first.carrierCode ?? 'Sabre partner')), code: `${first.carrierCode ?? ''} ${first.number ?? ''}`.trim(), departure: String((first.departure as { iataCode?: string } | undefined)?.iataCode ?? ''), arrival: String((last.arrival as { iataCode?: string } | undefined)?.iataCode ?? ''), departureTime: String((first.departure as { at?: string } | undefined)?.at ?? ''), arrivalTime: String((last.arrival as { at?: string } | undefined)?.at ?? ''), price, duration: String(itinerary?.duration ?? ''), stops: Math.max(0, fallbackSegments.length - 1) };
  }

  private normalizeHotel(hotel: Record<string, unknown>, index: number): Hotel {
    const property = (hotel.hotel as Record<string, unknown> | undefined) ?? hotel;
    const rate = (hotel.rateDetails as Record<string, unknown> | undefined) ?? {};
    const address = (property.address as Record<string, unknown> | undefined) ?? {};
    const price = Number(rate.averageNightlyRate ?? 0);
    const totalPrice = Number(rate.approxTotalPrice ?? price);
    return {
      id: `sabre-hotel-${index}`,
      name: String(property.hotelName ?? 'Sabre hotel'),
      location: [address.cityName, address.countryName].filter(Boolean).join(', ') || 'Unknown location',
      rating: Number(property.sabreRating ?? 0),
      price,
      totalPrice,
      image: String(hotel.imageUrl ?? property.logo ?? 'Hotel'),
      amenities: Array.isArray(property.amenities) ? property.amenities.map(String).slice(0, 6) : [],
    };
  }
}
