'use client';

// MapPicker — embedded MapLibre GL map for /m page delivery location.
//
// Phase 3L v2. Replaces the buttons-only flow with an interactive map:
//   - Draggable customer pin (initial position from prop)
//   - Outlet markers (showing their delivery radius as a translucent
//     circle, so the customer can see if they're in-zone)
//   - "Recenter on me" control wraps the browser Geolocation API
//
// MapLibre touches `window` and `document.createElement('canvas')`,
// so this component MUST be loaded via next/dynamic with ssr: false.
// The wrapper in menu-public-client.tsx handles that — never import
// MapPicker directly from a server component.
//
// Tile provider: free OpenStreetMap demo tiles
// (https://demotiles.maplibre.org). Fine for current scale (<5k tile
// loads/day). When traffic grows, swap to Stadia Maps free tier by
// adding NEXT_PUBLIC_MAP_STYLE_URL env var.

import { useEffect, useRef, useState } from 'react';

// MapLibre is loaded at runtime via dynamic import. That keeps this
// file building before the user has run `npm install maplibre-gl`,
// and naturally code-splits the ~200KB library out of the initial
// bundle so /m page TTFB stays fast on slow mobile networks.
//
// `any` typing inside the effect — once maplibre-gl is installed the
// real types are still usable elsewhere; here we just want clean
// compilation pre-install. Real type safety on MapLibre internals
// isn't load-bearing; bugs would surface at runtime in the browser
// either way.
type AnyMap = { remove: () => void; on: (e: string, cb: (...args: unknown[]) => void) => void; addControl: (...args: unknown[]) => void; addSource: (...args: unknown[]) => void; addLayer: (...args: unknown[]) => void; getSource: (...args: unknown[]) => unknown; flyTo: (...args: unknown[]) => void };
type AnyMarker = { setLngLat: (...args: unknown[]) => AnyMarker; getLngLat: () => { lat: number; lng: number }; addTo: (m: AnyMap) => AnyMarker; remove: () => void; on: (e: string, cb: () => void) => AnyMarker };

interface OutletMarker {
  id: string;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  deliveryRadiusKm?: number;
}

interface Props {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  outlets?: OutletMarker[];
  /** Map height in CSS pixels. Default 240 — keeps the /m page
   *  scrolling manageable on mobile while still being usable. */
  heightPx?: number;
}

// Default center when the customer hasn't shared a location yet.
// India centroid (Nagpur-ish) — close enough to any restaurant
// outlet that we can fall through to the outlet's lat/lng if any.
const DEFAULT_LAT = 21.1458;
const DEFAULT_LNG = 79.0882;

// Inline MapLibre style spec using OpenStreetMap raster tiles.
//
// Previous: `https://demotiles.maplibre.org/style.json` — that's just
// a country-outline demo without streets, so customers saw a flat
// yellow rectangle instead of a map. OSM raster tiles render real
// streets, points of interest, building footprints.
//
// Three subdomains (a/b/c) are sharded so a single client doesn't
// hit one CDN edge for every tile — smoother loading on mobile.
//
// To upgrade to Stadia Maps (200k free tiles/mo, smoother style),
// set NEXT_PUBLIC_MAP_STYLE_URL=https://tiles.stadiamaps.com/styles/osm_bright.json
// in env. The component honours that override.
function tileStyleUrl(): string | Record<string, unknown> {
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
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  };
}

export function MapPicker({ lat, lng, onChange, outlets = [], heightPx = 240 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<AnyMap | null>(null);
  const pinMarkerRef = useRef<AnyMarker | null>(null);
  const outletMarkersRef = useRef<AnyMarker[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Lazy-init the map once the container mounts. We rebuild only on
  // remount; outlet/pin updates flow through the imperative refs.
  // MapLibre is imported lazily so the bundle isn't paid until the
  // user actually reaches the checkout step.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      // Typed as `any` because the maplibre-gl package may not be
      // installed at TS check time (the optional npm install lives
      // outside the build for low-touch deployments). At runtime we
      // either get a real module or fall through to the friendly
      // error state below.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let maplibregl: any;
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore — module may not be installed; runtime guarded
        const mod = await import('maplibre-gl');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        maplibregl = (mod as any).default || mod;
        // CSS side-effect; ok if it fails (the map still works,
        // just looks default).
        try {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          await import('maplibre-gl/dist/maplibre-gl.css');
        } catch { /* css load failure is non-fatal */ }
      } catch (err) {
        console.error('[map-picker] maplibre-gl import failed', err);
        if (!cancelled) setLoadError('Map library unavailable. Use the buttons below.');
        return;
      }
      if (cancelled || !containerRef.current) return;

      const initialLat = lat ?? (outlets[0]?.latitude ?? DEFAULT_LAT);
      const initialLng = lng ?? (outlets[0]?.longitude ?? DEFAULT_LNG);
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: tileStyleUrl(),
        center: [initialLng, initialLat],
        zoom: lat !== null && lng !== null ? 14 : 11,
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

      map.on('load', () => {
        setReady(true);
        // Outlet markers + zone circles.
        for (const o of outlets) {
          if (typeof o.deliveryRadiusKm === 'number' && o.deliveryRadiusKm > 0) {
            const sourceId = `outlet-zone-${o.id}`;
            if (!map.getSource(sourceId)) {
              map.addSource(sourceId, {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  geometry: { type: 'Point', coordinates: [o.longitude, o.latitude] },
                  properties: { radiusKm: o.deliveryRadiusKm },
                },
              });
              map.addLayer({
                id: `outlet-zone-${o.id}-circle`,
                type: 'circle',
                source: sourceId,
                paint: {
                  // Approximate radius in pixels. Conservative —
                  // mobile zoom means precise meter-pixel conversion
                  // is overkill; the visual cue is what matters.
                  'circle-radius': {
                    stops: [
                      [8, o.deliveryRadiusKm * 1.5],
                      [12, o.deliveryRadiusKm * 8],
                      [16, o.deliveryRadiusKm * 32],
                    ],
                  },
                  'circle-color': '#1a73e8',
                  'circle-opacity': 0.08,
                  'circle-stroke-color': '#1a73e8',
                  'circle-stroke-opacity': 0.35,
                  'circle-stroke-width': 1,
                },
              });
            }
          }

          const el = document.createElement('div');
          el.style.background = '#1a73e8';
          el.style.color = '#fff';
          el.style.padding = '4px 8px';
          el.style.borderRadius = '99px';
          el.style.fontSize = '11px';
          el.style.fontWeight = '600';
          el.style.boxShadow = '0 2px 6px rgba(0,0,0,.2)';
          el.style.whiteSpace = 'nowrap';
          el.textContent = `🍽️ ${o.name}`;
          const m = (new maplibregl.Marker({ element: el, anchor: 'bottom' }) as unknown as AnyMarker)
            .setLngLat([o.longitude, o.latitude])
            .addTo(map);
          outletMarkersRef.current.push(m);
        }
      });

      // Draggable customer pin. Tap-to-set on map click (in addition
      // to the drag) so phone users who can't easily long-press the
      // pin still have a single-tap path.
      const pinEl = document.createElement('div');
      pinEl.style.fontSize = '28px';
      pinEl.style.cursor = 'grab';
      pinEl.style.userSelect = 'none';
      pinEl.textContent = '📍';
      const pin = (new maplibregl.Marker({ element: pinEl, draggable: true, anchor: 'bottom' }) as unknown as AnyMarker)
        .setLngLat([initialLng, initialLat])
        .addTo(map);
      pin.on('dragend', () => {
        const p = pin.getLngLat();
        onChange(p.lat, p.lng);
      });
      pinMarkerRef.current = pin;

      map.on('click', (...args: unknown[]) => {
        const e = args[0] as { lngLat: { lat: number; lng: number } };
        pin.setLngLat([e.lngLat.lng, e.lngLat.lat]);
        onChange(e.lngLat.lat, e.lngLat.lng);
      });

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      // Detach on unmount — single-page nav between pages should
      // dispose the WebGL context.
      for (const m of outletMarkersRef.current) m.remove();
      outletMarkersRef.current = [];
      pinMarkerRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      pinMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move the pin when parent state updates (e.g. user clicked
  // "Use my current location" — that updates props, not the map).
  useEffect(() => {
    if (!ready || !mapRef.current || !pinMarkerRef.current) return;
    if (lat === null || lng === null) return;
    pinMarkerRef.current.setLngLat([lng, lat]);
    mapRef.current.flyTo({ center: [lng, lat], zoom: 15, speed: 1.5 });
  }, [lat, lng, ready]);

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
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: heightPx,
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px solid #ddd',
      }}
      aria-label="Map — drag the pin or tap to set delivery location"
    />
  );
}

export default MapPicker;
