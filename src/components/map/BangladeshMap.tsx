'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  Map as MapLibreMap,
  LngLatBounds,
  setWorkerUrl,
  type MapLayerMouseEvent,
  type ErrorEvent as MapLibreErrorEvent,
  type LayerSpecification,
  type StyleSpecification,
  type GeoJSONSource,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStore } from '@/store/useMapStore';
import { getAllDistrictSummaries } from '@/services/dataService';
import type { DistrictSummary, Theme, Language, MapLayerType } from '@/types';

// ── Explicit Worker URL for Next.js 16 Turbopack ────────────────────────────
if (typeof window !== 'undefined') {
  setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
}

const STYLE_URLS = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
} as const;

// ── Geographic bounds for all 64 districts of Bangladesh ─────────────────────
const BANGLADESH_BOUNDS: [[number, number], [number, number]] = [
  [88.0, 20.55], // Southwest [lng, lat]
  [92.7, 26.65], // Northeast [lng, lat]
];

// Constrain pan extent so user cannot wander endlessly into empty ocean
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [85.5, 19.5],
  [95.0, 27.5],
];

const EMPTY_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

function getFillColor(theme: Theme, severity: string | null): string {
  if (theme === 'dark') {
    switch (severity) {
      case 'Critical':
        return 'rgba(229, 77, 46, 0.45)'; // Crimson
      case 'High':
        return 'rgba(245, 158, 11, 0.40)'; // Amber
      case 'Advisory':
        return 'rgba(56, 189, 248, 0.32)'; // Sky Blue
      default:
        return 'rgba(100, 116, 139, 0.08)';
    }
  } else {
    switch (severity) {
      case 'Critical':
        return 'rgba(229, 77, 46, 0.55)';
      case 'High':
        return 'rgba(245, 158, 11, 0.50)';
      case 'Advisory':
        return 'rgba(2, 132, 199, 0.42)';
      default:
        return 'rgba(148, 163, 184, 0.12)';
    }
  }
}

// ── Pure Geometric Centroid Calculator (Polygon & MultiPolygon Safe) ─────────
function computeDistrictCentroid(feature: GeoJSON.Feature): [number, number] {
  try {
    const geom = feature.geometry;
    if (geom.type === 'Polygon') {
      const ring = (geom as GeoJSON.Polygon).coordinates[0];
      if (ring && ring.length > 0) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const [x, y] of ring) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        const lng = (minX + maxX) / 2;
        const lat = (minY + maxY) / 2;
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
          return [lng, lat];
        }
      }
    } else if (geom.type === 'MultiPolygon') {
      // Pick the polygon with the largest bounding box area (mainland / main body)
      let maxRing: number[][] = [];
      let maxArea = -1;

      for (const poly of (geom as GeoJSON.MultiPolygon).coordinates) {
        const ring = poly[0];
        if (!ring || ring.length === 0) continue;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const [x, y] of ring) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        const area = (maxX - minX) * (maxY - minY);
        if (area > maxArea) {
          maxArea = area;
          maxRing = ring;
        }
      }

      if (maxRing.length > 0) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const [x, y] of maxRing) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        const lng = (minX + maxX) / 2;
        const lat = (minY + maxY) / 2;
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
          return [lng, lat];
        }
      }
    }
  } catch {
    // fallback below
  }

  // Fallback to feature property coordinates or center of Bangladesh
  const pLon = Number(feature.properties?.lon);
  const pLat = Number(feature.properties?.lat);
  if (Number.isFinite(pLon) && Number.isFinite(pLat)) {
    return [pLon, pLat];
  }
  return [90.356, 23.685];
}

// ── Pure Style-Builder Helper with Beacons & Density Indicators ─────────────
function buildDistrictLayers(
  theme: Theme,
  hoveredCode: string | null = null,
  selectedCode: string | null = null,
  activeLayers: Set<MapLayerType> = new Set(['priority', 'news', 'civic']),
  language: Language = 'en'
): LayerSpecification[] {
  const isDark = theme === 'dark';
  const showPriority = activeLayers.has('priority');
  const showNews = activeLayers.has('news');
  const showCivic = activeLayers.has('civic');

  return [
    // 1. Districts Fill Layer (Severity Choropleth)
    {
      id: 'districts-fill',
      type: 'fill',
      source: 'bangladesh-districts',
      layout: {
        visibility: showPriority ? 'visible' : 'none',
      },
      paint: {
        'fill-color': isDark
          ? [
              'case',
              ['has', 'fillColorDark'],
              ['get', 'fillColorDark'],
              'rgba(100, 116, 139, 0.08)',
            ]
          : [
              'case',
              ['has', 'fillColorLight'],
              ['get', 'fillColorLight'],
              'rgba(148, 163, 184, 0.12)',
            ],
        'fill-opacity': isDark ? 0.9 : 0.95,
      },
    } as LayerSpecification,

    // 2. Districts Outline Layer (Crisp, clearly visible in both themes)
    {
      id: 'districts-outline',
      type: 'line',
      source: 'bangladesh-districts',
      paint: {
        'line-color': isDark ? 'rgba(148, 163, 184, 0.45)' : 'rgba(30, 41, 59, 0.48)',
        'line-width': 1.1,
      },
    } as LayerSpecification,

    // 3. Hover Outline Highlight (Filter-driven, robust against style rebuilds)
    {
      id: 'districts-hover-outline',
      type: 'line',
      source: 'bangladesh-districts',
      filter: ['==', ['get', 'district_code'], hoveredCode || ''],
      paint: {
        'line-color': isDark ? '#38bdf8' : '#0284c7',
        'line-width': 2.0,
      },
    } as LayerSpecification,

    // 4. Selected District Highlight Border (High contrast)
    {
      id: 'districts-selected-outline',
      type: 'line',
      source: 'bangladesh-districts',
      filter: ['==', ['get', 'district_code'], selectedCode || ''],
      paint: {
        'line-color': isDark ? '#38bdf8' : '#0f172a',
        'line-width': 2.5,
      },
    } as LayerSpecification,

    // 5. News Density Indicators (Circles scaled by news story volume)
    {
      id: 'news-density-circles',
      type: 'circle',
      source: 'district-centroids',
      filter: ['>', ['get', 'newsCount'], 0],
      layout: {
        visibility: showNews ? 'visible' : 'none',
      },
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'newsCount'],
          1, 6,
          4, 11,
          10, 18
        ],
        'circle-color': isDark ? 'rgba(56, 189, 248, 0.28)' : 'rgba(2, 132, 199, 0.25)',
        'circle-stroke-width': 1.4,
        'circle-stroke-color': isDark ? 'rgba(56, 189, 248, 0.75)' : 'rgba(2, 132, 199, 0.8)',
      },
    } as LayerSpecification,

    // 6. Priority Beacons — Outer Halo Ring
    {
      id: 'priority-beacons-halo',
      type: 'circle',
      source: 'district-centroids',
      filter: ['>', ['get', 'alertCount'], 0],
      layout: {
        visibility: showPriority ? 'visible' : 'none',
      },
      paint: {
        'circle-radius': 17,
        'circle-color': ['get', 'beaconHaloColor'],
        'circle-stroke-width': 1.2,
        'circle-stroke-color': ['get', 'beaconColor'],
        'circle-stroke-opacity': 0.6,
      },
    } as LayerSpecification,

    // 7. Priority Beacons — Inner Color-coded Circular Badge
    {
      id: 'priority-beacons-circle',
      type: 'circle',
      source: 'district-centroids',
      filter: ['>', ['get', 'alertCount'], 0],
      layout: {
        visibility: showPriority ? 'visible' : 'none',
      },
      paint: {
        'circle-radius': 9.5,
        'circle-color': ['get', 'beaconColor'],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    } as LayerSpecification,

    // 8. Priority Beacons — Active Alert Count Number
    {
      id: 'priority-beacons-count',
      type: 'symbol',
      source: 'district-centroids',
      filter: ['>', ['get', 'alertCount'], 0],
      layout: {
        visibility: showPriority ? 'visible' : 'none',
        'text-field': ['to-string', ['get', 'alertCount']],
        'text-font': ['Open Sans Bold'],
        'text-size': 11,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#ffffff',
      },
    } as LayerSpecification,

    // 9. Civic District Centroid Labels
    {
      id: 'civic-labels',
      type: 'symbol',
      source: 'district-centroids',
      minzoom: 7.4,
      layout: {
        visibility: showCivic ? 'visible' : 'none',
        'text-field': ['get', language === 'bn' ? 'district_name_bn' : 'district_name'],
        'text-font': ['Open Sans Regular'],
        'text-size': 10,
        'text-offset': [0, 2.0],
        'text-anchor': 'top',
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': isDark ? 'rgba(241, 245, 249, 0.9)' : 'rgba(15, 23, 42, 0.95)',
        'text-halo-color': isDark ? '#020617' : '#ffffff',
        'text-halo-width': 1.5,
      },
    } as LayerSpecification,
  ];
}

export default function BangladeshMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Persistent reference to enriched GeoJSON data & centroids
  const enrichedGeoJsonRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const districtCentroidsGeoJsonRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const summariesRef = useRef<Map<string, DistrictSummary>>(new Map());

  // Store & sync reactive refs
  const theme = useMapStore((s) => s.theme);
  const currentThemeRef = useRef<Theme>(theme);
  const lastAppliedThemeRef = useRef<Theme>(theme);
  currentThemeRef.current = theme;

  const language = useMapStore((s) => s.language);
  const currentLanguageRef = useRef(language);
  currentLanguageRef.current = language;

  const selectedDistrictCode = useMapStore((s) => s.selectedDistrictCode);
  const selectedDistrictRef = useRef(selectedDistrictCode);
  selectedDistrictRef.current = selectedDistrictCode;

  const isDrawerOpen = useMapStore((s) => s.isDrawerOpen);
  const isDrawerOpenRef = useRef(isDrawerOpen);
  isDrawerOpenRef.current = isDrawerOpen;

  const hoveredDistrictRef = useRef<string | null>(null);

  const activeLayers = useMapStore((s) => s.activeLayers);
  const activeLayersRef = useRef(activeLayers);
  activeLayersRef.current = activeLayers;

  const openDrawer = useMapStore((s) => s.openDrawer);
  const setHoveredDistrict = useMapStore((s) => s.setHoveredDistrict);

  // ── Stamp severity colours and metadata onto features ────────────────────
  const colorizeFeatures = useCallback((geojson: GeoJSON.FeatureCollection) => {
    const lookup = summariesRef.current;
    for (const f of geojson.features) {
      const code = (f.properties?.district_code as string) ?? '';
      const summary = lookup.get(code);
      const sev = summary?.highestSeverity ?? null;

      f.properties = {
        ...f.properties,
        fillColorDark: getFillColor('dark', sev),
        fillColorLight: getFillColor('light', sev),
        alertCount: summary?.activePriorityCount ?? 0,
        newsCount: summary?.newsCount ?? 0,
        nameEn: summary?.nameEn ?? f.properties?.district_name ?? '',
        nameBn: summary?.nameBn ?? f.properties?.district_name_bn ?? '',
        division: summary?.division ?? f.properties?.division ?? '',
      };
    }
  }, []);

  // ── Build Point Centroids Collection ─────────────────────────────────────
  const buildCentroidsCollection = useCallback((geojson: GeoJSON.FeatureCollection) => {
    const lookup = summariesRef.current;
    const centroidFeatures: GeoJSON.Feature[] = geojson.features.map((f) => {
      const code = (f.properties?.district_code as string) ?? '';
      const summary = lookup.get(code);
      const sev = summary?.highestSeverity ?? null;
      const alertCount = summary?.activePriorityCount ?? 0;
      const newsCount = summary?.newsCount ?? 0;
      const [lon, lat] = computeDistrictCentroid(f);

      let beaconColor = '#64748b';
      let beaconHaloColor = 'rgba(100, 116, 139, 0.2)';
      if (sev === 'Critical') {
        beaconColor = '#ef4444';
        beaconHaloColor = 'rgba(239, 68, 68, 0.35)';
      } else if (sev === 'High') {
        beaconColor = '#f59e0b';
        beaconHaloColor = 'rgba(245, 158, 11, 0.35)';
      } else if (sev === 'Advisory') {
        beaconColor = '#0ea5e9';
        beaconHaloColor = 'rgba(14, 165, 233, 0.35)';
      }

      return {
        type: 'Feature',
        id: code,
        geometry: {
          type: 'Point',
          coordinates: [lon, lat],
        },
        properties: {
          district_code: code,
          district_name: f.properties?.district_name ?? '',
          district_name_bn: f.properties?.district_name_bn ?? '',
          division: f.properties?.division ?? '',
          alertCount,
          newsCount,
          highestSeverity: sev,
          beaconColor,
          beaconHaloColor,
        },
      };
    });

    return {
      type: 'FeatureCollection' as const,
      features: centroidFeatures,
    };
  }, []);

  // ── Idempotent Fallback Mounter (for style recovery & initial load) ───────
  const ensureDistrictsMounted = useCallback((map: MapLibreMap, activeTheme: Theme) => {
    if (!map.isStyleLoaded()) return;

    const distData = enrichedGeoJsonRef.current || EMPTY_GEOJSON;
    const centData = districtCentroidsGeoJsonRef.current || EMPTY_GEOJSON;

    if (!map.getSource('bangladesh-districts')) {
      map.addSource('bangladesh-districts', {
        type: 'geojson',
        data: distData,
        promoteId: 'district_code',
      });
    }

    if (!map.getSource('district-centroids')) {
      map.addSource('district-centroids', {
        type: 'geojson',
        data: centData,
        promoteId: 'district_code',
      });
    }

    const layers = buildDistrictLayers(
      activeTheme,
      hoveredDistrictRef.current,
      selectedDistrictRef.current,
      activeLayersRef.current,
      currentLanguageRef.current
    );

    for (const layer of layers) {
      if (!map.getLayer(layer.id)) {
        map.addLayer(layer);
      }
    }
  }, []);

  // ── Initialise Map Canvas ────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialTheme = currentThemeRef.current;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: STYLE_URLS[initialTheme],
      bounds: BANGLADESH_BOUNDS,
      fitBoundsOptions: {
        padding: { top: 80, bottom: 40, left: 80, right: 40 },
      },
      minZoom: 5.5,
      maxZoom: 14,
      maxBounds: MAX_BOUNDS,
      attributionControl: false,
      transformStyle: (_previousStyle, nextStyle): StyleSpecification => {
        try {
          return {
            ...nextStyle,
            sources: {
              ...nextStyle.sources,
              'bangladesh-districts': {
                type: 'geojson',
                data: enrichedGeoJsonRef.current || EMPTY_GEOJSON,
                promoteId: 'district_code',
              },
              'district-centroids': {
                type: 'geojson',
                data: districtCentroidsGeoJsonRef.current || EMPTY_GEOJSON,
                promoteId: 'district_code',
              },
            },
            layers: [
              ...nextStyle.layers,
              ...buildDistrictLayers(
                currentThemeRef.current,
                hoveredDistrictRef.current,
                selectedDistrictRef.current,
                activeLayersRef.current,
                currentLanguageRef.current
              ),
            ],
          } as StyleSpecification;
        } catch (err) {
          console.error('[Aparajeyo transformStyle error]', err);
          return nextStyle;
        }
      },
    });

    mapRef.current = map;
    (window as unknown as Record<string, unknown>).__aparajeyo_map = map;

    // ResizeObserver prevents canvas clipping
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(containerRef.current);

    // Diagnostics logger — Step 2: Never swallow errors
    map.on('error', (e: MapLibreErrorEvent) => {
      console.error('[MapLibre]', e?.error || e);
    });

    // Fallback watcher: if initial data fetch finished after style was ready
    map.on('idle', () => {
      ensureDistrictsMounted(map, currentThemeRef.current);
    });

    // Initial Data Fetch
    map.on('load', async () => {
      try {
        const [geojsonRes, summaries] = await Promise.all([
          fetch('/data/bangladesh-districts.geojson').then((r) => r.json()),
          getAllDistrictSummaries(),
        ]);

        const geojson = geojsonRes as GeoJSON.FeatureCollection;

        for (const s of summaries) {
          summariesRef.current.set(s.districtCode, s);
        }

        geojson.features.forEach((f, i) => {
          f.id = f.properties?.district_code || i;
        });

        colorizeFeatures(geojson);
        enrichedGeoJsonRef.current = geojson;
        const centroids = buildCentroidsCollection(geojson);
        districtCentroidsGeoJsonRef.current = centroids;

        // Push real data into sources
        const distSrc = map.getSource('bangladesh-districts') as GeoJSONSource | undefined;
        if (distSrc) {
          distSrc.setData(geojson);
        } else {
          map.addSource('bangladesh-districts', {
            type: 'geojson',
            data: geojson,
            promoteId: 'district_code',
          });
        }

        const centSrc = map.getSource('district-centroids') as GeoJSONSource | undefined;
        if (centSrc) {
          centSrc.setData(centroids);
        } else {
          map.addSource('district-centroids', {
            type: 'geojson',
            data: centroids,
            promoteId: 'district_code',
          });
        }

        ensureDistrictsMounted(map, currentThemeRef.current);
      } catch (err) {
        console.error('[Aparajeyo MapLibre] Failed to load initial district data:', err);
      }
    });

    // ── Resilient Map-Level Pointer & Click Handlers ────────────────────────
    map.on('mousemove', (e: MapLayerMouseEvent) => {
      const interactiveLayers = [
        'priority-beacons-circle',
        'news-density-circles',
        'districts-fill',
      ].filter((id) => map.getLayer(id));

      if (interactiveLayers.length === 0) {
        map.getCanvas().style.cursor = '';
        return;
      }

      const features = map.queryRenderedFeatures(e.point, { layers: interactiveLayers });

      if (features.length > 0) {
        map.getCanvas().style.cursor = 'pointer';
        const feat = features[0];
        const code = (feat.properties?.district_code as string) ?? '';

        if (hoveredDistrictRef.current !== code) {
          hoveredDistrictRef.current = code;
          setHoveredDistrict(code);
          if (map.getLayer('districts-hover-outline')) {
            map.setFilter('districts-hover-outline', ['==', ['get', 'district_code'], code]);
          }
        }

        if (tooltipRef.current) {
          const currentLang = currentLanguageRef.current;
          const nameEn = (feat.properties?.nameEn as string) ?? (feat.properties?.district_name as string) ?? '';
          const nameBn = (feat.properties?.nameBn as string) ?? (feat.properties?.district_name_bn as string) ?? nameEn;
          const division = (feat.properties?.division as string) ?? '';
          const alerts = Number(feat.properties?.alertCount ?? 0);
          const news = Number(feat.properties?.newsCount ?? 0);

          tooltipRef.current.innerHTML = `
            <div class="flex items-center justify-between gap-3">
              <div>
                <span class="font-bold text-sm tracking-wide text-slate-100">${currentLang === 'bn' ? nameBn : nameEn}</span>
                ${nameBn && currentLang !== 'bn' ? `<span class="text-xs text-slate-400 font-bangla ml-1.5 font-normal">(${nameBn})</span>` : ''}
                ${nameEn && currentLang === 'bn' ? `<span class="text-xs text-slate-400 ml-1.5 font-normal">(${nameEn})</span>` : ''}
              </div>
              <span class="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">${division}</span>
            </div>
            <div class="text-xs text-slate-300 mt-1.5 flex items-center gap-2">
              <span class="${alerts > 0 ? 'text-red-400 font-bold' : 'text-slate-400'}">
                ${alerts} ${currentLang === 'bn' ? 'জরুরি সতর্কতা' : alerts === 1 ? 'alert' : 'alerts'}
              </span>
              <span class="text-slate-600">·</span>
              <span class="${news > 0 ? 'text-sky-300 font-medium' : 'text-slate-400'}">
                ${news} ${currentLang === 'bn' ? 'সংবাদ' : 'news'}
              </span>
            </div>
          `;
          tooltipRef.current.style.left = `${e.point.x + 16}px`;
          tooltipRef.current.style.top = `${e.point.y + 16}px`;
          tooltipRef.current.style.display = 'block';
        }
      } else {
        map.getCanvas().style.cursor = '';
        if (hoveredDistrictRef.current !== null) {
          hoveredDistrictRef.current = null;
          setHoveredDistrict(null);
          if (map.getLayer('districts-hover-outline')) {
            map.setFilter('districts-hover-outline', ['==', ['get', 'district_code'], '']);
          }
        }
        if (tooltipRef.current) {
          tooltipRef.current.style.display = 'none';
        }
      }
    });

    const canvas = map.getCanvas();
    const handleMouseLeave = () => {
      canvas.style.cursor = '';
      if (hoveredDistrictRef.current !== null) {
        hoveredDistrictRef.current = null;
        setHoveredDistrict(null);
        if (map.getLayer('districts-hover-outline')) {
          map.setFilter('districts-hover-outline', ['==', ['get', 'district_code'], '']);
        }
      }
      if (tooltipRef.current) {
        tooltipRef.current.style.display = 'none';
      }
    };
    canvas.addEventListener('mouseleave', handleMouseLeave);

    map.on('click', (e: MapLayerMouseEvent) => {
      const interactiveLayers = [
        'priority-beacons-circle',
        'priority-beacons-halo',
        'news-density-circles',
        'districts-fill',
      ].filter((id) => map.getLayer(id));

      if (interactiveLayers.length === 0) return;

      const features = map.queryRenderedFeatures(e.point, { layers: interactiveLayers });
      if (features.length > 0) {
        const feat = features[0];
        const code = feat.properties?.district_code as string;
        if (!code) return;

        // Route directly to the corresponding tab
        if (feat.layer.id.startsWith('priority-beacons')) {
          openDrawer(code, 'priority');
        } else if (feat.layer.id === 'news-density-circles') {
          openDrawer(code, 'news');
        } else {
          openDrawer(code, 'priority');
        }
      }
    });

    return () => {
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      delete (window as unknown as Record<string, unknown>).__aparajeyo_map;
    };
  }, []); // Empty dependency array: Map initializes once and never remounts

  // ── Fly to selected district with desktop camera padding offset ───────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (map.getLayer('districts-selected-outline')) {
      map.setFilter('districts-selected-outline', [
        '==',
        ['get', 'district_code'],
        selectedDistrictCode || '',
      ]);
    }

    if (!selectedDistrictCode || !enrichedGeoJsonRef.current) return;

    const feat = enrichedGeoJsonRef.current.features.find(
      (f) => f.properties?.district_code === selectedDistrictCode
    );
    if (feat) {
      const bounds = new LngLatBounds();
      if (feat.geometry.type === 'Polygon') {
        const coords = (feat.geometry as GeoJSON.Polygon).coordinates[0];
        if (coords) {
          coords.forEach((c) => bounds.extend(c as [number, number]));
        }
      } else if (feat.geometry.type === 'MultiPolygon') {
        const polys = (feat.geometry as GeoJSON.MultiPolygon).coordinates;
        for (const p of polys) {
          if (p[0]) {
            p[0].forEach((c) => bounds.extend(c as [number, number]));
          }
        }
      }

      if (!bounds.isEmpty()) {
        const center = bounds.getCenter();
        const containerWidth =
          containerRef.current?.clientWidth ||
          (typeof window !== 'undefined' ? window.innerWidth : 1000);
        const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
        const rightPad =
          isDesktop && isDrawerOpen
            ? Math.min(440, Math.floor(containerWidth * 0.4))
            : 40;

        map.flyTo({
          center,
          zoom: 8.8,
          duration: 1100,
          essential: true,
          padding: { top: 80, bottom: 40, left: 80, right: rightPad },
        });
      }
    }
  }, [selectedDistrictCode, isDrawerOpen]);

  // ── Sync Active Layers & Language Visibility ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const showPriority = activeLayers.has('priority');
    const showNews = activeLayers.has('news');
    const showCivic = activeLayers.has('civic');

    if (map.getLayer('districts-fill')) {
      map.setLayoutProperty('districts-fill', 'visibility', showPriority ? 'visible' : 'none');
    }
    if (map.getLayer('priority-beacons-halo')) {
      map.setLayoutProperty('priority-beacons-halo', 'visibility', showPriority ? 'visible' : 'none');
    }
    if (map.getLayer('priority-beacons-circle')) {
      map.setLayoutProperty('priority-beacons-circle', 'visibility', showPriority ? 'visible' : 'none');
    }
    if (map.getLayer('priority-beacons-count')) {
      map.setLayoutProperty('priority-beacons-count', 'visibility', showPriority ? 'visible' : 'none');
    }
    if (map.getLayer('news-density-circles')) {
      map.setLayoutProperty('news-density-circles', 'visibility', showNews ? 'visible' : 'none');
    }
    if (map.getLayer('civic-labels')) {
      map.setLayoutProperty('civic-labels', 'visibility', showCivic ? 'visible' : 'none');
      map.setLayoutProperty(
        'civic-labels',
        'text-field',
        ['get', language === 'bn' ? 'district_name_bn' : 'district_name']
      );
    }
  }, [activeLayers, language]);

  // ── Native transformStyle on map.setStyle() ──────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Guard against redundant call on initial mount
    if (theme === lastAppliedThemeRef.current) return;
    lastAppliedThemeRef.current = theme;

    const nextTheme = theme;
    map.setStyle(STYLE_URLS[nextTheme], {
      diff: false,
      transformStyle: (_previousStyle, nextStyle): StyleSpecification => {
        try {
          return {
            ...nextStyle,
            sources: {
              ...nextStyle.sources,
              'bangladesh-districts': {
                type: 'geojson',
                data: enrichedGeoJsonRef.current || EMPTY_GEOJSON,
                promoteId: 'district_code',
              },
              'district-centroids': {
                type: 'geojson',
                data: districtCentroidsGeoJsonRef.current || EMPTY_GEOJSON,
                promoteId: 'district_code',
              },
            },
            layers: [
              ...nextStyle.layers,
              ...buildDistrictLayers(
                nextTheme,
                hoveredDistrictRef.current,
                selectedDistrictRef.current,
                activeLayersRef.current,
                currentLanguageRef.current
              ),
            ],
          } as StyleSpecification;
        } catch (err) {
          console.error('[Aparajeyo transformStyle error]', err);
          return nextStyle;
        }
      },
    });

    // After style has loaded, guarantee state synchronization
    map.once('style.load', () => {
      const showPriority = activeLayersRef.current.has('priority');
      const showNews = activeLayersRef.current.has('news');
      const showCivic = activeLayersRef.current.has('civic');

      if (map.getLayer('districts-fill')) {
        map.setLayoutProperty('districts-fill', 'visibility', showPriority ? 'visible' : 'none');
      }
      if (map.getLayer('priority-beacons-halo')) {
        map.setLayoutProperty('priority-beacons-halo', 'visibility', showPriority ? 'visible' : 'none');
      }
      if (map.getLayer('priority-beacons-circle')) {
        map.setLayoutProperty('priority-beacons-circle', 'visibility', showPriority ? 'visible' : 'none');
      }
      if (map.getLayer('priority-beacons-count')) {
        map.setLayoutProperty('priority-beacons-count', 'visibility', showPriority ? 'visible' : 'none');
      }
      if (map.getLayer('news-density-circles')) {
        map.setLayoutProperty('news-density-circles', 'visibility', showNews ? 'visible' : 'none');
      }
      if (map.getLayer('civic-labels')) {
        map.setLayoutProperty('civic-labels', 'visibility', showCivic ? 'visible' : 'none');
      }
      if (map.getLayer('districts-selected-outline')) {
        map.setFilter('districts-selected-outline', [
          '==',
          ['get', 'district_code'],
          selectedDistrictRef.current || '',
        ]);
      }
      if (map.getLayer('districts-hover-outline')) {
        map.setFilter('districts-hover-outline', [
          '==',
          ['get', 'district_code'],
          hoveredDistrictRef.current || '',
        ]);
      }
    });
  }, [theme]);

  // ── Sync HTML class & data-theme ─────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <div ref={containerRef} className="fixed inset-0 w-full h-full" />
      {/* Floating Tactical Tooltip */}
      <div
        ref={tooltipRef}
        className="pointer-events-none fixed z-[9999] hidden rounded-xl border border-slate-700/80 bg-slate-950/90 px-3.5 py-2.5 shadow-2xl backdrop-blur-xl"
        style={{ minWidth: 160, maxWidth: 280 }}
      />
    </>
  );
}
