import { config } from '../config.js';

export interface WeatherObservation {
  location: string;
  temperatureC: number;
  condition: string;
  weatherCode: number;
  windKph: number;
  timezone: string;
  observedAt: string;
  source: 'google-weather' | 'open-meteo' | 'demo-fallback';
  live: boolean;
  diagnostic?: string;
}

interface GeocodingResponse {
  results?: Array<{ name: string; country?: string; latitude: number; longitude: number; timezone?: string }>;
}

interface ForecastResponse {
  timezone?: string;
  current?: { time: string; temperature_2m: number; weather_code: number; wind_speed_10m: number };
}

interface GoogleWeatherResponse {
  currentTime: string;
  timeZone?: { id?: string };
  weatherCondition?: { type?: string; description?: { text?: string } };
  temperature?: { degrees?: number };
  wind?: { speed?: { value?: number } };
}

export const weatherCodeLabel = (code: number): string => {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorms';
  return 'Mixed conditions';
};

const fallbackFor = (destination: string, diagnostic: string): WeatherObservation => {
  const normalized = destination.toLowerCase();
  const temperatureC = normalized.includes('japan') || normalized.includes('tokyo') ? 22
    : normalized.includes('bali') ? 29
      : normalized.includes('thailand') || normalized.includes('bangkok') ? 31
        : normalized.includes('tahoe') ? 18
          : 21;
  return {
    location: destination,
    temperatureC,
    condition: 'Demo weather unavailable',
    weatherCode: -1,
    windKph: 0,
    timezone: 'Local time',
    observedAt: new Date().toISOString(),
    source: 'demo-fallback',
    live: false,
    diagnostic,
  };
};

export class WeatherService {
  async current(destination: string): Promise<WeatherObservation> {
    try {
      const geocodeUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
      geocodeUrl.searchParams.set('name', destination);
      geocodeUrl.searchParams.set('count', '1');
      geocodeUrl.searchParams.set('language', 'en');
      geocodeUrl.searchParams.set('format', 'json');
      const geocodeResponse = await fetch(geocodeUrl, { signal: AbortSignal.timeout(5_000) });
      if (!geocodeResponse.ok) throw new Error(`Geocoding returned ${geocodeResponse.status}`);
      const place = ((await geocodeResponse.json()) as GeocodingResponse).results?.[0];
      if (!place) throw new Error(`No weather location found for ${destination}`);

      if (config.googleWeather.apiKey) {
        try {
          const googleUrl = new URL('https://weather.googleapis.com/v1/currentConditions:lookup');
          googleUrl.searchParams.set('key', config.googleWeather.apiKey);
          googleUrl.searchParams.set('location.latitude', String(place.latitude));
          googleUrl.searchParams.set('location.longitude', String(place.longitude));
          googleUrl.searchParams.set('unitsSystem', 'METRIC');
          const googleResponse = await fetch(googleUrl, { signal: AbortSignal.timeout(5_000) });
          if (!googleResponse.ok) throw new Error(`Google Weather returned ${googleResponse.status}`);
          const current = (await googleResponse.json()) as GoogleWeatherResponse;
          if (current.temperature?.degrees === undefined) throw new Error('Google Weather response was missing temperature');
          return {
            location: [place.name, place.country].filter(Boolean).join(', '),
            temperatureC: Math.round(current.temperature.degrees),
            condition: current.weatherCondition?.description?.text ?? current.weatherCondition?.type?.replaceAll('_', ' ').toLowerCase() ?? 'Current conditions',
            weatherCode: 0,
            windKph: Math.round(current.wind?.speed?.value ?? 0),
            timezone: current.timeZone?.id ?? place.timezone ?? 'Local time',
            observedAt: current.currentTime,
            source: 'google-weather',
            live: true,
          };
        } catch (error) {
          console.warn('Google Weather unavailable; falling back to Open-Meteo.', error instanceof Error ? error.message : error);
        }
      }

      const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
      forecastUrl.searchParams.set('latitude', String(place.latitude));
      forecastUrl.searchParams.set('longitude', String(place.longitude));
      forecastUrl.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m');
      forecastUrl.searchParams.set('timezone', 'auto');
      const forecastResponse = await fetch(forecastUrl, { signal: AbortSignal.timeout(5_000) });
      if (!forecastResponse.ok) throw new Error(`Weather returned ${forecastResponse.status}`);
      const forecast = (await forecastResponse.json()) as ForecastResponse;
      if (!forecast.current) throw new Error('Current weather was missing from the response');

      return {
        location: [place.name, place.country].filter(Boolean).join(', '),
        temperatureC: Math.round(forecast.current.temperature_2m),
        condition: weatherCodeLabel(forecast.current.weather_code),
        weatherCode: forecast.current.weather_code,
        windKph: Math.round(forecast.current.wind_speed_10m),
        timezone: forecast.timezone ?? place.timezone ?? 'Local time',
        observedAt: forecast.current.time,
        source: 'open-meteo',
        live: true,
      };
    } catch (error) {
      return fallbackFor(destination, error instanceof Error ? error.message : 'Weather request failed');
    }
  }
}
