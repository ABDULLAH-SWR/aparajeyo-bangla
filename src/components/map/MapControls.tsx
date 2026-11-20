'use client';

import { ZoomIn, ZoomOut, Maximize2, Sun, Moon } from 'lucide-react';
import { useMapStore } from '@/store/useMapStore';
import { cn } from '@/lib/utils';

const BANGLADESH_CENTER: [number, number] = [90.356, 23.685];
const DEFAULT_ZOOM = 6.8;

export default function MapControls() {
  const theme = useMapStore((s) => s.theme);
  const toggleTheme = useMapStore((s) => s.toggleTheme);
  const isDrawerOpen = useMapStore((s) => s.isDrawerOpen);
  const isDark = theme === 'dark';

  const handleZoomIn = () => {
    const map = (window as unknown as Record<string, unknown>).__aparajeyo_map as
      | { zoomIn: (opts: { duration: number }) => void }
      | undefined;
    map?.zoomIn({ duration: 300 });
  };

  const handleZoomOut = () => {
    const map = (window as unknown as Record<string, unknown>).__aparajeyo_map as
      | { zoomOut: (opts: { duration: number }) => void }
      | undefined;
    map?.zoomOut({ duration: 300 });
  };

  const handleReset = () => {
    const map = (window as unknown as Record<string, unknown>).__aparajeyo_map as
      | { flyTo: (opts: { center: [number, number]; zoom: number; duration: number }) => void }
      | undefined;
    map?.flyTo({ center: BANGLADESH_CENTER, zoom: DEFAULT_ZOOM, duration: 1000 });
  };

  return (
    <div
      className={cn(
        'fixed bottom-5 z-40 flex flex-col gap-1.5 p-1.5 rounded-2xl transition-all duration-300',
        isDrawerOpen ? 'right-4 md:right-[436px]' : 'right-4',
        isDark
          ? 'bg-slate-950/85 backdrop-blur-md border border-slate-800 text-slate-100 shadow-2xl'
          : 'bg-white/92 backdrop-blur-md border border-slate-200 text-slate-900 shadow-lg'
      )}
    >
      <button
        onClick={handleZoomIn}
        aria-label="Zoom in"
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-95 cursor-pointer',
          isDark
            ? 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        )}
      >
        <ZoomIn size={18} />
      </button>

      <button
        onClick={handleZoomOut}
        aria-label="Zoom out"
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-95 cursor-pointer',
          isDark
            ? 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        )}
      >
        <ZoomOut size={18} />
      </button>

      <button
        onClick={handleReset}
        aria-label="Reset country view"
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-95 cursor-pointer',
          isDark
            ? 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        )}
      >
        <Maximize2 size={17} />
      </button>

      <div className={cn('my-0.5 h-px', isDark ? 'bg-slate-800' : 'bg-slate-200')} />

      <button
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-95 cursor-pointer',
          isDark
            ? 'text-amber-400 hover:bg-slate-800/80'
            : 'text-slate-700 hover:bg-slate-100'
        )}
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>
  );
}
