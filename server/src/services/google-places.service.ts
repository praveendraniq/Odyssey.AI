import { config } from '../config.js';
import type { Interest, ItemCategory } from '../types.js';

export interface PlaceAttraction {
  id: string;
  name: string;
  address: string;
  category: ItemCategory;
}

const searchForInterest: Partial<Record<Interest, { query: string; category: ItemCategory }>> = {
  culture: { query: 'important museums art galleries and cultural landmarks', category: 'culture' },
  history: { query: 'historic landmarks heritage sites and history museums', category: 'culture' },
  food: { query: 'highly rated local restaurants food markets and food experiences', category: 'food' },
  photography: { query: 'scenic viewpoints architecture and photogenic landmarks', category: 'experience' },
  shopping: { query: 'local shopping streets artisan boutiques and markets', category: 'experience' },
  nightlife: { query: 'live music cocktail bars and evening cultural experiences', category: 'experience' },
  nature: { query: 'parks gardens waterfront walks and outdoor attractions', category: 'nature' },
};

/** Keeps the Places key on the server and lets the demo fall back safely. */
export class GooglePlacesService {
  async searchAttractions(destination: string, limit: number, preferences: { interests: Interest[]; foodPreferences: string[] }): Promise<PlaceAttraction[]> {
    const apiKey = config.googlePlaces.apiKey;
    if (!apiKey) return [];
    const foodDetail = preferences.foodPreferences.filter(Boolean).join(', ');
    const selected = preferences.interests
      .map((interest) => searchForInterest[interest])
      .filter((search): search is { query: string; category: ItemCategory } => Boolean(search))
      .map((search) => search.category === 'food' && foodDetail ? { ...search, query: `${search.query} suited to ${foodDetail}` } : search);
    if (!selected.some((search) => search.category === 'food')) selected.push({ query: `highly rated local restaurants and food markets${foodDetail ? ` suited to ${foodDetail}` : ''}`, category: 'food' });
    if (selected.length === 0) selected.push({ query: 'popular visitor attractions and sights', category: 'culture' });
    const searches = selected.slice(0, 4);
    const resultsPerSearch = Math.min(Math.max(Math.ceil(limit / searches.length) + 1, 2), 20);
    const searchesWithResults = await Promise.all(searches.map(async (search) => ({ search, places: await this.search(destination, search.query, resultsPerSearch, apiKey) })));
    const deduped = new Map<string, PlaceAttraction>();
    for (const { search, places } of searchesWithResults) {
      for (const place of places) {
        if (!deduped.has(place.id)) deduped.set(place.id, { ...place, category: search.category });
      }
    }
    return [...deduped.values()].slice(0, limit);
  }

  private async search(destination: string, query: string, limit: number, apiKey: string): Promise<Omit<PlaceAttraction, 'category'>[]> {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress',
      },
      body: JSON.stringify({ textQuery: `${query} in ${destination}`, languageCode: 'en', maxResultCount: Math.min(Math.max(limit, 2), 20) }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 240);
      throw new Error(`Google Places search returned ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    const body = await response.json() as { places?: Array<{ id?: string; displayName?: { text?: string }; formattedAddress?: string; shortFormattedAddress?: string }> };
    return (body.places ?? [])
      .filter((place) => place.displayName?.text && (place.formattedAddress || place.shortFormattedAddress))
      .map((place, index) => ({ id: place.id ?? `place-${index}`, name: place.displayName!.text!, address: place.formattedAddress ?? place.shortFormattedAddress! }));
  }
}
