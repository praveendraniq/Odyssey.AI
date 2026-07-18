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
      travelers: [{ passengerTypeCode: 'ADT' }],
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
      checkInDate: input.departureDate,
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

  private async beginConversation(): Promise<string> {
    if (!config.sabre.accessToken) throw new Error('Sabre access token is not configured on the server.');
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
    const response = await fetch(config.sabre.mcpUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.sabre.accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++this.requestId, method, params }),
    });
    const body = await response.json().catch(() => ({})) as JsonRpcResponse;
    if (!response.ok || body.error) throw new Error(body.error?.message ?? `Sabre MCP returned ${response.status}`);
    return body;
  }

  private contentText(value: unknown): string {
    const response = value as JsonRpcResponse & { content?: Array<{ text?: string }> };
    const content = response.result?.content ?? response.content;
    return content?.map((item) => item.text ?? '').join('\n') ?? '';
  }
}
