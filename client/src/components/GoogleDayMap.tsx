import { useEffect, useMemo, useRef, useState } from 'react';
import type { ItineraryItem, Trip } from '../types';

type GoogleRuntime = { maps: any };
let mapsLoader: Promise<GoogleRuntime> | null = null;

const loadMaps = (key: string) => {
  const existing = (window as unknown as { google?: GoogleRuntime }).google;
  if (existing?.maps) return Promise.resolve(existing);
  if (mapsLoader) return mapsLoader;
  mapsLoader = new Promise((resolve, reject) => {
    const prior = document.querySelector<HTMLScriptElement>('script[data-journeyos-google-maps]');
    if (prior) {
      prior.addEventListener('load', () => resolve((window as unknown as { google: GoogleRuntime }).google));
      prior.addEventListener('error', () => reject(new Error('Google Maps could not load.')));
      return;
    }
    const script = document.createElement('script');
    script.dataset.journeyosGoogleMaps = 'true';
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.onload = () => resolve((window as unknown as { google: GoogleRuntime }).google);
    script.onerror = () => reject(new Error('Google Maps could not load.'));
    document.head.appendChild(script);
  });
  return mapsLoader;
};

const locationFor = (item: ItineraryItem, destination: string) => {
  const subtitle = item.subtitle.replace(/\s*(?:·|Â·)\s*/g, ', ').replace(/\s*(?:→|â†’)\s*/g, ' to ');
  if (/^(central|downtown)\s+/i.test(subtitle) || /city center/i.test(subtitle)) return `${item.title}, ${destination}`;
  return `${item.title}, ${subtitle}, ${destination}`;
};

export function GoogleDayMap({ trip, activeDay, onSelect }: { trip: Trip; activeDay: number; onSelect: (item: ItineraryItem) => void }) {
  const container = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [useEmbedFallback, setUseEmbedFallback] = useState(false);
  const [routeSummary, setRouteSummary] = useState('Building the day route...');
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
  const stops = useMemo(() => {
    const seen = new Set<string>();
    return trip.itinerary
      .filter((item) => item.day === activeDay)
      .sort((a, b) => a.time.localeCompare(b.time))
      .filter((item) => {
        const query = locationFor(item, trip.request.destination).toLowerCase().replace(/^return to\s*·?\s*/, '');
        if (seen.has(query)) return false;
        seen.add(query);
        return true;
      });
  }, [activeDay, trip.itinerary, trip.request.destination]);

  useEffect(() => {
    let canceled = false;
    let settled = false;
    setStatus('loading');
    setUseEmbedFallback(false);
    const fallbackTimer = window.setTimeout(() => {
      if (canceled || settled) return;
      settled = true;
      setUseEmbedFallback(true);
      setStatus('ready');
      setRouteSummary(`${stops.length} planned stops · interactive markers unavailable, showing the Google route preview`);
    }, 3000);
    void loadMaps(key).then(async ({ maps }) => {
      if (canceled || !container.current) return;
      const map = new maps.Map(container.current, { center: { lat: 0, lng: 0 }, zoom: 2, mapTypeControl: false, streetViewControl: false, fullscreenControl: true });
      window.setTimeout(() => {
        if (!canceled && container.current?.querySelector('.gm-err-container')) {
          setUseEmbedFallback(true);
          setStatus('ready');
          setRouteSummary(`${stops.length} route stops · ${stops.reduce((sum, stop) => sum + stop.travelMins, 0)} min planned transit`);
        }
      }, 900);
      const geocoder = new maps.Geocoder();
      const geocode = (address: string) => new Promise<any | null>((resolve) => geocoder.geocode({ address }, (results: any[], resultStatus: string) => resolve(resultStatus === 'OK' && results?.[0]?.geometry?.location ? results[0].geometry.location : null)));
      const located = (await Promise.all(stops.map(async (stop) => ({ stop, location: await geocode(locationFor(stop, trip.request.destination)) })))).filter((entry) => entry.location);
      if (canceled || settled) return;
      if (!located.length) {
        settled = true;
        window.clearTimeout(fallbackTimer);
        setUseEmbedFallback(true);
        setStatus('error');
        setRouteSummary(`${stops.length} planned stops · showing the Google route preview`);
        return;
      }
      if (canceled) {
        setStatus('error');
        setRouteSummary('Google could not place these stops. Open the full route instead.');
        return;
      }
      const bounds = new maps.LatLngBounds();
      const info = new maps.InfoWindow();
      located.forEach(({ stop, location }, index) => {
        bounds.extend(location);
        const marker = new maps.Marker({ map, position: location, label: { text: String(index + 1), color: '#ffffff', fontWeight: '700' }, title: `${stop.time} · ${stop.title}` });
        marker.addListener('click', () => {
          onSelect(stop);
          const content = document.createElement('div');
          const title = document.createElement('strong');
          title.textContent = `${index + 1}. ${stop.title}`;
          const detail = document.createElement('div');
          detail.textContent = `${stop.time} · ${stop.durationMins} min here`;
          content.append(title, detail);
          info.setContent(content);
          info.open({ map, anchor: marker });
        });
      });
      map.fitBounds(bounds, 64);
      if (located.length > 1) {
        const renderer = new maps.DirectionsRenderer({ map, suppressMarkers: true, preserveViewport: true, polylineOptions: { strokeColor: '#245B4F', strokeWeight: 5, strokeOpacity: 0.8 } });
        const service = new maps.DirectionsService();
        service.route({ origin: located[0].location, destination: located[located.length - 1].location, waypoints: located.slice(1, -1).map((entry) => ({ location: entry.location, stopover: true })), travelMode: maps.TravelMode.DRIVING }, (result: any, resultStatus: string) => {
          if (resultStatus !== 'OK' || !result) {
            setRouteSummary(`${located.length} mapped stops · route order shown below`);
            return;
          }
          renderer.setDirections(result);
          const legs = result.routes?.[0]?.legs ?? [];
          const distance = legs.reduce((sum: number, leg: any) => sum + (leg.distance?.value ?? 0), 0) / 1000;
          const minutes = Math.round(legs.reduce((sum: number, leg: any) => sum + (leg.duration?.value ?? 0), 0) / 60);
          setRouteSummary(`${located.length} mapped stops · ${distance.toFixed(1)} km · about ${minutes} min driving`);
        });
      } else setRouteSummary('1 mapped stop');
      settled = true;
      window.clearTimeout(fallbackTimer);
      setStatus('ready');
    }).catch(() => {
      if (!canceled && !settled) {
        settled = true;
        window.clearTimeout(fallbackTimer);
        setUseEmbedFallback(true);
        setStatus('error');
        setRouteSummary(`${stops.length} planned stops · showing the Google route preview`);
      }
    });
    return () => { canceled = true; window.clearTimeout(fallbackTimer); };
  }, [activeDay, key, onSelect, stops, trip.request.destination]);

  const mapsUrl = `https://www.google.com/maps/dir/${stops.map((stop) => encodeURIComponent(locationFor(stop, trip.request.destination))).join('/')}`;
  const origin = stops[0] ? locationFor(stops[0], trip.request.destination) : trip.request.destination;
  const destination = stops.length ? locationFor(stops[stops.length - 1], trip.request.destination) : trip.request.destination;
  const waypoints = stops.slice(1, -1).map((stop) => locationFor(stop, trip.request.destination)).join('|');
  const embedUrl = `https://www.google.com/maps/embed/v1/directions?key=${encodeURIComponent(key)}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&mode=driving`;
  return <section className="overflow-hidden rounded-[28px] border border-stone-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="eyebrow">Google day map</p><h3 className="mt-1 text-lg font-bold text-ink">Day {activeDay} · {trip.request.destination}</h3><p className={`mt-1 text-xs ${status === 'error' ? 'font-semibold text-coral' : 'text-stone-500'}`}>{routeSummary}</p></div><a href={mapsUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-moss hover:text-ink">Open full route ↗</a></div><div className="relative">{useEmbedFallback ? <iframe title={`Google route preview for day ${activeDay}`} src={embedUrl} className="h-[430px] w-full border-0" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /> : <div ref={container} className="h-[430px] w-full bg-[#e9f0ec]" />}{status === 'loading' && <div className="absolute inset-0 grid place-items-center bg-[#e9f0ec]/90 text-sm font-bold text-moss">Placing today's stops...</div>}</div><div className="border-t border-stone-100 bg-[#fafbf9] px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">Select a numbered stop for details</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{stops.map((stop, index) => <button key={stop.id} onClick={() => onSelect(stop)} className="flex items-center gap-2 rounded-xl px-2 py-2 text-left text-xs transition hover:bg-white"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-moss text-[10px] font-bold text-white">{index + 1}</span><span className="min-w-0"><b className="block truncate text-ink">{stop.time} · {stop.title}</b><span className="text-stone-500">{index < stops.length - 1 ? `${stops[index + 1].travelMins} min to next stop` : 'Final stop'}</span></span></button>)}</div></div></section>;
}
