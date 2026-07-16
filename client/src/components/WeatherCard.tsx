import { useEffect, useState } from 'react';
import { CloudRain, RefreshCw } from 'lucide-react';
import { api } from '../api';
import type { WeatherObservation } from '../types';

export function WeatherCard({ destination }: { destination: string }) {
  const [weather, setWeather] = useState<WeatherObservation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getWeather(destination)
      .then(({ weather: result }) => { if (active) setWeather(result); })
      .catch(() => { if (active) setWeather(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [destination]);

  return <article className="rounded-3xl border border-stone-200 bg-white p-5">
    <div className="flex items-center justify-between"><span className="text-sm font-bold text-ink">Current destination weather</span><CloudRain className="text-sky-500" size={19} /></div>
    {loading ? <div className="mt-5 flex items-center gap-2 text-sm text-stone-500"><RefreshCw className="animate-spin" size={15} />Checking {destination}…</div>
      : weather ? <><p className="mt-4 text-2xl font-bold text-ink">{weather.temperatureC}°C · {weather.condition}</p><p className="mt-2 text-xs text-stone-500">{weather.location} · {weather.windKph} km/h wind</p><p className={`mt-3 text-[10px] font-bold uppercase tracking-wider ${weather.live ? 'text-moss' : 'text-amber-700'}`}>{weather.live ? `Live via ${weather.source === 'google-weather' ? 'Google Weather' : 'Open-Meteo fallback'}` : 'Live weather unavailable · demo fallback shown'}</p></>
        : <p className="mt-5 text-sm text-amber-700">Weather is temporarily unavailable for {destination}.</p>}
  </article>;
}
