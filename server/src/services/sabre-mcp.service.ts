import { config } from '../config.js';

type JsonRpcResponse = { result?: { content?: Array<{ text?: string }>; isError?: boolean }; error?: { message?: string } };

export type SabreLiveSearch = { flights: unknown; hotels: unknown };

/**
 * Server-side adapter for Sabre's CERT skills MCP server.  It intentionally
 * returns the original shopping response: opaque offer/rate keys must remain
 * intact for the later revalidation and booking calls.
 */
export class SabreMcpService {
  private requestId = 0;

  constructor(private readonly tokenProvider?: () => Promise<string>) {}

  async searchTrip(input: { origin: string; destination: string; departureDate: string; returnDate: string; adults: number }): Promise<SabreLiveSearch> {
    const conversationId = await this.beginConversation();
    await this.loadSkill('search-flights', [
      'skill://search-flights/SKILL.md',
      'skill://search-flights/assets/02-search-round-trip-flight.yaml',
    ], conversationId);
    const flights = await this.tool('search-flights', {
      journeys: [
        { departureLocation: { cityCode: input.origin }, arrivalLocation: { cityCode: input.destination }, departureDate: input.departureDate },
        { departureLocation: { cityCode: input.destination }, arrivalLocation: { cityCode: input.origin }, departureDate: input.returnDate },
      ],
      travelers: Array.from({ length: input.adults }, () => ({ passengerTypeCode: 'ADT' })),
      sources: { distributionModels: ['ATPCO'] },
      processingOptions: { pseudoCityCode: config.sabre.pcc, limitNumberOfOffers: 5 },
      conversationId,
    });

    await this.loadSkill('search-hotels', [
      'skill://search-hotels/SKILL.md',
      'skill://search-hotels/assets/03-search-hotels-by-reference-point.yaml',
    ], conversationId);
    const hotels = await this.tool('search-hotels', {
      referencePoint: { type: 'Airport', value: input.destination },
      radiusInMiles: 15,
      checkInDate: this.addDays(input.departureDate, 1),
      checkOutDate: input.returnDate,
      numberOfAdults: input.adults,
      maxResults: 5,
      pos: { source: { pseudoCityCode: config.sabre.pcc } },
      conversationId,
    });
    return { flights, hotels };
  }

  /**
   * This only runs after the UI's explicit confirmation. The caller supplies
   * a payload assembled from a fresh selected offer/rate and real traveler data.
   */
  async createBooking(payload: Record<string, unknown>): Promise<unknown> {
    const conversationId = await this.beginConversation();
    await this.loadSkill('create-booking', [
      'skill://create-booking/SKILL.md',
      'skill://create-booking/assets/01-create-flight-booking.yaml',
      'skill://create-booking/assets/02-create-hotel-booking.yaml',
    ], conversationId);
    return this.tool('create-booking', { ...payload, targetPcc: config.sabre.pcc, conversationId });
  }

  /**
   * The Skills MCP server returns opaque offer/rate data. Its search response
   * is the authoritative CERT freshness check, so this deliberately runs a
   * new search rather than attempting to reconstruct an offer from display
   * fields in the browser.
   */
  async revalidateTrip(input: { origin: string; destination: string; departureDate: string; returnDate: string; adults: number }): Promise<SabreLiveSearch> {
    return this.searchTrip(input);
  }

  private async beginConversation(): Promise<string> {
    await this.call('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'journeyos', version: '0.1.0' } });
    const guide = await this.tool('use-sabre-mcp-server-guidelines', {});
    const text = this.contentText(guide);
    const match = text.match(/`(wf_[^`]+)`/);
    if (!match?.[1]) throw new Error('Sabre MCP did not return a conversation ID.');
    return match[1];
  }

  private async loadSkill(_name: string, uris: string[], conversationId: string) {
    await this.tool('read-resources', { uris, conversationId });
  }

  private async tool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const response = await this.call('tools/call', { name, arguments: args });
    if (response.result?.isError) throw new Error(this.contentText(response) || `Sabre ${name} failed.`);
    return response.result ?? response;
  }

  private async call(method: string, params: Record<string, unknown>): Promise<JsonRpcResponse> {
    const token = config.sabre.accessToken ?? await this.tokenProvider?.();
    if (!token) throw new Error('Sabre CERT credentials are not configured on the server.');
    const response = await fetch(config.sabre.mcpUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++this.requestId, method, params }),
    });
    const body = await response.json().catch(() => ({})) as JsonRpcResponse;
    if (!response.ok || body.error) {
      if (response.status === 401) {
        throw new Error('Sabre MCP authentication failed (401). Refresh SABRE_ACCESS_TOKEN with a current OAuth 2.0 CERT token and restart the server. The MCP URL and PCC can remain unchanged.');
      }
      throw new Error(body.error?.message ?? `Sabre MCP returned ${response.status}`);
    }
    return body;
  }

  private contentText(value: unknown): string {
    const response = value as JsonRpcResponse & { content?: Array<{ text?: string }> };
    const content = response.result?.content ?? response.content;
    return content?.map((item) => item.text ?? '').join('\n') ?? '';
  }

  private addDays(value: string, days: number): string {
    const date = new Date(`${value}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
}
