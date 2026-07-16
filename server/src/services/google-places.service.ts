import { config } from '../config.js';

export interface PlaceAttraction {
  id: string;
  name: string;
  address: string;
}

/** Keeps the Places key on the server and lets the demo fall back safely. */
export class GooglePlacesService {
  async searchAttractions(destination: string, limit: number): Promise<PlaceAttraction[]> {
    if (!config.googlePlaces.apiKey) return [];
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': config.googlePlaces.apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress',
      },
      body: JSON.stringify({ textQuery: `popular visitor attractions and sights in ${destination}`, languageCode: 'en', maxResultCount: Math.min(Math.max(limit, 2), 20) }),
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
