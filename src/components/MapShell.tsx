'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useMapStore } from '@/store/useMapStore';
import { cn } from '@/lib/utils';

// Dynamically import client components to avoid SSR issues with MapLibre GL
const BangladeshMap = dynamic(
  () => import('@/components/map/BangladeshMap'),
  { ssr: false }
);

const MapControls = dynamic(
  () => import('@/components/map/MapControls'),
  { ssr: false }
);

const MapLegend = dynamic(
  () => import('@/components/map/MapLegend'),
  { ssr: false }
);

const LeftLayerRail = dynamic(
  () => import('@/components/hud/LeftLayerRail'),
  { ssr: false }
);

const TopSearchBar = dynamic(
  () => import('@/components/hud/TopSearchBar'),
  { ssr: false }
);

const PriorityTicker = dynamic(
  () => import('@/components/hud/PriorityTicker'),
  { ssr: false }
);

const DistrictDrawer = dynamic(
  () => import('@/components/drawer/DistrictDrawer').then((m) => m.DistrictDrawer),
  { ssr: false }
);

export default function MapShell() {
  const theme = useMapStore((s) => s.theme);
  const closeDrawer = useMapStore((s) => s.closeDrawer);
  const openDrawer = useMapStore((s) => s.openDrawer);
  const setSearchQuery = useMapStore((s) => s.setSearchQuery);
  const isDark = theme === 'dark';

  // Synchronize document root with active theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Deep-linking: auto-open district drawer if arrived via /?district=<code>
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const districtParam = params.get('district');
    if (districtParam) {
      openDrawer(districtParam.toLowerCase(), 'priority');
    }
  }, [openDrawer]);

  // Global Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDrawer();
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeDrawer, setSearchQuery]);

  return (
    <div
      data-theme={theme}
      className={cn(
        'fixed inset-0 w-screen h-screen overflow-hidden select-none',
        isDark ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      )}
    >
      {/* Full-screen Map Canvas */}
      <BangladeshMap />

      {/* Floating HUD Overlays */}
      <LeftLayerRail />
      <TopSearchBar />
      <PriorityTicker />

      {/* Map Interactive Controls */}
      <MapControls />
      <MapLegend />

      {/* District Intelligence Slide-over Drawer */}
      <DistrictDrawer />
    </div>
  );
}
