'use client';

// Reusable location picker for onboarding & admin flows.
// Draggable pin on a MapLibre + OSM raster map.
// Latitude/longitude are stored on the parent form but NEVER shown
// as raw numbers — the business-facing interaction is purely visual.

import { useEffect, useRef, useState } from 'react';

type AnyMap = {
  remove: () => void;
  on: (e: string, cb: (...args: unknown[]) => void) => void;
  addControl: (...args: unknown[]) => void;
  flyTo: (...args: unknown[]) => void;
};
type AnyMarker = {
  setLngLat: (...args: unknown[]) => AnyMarker;
  getLngLat: () => { lat: number; lng: number };
  addTo: (m: AnyMap) => AnyMarker;
  remove: () => void;
  on: (e: string, cb: () => void) => AnyMarker;
};

interface Props {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  heightPx?: number;
}

const DEFAULT_LAT = 21.1458;
const DEFAULT_LNG = 79.0882;

function tileStyle(): string | Record<string, unknown> {
  const override = process.env.NEXT_PUBLIC_MAP_STYLE_URL;
  if (override) return override;
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
        maxzoom: 19,
      },
    },
    layers: [
      { id: 'osm', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 22 },
    ],
  };
}

export function BusinessLocationPicker({ lat, lng, onChange, heightPx = 260 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<AnyMap | null>(null);
  const pinRef = useRef<AnyMarker | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let maplibregl: any;
      try {
        const mod = await import('maplibre-gl');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        maplibregl = (mod as any).default || mod;
        try {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore — css side effect
          await import('maplibre-gl/dist/maplibre-gl.css');
        } catch { /* non-fatal */ }
      } catch (err) {
        console.error('[business-location-picker] maplibre load failed', err);
        if (!cancelled) setLoadError('Map unavailable. Refresh and try again.');
        return;
      }
      if (cancelled || !containerRef.current) return;

      const initLat = lat ?? DEFAULT_LAT;
      const initLng = lng ?? DEFAULT_LNG;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: tileStyle(),
        center: [initLng, initLat],
        zoom: lat !== null && lng !== null ? 15 : 5,
        attributionControl: { compact: true },
      }) as unknown as AnyMap;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: false,
          showUserLocation: true,
        }),
        'top-right'
      );

      map.on('load', () => setReady(true));

      const pinEl = document.createElement('div');
      pinEl.style.fontSize = '32px';
      pinEl.style.cursor = 'grab';
      pinEl.style.userSelect = 'none';
      pinEl.textContent = '📍';
      const pin = (
        new maplibregl.Marker({ element: pinEl, draggable: true, anchor: 'bottom' }) as unknown as AnyMarker
      )
        .setLngLat([initLng, initLat])
        .addTo(map);
      pin.on('dragend', () => {
        const p = pin.getLngLat();
        onChange(p.lat, p.lng);
      });
      pinRef.current = pin;

      map.on('click', (...args: unknown[]) => {
        const e = args[0] as { lngLat: { lat: number; lng: number } };
        pin.setLngLat([e.lngLat.lng, e.lngLat.lat]);
        onChange(e.lngLat.lat, e.lngLat.lng);
      });

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      pinRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      pinRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !pinRef.current) return;
    if (lat === null || lng === null) return;
    pinRef.current.setLngLat([lng, lat]);
    mapRef.current.flyTo({ center: [lng, lat], zoom: 15, speed: 1.4 });
  }, [lat, lng, ready]);

  const useMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange(pos.coords.latitude, pos.coords.longitude),
      () => { /* user denied — silent */ },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  if (loadError) {
    return (
      <div
        style={{
          height: heightPx,
          borderRadius: 10,
          border: '1px dashed #ddd',
          background: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: '#999',
          padding: 12,
          textAlign: 'center',
        }}
      >
        {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: heightPx,
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid var(--line, #ddd)',
        }}
        aria-label="Map — drag the pin to your restaurant's exact location"
      />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11.5px] text-muted-foreground m-0">
          Drag the pin to your restaurant&apos;s exact spot. Customers&apos; delivery
          distance is measured from here.
        </p>
        <button
          type="button"
          onClick={useMyLocation}
          className="text-[11.5px] px-2.5 py-1 rounded-md border border-border bg-secondary hover:border-primary/60 transition-colors"
        >
          📍 Use my current location
        </button>
      </div>
    </div>
  );
}

export default BusinessLocationPicker;
