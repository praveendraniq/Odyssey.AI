import { config } from '../config.js';
import type { PlaceAttraction } from './google-places.service.js';

/**
 * Uses Google Routes only to sequence the real Places candidates. The itinerary
 * service remains responsible for assigning the ordered stops to trip days.
 */
export class GoogleRoutesService {
  async optimizeStops(destination: string, places: PlaceAttraction[]): Promise<PlaceAttraction[]> {
    if (!config.googlePlaces.apiKey || places.length < 3) return places;

    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': config.googlePlaces.apiKey,
        'X-Goog-FieldMask': 'routes.optimizedIntermediateWaypointIndex',
      },
      body: JSON.stringify({
        // A city-center loop lets Routes choose the efficient order of every
        // candidate. The UI subsequently routes from the first stop to the last
        // stop of each individual day.
        origin: { address: destination },
        destination: { address: destination },
        intermediates: places.slice(0, 20).map((place) => ({ address: place.address })),
        travelMode: 'DRIVE',
        optimizeWaypointOrder: true,
        languageCode: 'en-US',
      }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 240);
      throw new Error(`Google Routes optimization returned ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    const body = await response.json() as { routes?: Array<{ optimizedIntermediateWaypointIndex?: number[] }> };
    const order = body.routes?.[0]?.optimizedIntermediateWaypointIndex ?? [];
    if (order.length !== Math.min(places.length, 20)) return places;
    const optimized = order.map((index) => places[index]).filter((place): place is PlaceAttraction => Boolean(place));
    return [...optimized, ...places.slice(20)];
  }
}
