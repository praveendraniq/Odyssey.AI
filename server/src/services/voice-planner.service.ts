import { config } from '../config.js';
import type { Interest, PreferenceCollection, Traveler, TripRequest } from '../types.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const defaultRequest: TripRequest = {
  origin: 'San Francisco', destination: 'Japan', departureDate: '2026-10-12', returnDate: '2026-10-16', duration: 5, travelers: 4, budget: 6000,
  travelStyle: 'culture-forward, unhurried', foodPreferences: ['sushi', 'vegetarian friendly'],
  interests: ['culture', 'history', 'food', 'photography'],
};

const numberWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const toNumber = (value: string) => /^\d+$/.test(value) ? Number(value) : numberWords[value.toLowerCase()] ?? 0;
const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const dayCount = (departureDate: string, returnDate: string, fallback: number) => {
  const departure = new Date(`${departureDate}T12:00:00Z`);
  const returning = new Date(`${returnDate}T12:00:00Z`);
  const fromDates = Math.round((returning.getTime() - departure.getTime()) / 86_400_000) + 1;
  const value = Number.isFinite(fromDates) && fromDates > 0 ? fromDates : fallback;
  // A voice typo must never create an unusable, dozens-of-days demo timeline.
  return Math.min(14, Math.max(1, Math.round(value) || 1));
};

const readDate = (value: string): string | undefined => {
  const iso = value.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
  if (iso) return iso;
  const written = value.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d{2}))?/i);
  if (!written) return undefined;
  const parsed = new Date(`${written[1]} ${written[2]}, ${written[3] ?? '2026'} 12:00:00 UTC`);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : undefined;
};

/**
 * Keeps the UI productive without an external model while matching the shape
 * of an eventual Vocal Bridge structured conversation response.
 */
export class VocalBridgeService {
  async callMayaAgent(): Promise<void> {
    if (!config.vocalBridge.mayaPhone) throw new Error('Maya’s Vocal Bridge phone number is not configured.');
    try {
      // The currently selected `vb` CLI agent is the JourneyOS main agent. It
      // places the outbound call to Maya’s separate Vocal Bridge phone agent.
      await run('vb', ['call', config.vocalBridge.mayaPhone, '--name', 'Maya · simulated traveler', '--json'], { timeout: 30_000 });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown outbound call error';
      if (/ENOENT/.test(detail)) throw new Error('Vocal Bridge CLI is not installed. Run: pipx install vocal-bridge, then authenticate and select the main JourneyOS agent.');
      throw new Error(`Could not place Maya’s preference call: ${detail}`);
    }
  }

  async extractTrip(conversation: string): Promise<{ request: TripRequest; source: 'mock' | 'vocal-bridge'; confidence: number }> {
    // Vocal Bridge supplies the live voice session and transcript through WebRTC.
    // Its public API does not expose a conversation-extraction endpoint, so JourneyOS
    // structures that transcript locally instead of making a failing remote request.
    const value = conversation.toLowerCase();
    const request = structuredClone(defaultRequest);
    const destinationMatch = value.match(/(?:trip|travel(?:ing)?|going|fly(?:ing)?|heading)\s+to\s+([a-z][a-z '-]+?)(?:\s+(?:for|under|with|from|during|and|this|next|on|leaving|departing)\b|[.,]|$)|(?:visit(?:ing)?|destination is)\s+([a-z][a-z '-]+?)(?:\s+(?:for|under|with|from|during|and|this|next|on)\b|[.,]|$)/i)?.slice(1).find(Boolean)?.trim();
    const knownDestination = ['china', 'japan', 'kyoto', 'tokyo', 'bali', 'thailand', 'bangkok', 'paris', 'france', 'italy', 'rome', 'spain', 'london', 'greece', 'mexico', 'india', 'singapore', 'australia', 'new zealand'].find((place) => new RegExp(`\\b${place}\\b`, 'i').test(value));
    // Prefer a recognized destination over a broad phrase such as "things to do in Tokyo".
    const destinationLooksLikePreference = !destinationMatch || destinationMatch.length > 40 || /\b(see|place|young|people|traveler|vegetarian|budget|prefer|want|like|pace|food|activity|possible)\b/i.test(destinationMatch);
    const destination = knownDestination ?? (destinationLooksLikePreference ? undefined : destinationMatch);
    if (destination) request.destination = destination.replace(/\b\w/g, (letter) => letter.toUpperCase());
    const originMatch = value.match(/(?:from|leaving|departing from)\s+([a-z][a-z '-]+?)(?=\s+(?:to|on|for|departing|leaving)\b|[,.]|$)/i)?.[1]?.trim();
    if (originMatch) request.origin = originMatch.replace(/\b\w/g, (letter) => letter.toUpperCase());
    const departing = value.match(/(?:depart(?:ing|ure)?|leave|leaving|start(?:ing)?)\s*(?:on)?\s*([^,.]+?)(?=\s+(?:and\s+)?(?:return|coming back|back on|until)\b|[,.]|$)/i)?.[1];
    const returning = value.match(/(?:return|coming back|back)\s*(?:on)?\s*([^,.]+?)(?=[,.]|$)/i)?.[1];
    const dateMatches = [...value.matchAll(/\b(?:20\d{2}-\d{2}-\d{2}|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*20\d{2})?)\b/gi)]
      .map((match) => readDate(match[0]))
      .filter((date): date is string => Boolean(date));
    const departureDate = departing ? readDate(departing) : dateMatches[0] ?? readDate(value);
    const returnDate = returning ? readDate(returning) : dateMatches[1];
    if (departureDate) request.departureDate = departureDate;
    if (returnDate) request.returnDate = returnDate;
    const duration = value.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)[ -]?day/);
    if (duration) request.duration = toNumber(duration[1]);
    if (request.departureDate && !request.returnDate) request.returnDate = addDays(request.departureDate, Math.max(1, request.duration - 1));
    if (request.departureDate && request.returnDate) {
      request.duration = dayCount(request.departureDate, request.returnDate, request.duration);
      request.returnDate = addDays(request.departureDate, request.duration - 1);
    }
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
    // The first traveler is always the trip admin. Names are editable and are
    // not a reliable way to decide who should receive a preference call.
    const participants = input.travelers.slice(1);
    if (!participants.length) throw new Error('Add at least one friend before starting preference calls.');
    if (!config.mockMode && config.vocalBridge.apiKey && config.vocalBridge.agentId) {
      const calls: PreferenceCollection['calls'] = [];
      // Start one outbound interview only after the previous call request has
      // returned. This prevents every friend being dialed at once and keeps
      // the preference collector in a clear, admin-controlled sequence.
      for (const traveler of participants) {
        const phone = input.phones[traveler.id]?.trim();
        if (!phone) throw new Error(`${traveler.name} needs a phone number before a call can be placed.`);
        try {
          // `vb call` is Vocal Bridge's supported outbound-call interface. The
          // selected agent and outbound calling must be configured in its CLI/dashboard.
          await run('vb', ['call', phone, '--name', traveler.name, '--json'], { timeout: 30_000 });
          calls.push({ travelerId: traveler.id, name: traveler.name, phone, status: 'queued', summary: 'Outbound preference call queued. JourneyOS will use the completed call transcript for the group proposal.', happiness: 0, topPriorities: [], compromise: 'Waiting for the traveler’s call.' });
        } catch (error) {
          const detail = error instanceof Error ? error.message : 'Unknown outbound call error';
          if (/ENOENT/.test(detail)) throw new Error('Vocal Bridge CLI is not installed on this computer. Install it with: pip install vocal-bridge, then run vb auth login and vb agent use.');
          throw new Error(`Could not start ${traveler.name}'s Vocal Bridge call: ${detail}`);
        }
      }
      return {
        adminName: input.adminName,
        adminWeight: 1.5,
        source: 'vocal-bridge',
        calls,
        negotiation: `Outbound preference calls are in progress for ${participants.map((traveler) => traveler.name).join(', ')}. JourneyOS will create the negotiated proposal after the call summaries are available.`,
        approvalSummary: `Waiting for ${calls.length} traveler preference call${calls.length === 1 ? '' : 's'} to complete.`,
      };
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
