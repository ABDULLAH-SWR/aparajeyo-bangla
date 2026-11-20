# Aparajeyo Bangla — অপরাজেয় বাংলা

> Interactive civic intelligence, news aggregation, and priority-issue broadcasting map for Bangladesh.  
> **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · MapLibre GL JS v6 · Zustand · Motion

## Sector Progress Matrix

| Sector / Module | Status | Key Files & Summary |
|---|---|---|
| **Interactive Map (`/`)** | ✅ v1.0 Done | `BangladeshMap.tsx`, `bangladesh-districts.geojson` — 64 authentic districts (0.77MB), native `transformStyle` with `EMPTY_GEOJSON` fallback, centroid engine, priority beacons, news density circles, deep linking (`/?district=<code>`). |
| **Editorial Homepage (`/home`)** | ✅ v1.0 Done | `src/app/home/page.tsx`, `components/home/*` — Full-bleed video hero with instant autoplay, halftone mesh, oversized `AparajeyoPinLogo`, clean left-aligned lockup, single-arrow CTA, fixed glass navbar (`h-16`), scroll-progress bar, and 8-division explorer. |
| **CSS & Design System** | ✅ v1.0 Done | `globals.css` — Bengal Editorial tokens (`--brand-emerald`, `--brand-crimson`, `--surface-paper`, `--surface-dark`), Tailwind v4 `@custom-variant dark`, unblocked scrolling (`scroll-behavior: smooth`, `overflow-x: clip`), and zero white-on-white contrast issues. |
| **Tactical HUD & Navigation** | ✅ v1.0 Done | `TopSearchBar.tsx`, `PriorityTicker.tsx`, `LeftLayerRail.tsx` — Minimalist PetaBencana-style Home logo button (`h-11 w-11`), search with `×` clear, debounced autocomplete, `EN / বাং` toggle, and rotating priority ticker modal. |
| **District Intelligence Drawer** | ✅ v1.0 Done | `DistrictDrawer.tsx`, `PriorityTab.tsx`, `NewsAggregatorTab.tsx`, `CivicInfoTab.tsx` — Non-blocking desktop drawer (`md:hidden` scrim), high-contrast empty and active states, category count pills, outlet filter dropdown, and source badges. |
| **Data Service Abstraction** | 🟡 Mocked | `services/dataService.ts`, `data/mockData.ts` — Async service layer covering all 64 districts with BBS geocodes, priority issues, news clusters, and division overviews. Ready for real API swap. |
| **Map Controls & Legend** | ✅ v1.0 Done | `MapControls.tsx`, `MapLegend.tsx` — Smooth desktop drawer evasion (`md:right-[436px]`), glassmorphic zoom, country reset view, 1-click theme switch, collapsible bilingual severity legend at `bottom-5 left-20 z-40`. |
| **Backend / Live Ingestion** | ⬜ Planned | No backend yet — dataService abstraction designed for seamless API swap. |

## Quick Start

```bash
cd Aparajeyo_Bangla
bun install
bun run dev        # → http://localhost:3000 (auto-runs copy-maplibre-worker)
bun run build      # production build (zero TS errors verified)
```

## Architecture

```
scripts/           copy-maplibre-worker.mjs, build-authentic-geojson.mjs
src/
├── app/           layout.tsx, page.tsx (/ live map), home/page.tsx (/home portal), globals.css
├── components/
│   ├── home/      AparajeyoPinLogo, HeroSection, HomeNavbar, MissionSection, StatsStrip, DivisionExplorer, FeaturesGrid, RoadmapSection, HomeFooter
│   ├── map/       BangladeshMap, MapControls, MapLegend
│   ├── hud/       LeftLayerRail, TopSearchBar, PriorityTicker
│   ├── drawer/    DistrictDrawer, PriorityTab, NewsAggregatorTab, CivicInfoTab
│   └── MapShell.tsx  (dynamic imports, ssr:false, theme context, deep-linking)
├── data/          mockData.ts (all 64 districts, issues, news, civic)
├── services/      dataService.ts (async API abstraction)
├── store/         useMapStore.ts (Zustand)
└── types/         index.ts (District, PriorityIssue, NewsCluster, DivisionOverview, etc.)
public/
├── data/          bangladesh-districts.geojson (64 authentic districts)
├── maplibre/      maplibre-gl-worker.mjs, maplibre-gl-shared.mjs
└── media/         hero-bangladesh.mp4, README.txt
```

## Next Milestones (Phase 2)

- **Backend API swap:** Replace mock data with live REST/GraphQL endpoints in `dataService.ts`.
- **Live RSS ingestion & WebSockets:** Real-time priority push notifications and multi-source clustering.
- **Layer expansions:** Flood and meteorological alerts (BMD API), citizen report telemetry.
