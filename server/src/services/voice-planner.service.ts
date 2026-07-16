import type { Interest, TripRequest } from '../types.js';

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
  async extractTrip(conversation: string): Promise<{ request: TripRequest; source: 'local-parser'; confidence: number }> {
    const value = conversation.toLowerCase();
    const request = structuredClone(defaultRequest);
    const destination = value.match(/(?:to|in|visit)\s+([a-z ]+?)(?:\s+(?:for|under|with|this|next)|[.,]|$)/i)?.[1]?.trim();
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
    return { request, source: 'local-parser', confidence: 0.94 };
  }
}
