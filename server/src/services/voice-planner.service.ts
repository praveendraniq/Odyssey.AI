import { config } from '../config.js';
import type { Interest, PreferenceCollection, Traveler, TripRequest } from '../types.js';

const defaultRequest: TripRequest = {
  destination: 'Japan', duration: 5, travelers: 4, budget: 6000,
  travelStyle: 'culture-forward, unhurried', foodPreferences: ['sushi', 'vegetarian friendly'],
  interests: ['culture', 'history', 'food', 'photography'],
};

const numberWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const toNumber = (value: string) => /^\d+$/.test(value) ? Number(value) : numberWords[value.toLowerCase()] ?? 0;

/**
 * Keeps the UI productive without an external model while matching the shape
 * of an eventual Vocal Bridge structured conversation response.
 */
export class VocalBridgeService {
  async extractTrip(conversation: string): Promise<{ request: TripRequest; source: 'mock' | 'vocal-bridge'; confidence: number }> {
    if (!config.mockMode && config.vocalBridge.baseUrl && config.vocalBridge.apiKey) {
      const response = await fetch(`${config.vocalBridge.baseUrl.replace(/\/$/, '')}/v1/conversations/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.vocalBridge.apiKey}` },
        body: JSON.stringify({ conversation, schema: 'journeyos.trip_request.v1' }),
      });
      if (!response.ok) throw new Error(`Vocal Bridge returned ${response.status}`);
      const body = await response.json() as { trip?: TripRequest; confidence?: number };
      if (body.trip) return { request: body.trip, source: 'vocal-bridge', confidence: body.confidence ?? 0.9 };
    }

    const value = conversation.toLowerCase();
    const request = structuredClone(defaultRequest);
    const destinationMatch = value.match(/(?:to|in|visit|visiting|as|destination is)\s+([a-z][a-z '-]+?)(?:\s+(?:for|under|with|from|during|and|this|next)\b|[.,]|$)/i)?.[1]?.trim();
    const knownDestination = ['china', 'japan', 'kyoto', 'tokyo', 'bali', 'thailand', 'bangkok', 'paris', 'france', 'italy', 'rome', 'spain', 'london', 'greece', 'mexico', 'india', 'singapore', 'australia', 'new zealand'].find((place) => new RegExp(`\\b${place}\\b`, 'i').test(value));
    const destination = destinationMatch ?? knownDestination;
    if (destination) request.destination = destination.replace(/\b\w/g, (letter) => letter.toUpperCase());
    const duration = value.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)[ -]?day/);
    if (duration) request.duration = toNumber(duration[1]);
    const people = value.match(/(?:for|with)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:people|travelers|friends|adults)/);
    if (people) request.travelers = toNumber(people[1]);
    const budget = value.match(/(?:under|budget(?:\s+of)?|\$)\s*\$?([\d,]+)(?:k|000)?/);
    if (budget) {
      const raw = Number(budget[1].replace(/,/g, ''));
      request.budget = value.includes(`${budget[1]}k`) ? raw * 1000 : raw;
    }
    const interests: Array<[Interest, RegExp]> = [
      ['culture', /culture|temple|shrine|traditional/], ['history', /history|historic|museum/], ['food', /food|sushi|restaurant|culinary/],
      ['photography', /photo|camera|photography/], ['shopping', /shop|fashion/], ['nightlife', /nightlife|bar|club/], ['nature', /nature|hike|outdoor/],
    ];
    const extracted = interests.filter(([, pattern]) => pattern.test(value)).map(([interest]) => interest);
    if (extracted.length) request.interests = extracted;
    if (/slow|relax|easy/.test(value)) request.travelStyle = 'slow, restorative';
    if (/fast|packed|adventure/.test(value)) request.travelStyle = 'high-energy exploration';
    if (/vegetarian|vegan/.test(value)) request.foodPreferences = ['vegetarian friendly', ...request.foodPreferences.filter((food) => food !== 'vegetarian friendly')];
    const confidence = Math.min(0.97, 0.58
      + (destination ? 0.1 : 0)
      + (duration ? 0.08 : 0)
      + (people ? 0.07 : 0)
      + (budget ? 0.07 : 0)
      + (extracted.length ? 0.05 : 0)
      + (/vegetarian|vegan|allergy|shellfish|gluten/.test(value) ? 0.03 : 0));
    return { request, source: 'mock', confidence: Number(confidence.toFixed(2)) };
  }

  async collectPreferences(input: { adminName: string; adminPhone: string; phones: Record<string, string>; travelers: Traveler[]; destination: string }): Promise<PreferenceCollection> {
    const participants = input.travelers.filter((traveler) => traveler.name !== input.adminName);
    if (!config.mockMode && config.vocalBridge.baseUrl && config.vocalBridge.apiKey && config.vocalBridge.agentId) {
      const response = await fetch(`${config.vocalBridge.baseUrl.replace(/\/$/, '')}/v1/calls/group-preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.vocalBridge.apiKey}` },
        body: JSON.stringify({
          agentId: config.vocalBridge.agentId,
          admin: { name: input.adminName, phone: input.adminPhone, priorityWeight: 1.5 },
          destination: input.destination,
          travelers: participants.map((traveler) => ({ id: traveler.id, name: traveler.name, phone: input.phones[traveler.id] })),
          prompt: 'Discuss the planned trip, ask for priorities and constraints, and suggest a fair compromise that preserves the admin’s priorities first.',
        }),
      });
      if (!response.ok) throw new Error(`Vocal Bridge returned ${response.status}`);
      const body = await response.json() as Partial<PreferenceCollection>;
      if (body.calls?.length) return { ...body, adminName: input.adminName, adminWeight: body.adminWeight ?? 1.5, source: 'vocal-bridge', negotiation: body.negotiation ?? 'Preferences collected for review.', approvalSummary: body.approvalSummary ?? 'Review the proposed group plan.' } as PreferenceCollection;
    }

    const calls = participants.map((traveler, index) => {
      const priorities = Object.entries(traveler.interests).sort(([, a], [, b]) => b - a).slice(0, 2).map(([interest]) => interest);
      const adminPriority = 'a protected culture-and-history morning';
      const travelerTrade = `${priorities[0]} time and a ${traveler.pacePreference} pace`;
      return {
        travelerId: traveler.id,
        name: traveler.name,
        phone: input.phones[traveler.id] || (index === 0 ? '+1 (415) 555-0148' : index === 1 ? '+1 (415) 555-0172' : '+1 (415) 555-0196'),
        status: 'completed' as const,
        summary: `${traveler.name} wants ${priorities.join(' and ')}, with a ${traveler.pacePreference} pace and ${traveler.foodPreference.toLowerCase()} options.`,
        happiness: [88, 84, 86][index] ?? 85,
        topPriorities: priorities,
        compromise: `Keeps a ${priorities[0]} highlight while reserving open time for ${input.adminName}'s culture-led itinerary.`,
        dialogue: [
          { speaker: 'agent' as const, text: `${traveler.name}, your ${priorities[0]} preference matters. ${input.adminName}'s non-negotiable is ${adminPriority}. Would you support that if I protect ${travelerTrade} later the same day?` },
          { speaker: 'traveler' as const, text: `Yes—if the ${priorities[0]} stop is genuinely protected and the schedule does not feel rushed.` },
          { speaker: 'agent' as const, text: `Agreed. I will lock that trade-off into the proposal and show it explicitly to the admin before the itinerary changes.` },
        ],
      };
    });
    return {
      adminName: input.adminName,
      adminWeight: 1.5,
      source: 'mock',
      calls,
      negotiation: `${input.adminName}'s culture and history priorities lead the plan. The group accepts a balanced pace, with food, photography, and nature moments placed near the core cultural route.`,
      approvalSummary: `A ${input.destination} plan is ready: it protects ${input.adminName}'s top priorities while keeping every traveler at 84% happiness or above.`,
    };
  }
}
