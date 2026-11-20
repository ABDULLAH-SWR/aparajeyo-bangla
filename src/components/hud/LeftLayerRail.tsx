'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Newspaper,
  Building2,
  CloudRain,
  MessageSquare,
  Lock,
} from 'lucide-react';
import { useMapStore } from '@/store/useMapStore';
import type { MapLayerType } from '@/types';
import { cn } from '@/lib/utils';

interface LayerItem {
  id: MapLayerType;
  labelEn: string;
  labelBn: string;
  icon: React.ElementType;
  comingSoon: boolean;
}

const LAYERS: LayerItem[] = [
  { id: 'priority', labelEn: 'Priority Issues', labelBn: 'জরুরি সমস্যা', icon: AlertTriangle, comingSoon: false },
  { id: 'news', labelEn: 'News Density', labelBn: 'সংবাদ ঘনত্ব', icon: Newspaper, comingSoon: false },
  { id: 'civic', labelEn: 'Civic Info', labelBn: 'নাগরিক তথ্য', icon: Building2, comingSoon: false },
  { id: 'flood', labelEn: 'Flood / Weather', labelBn: 'বন্যা ও আবহাওয়া', icon: CloudRain, comingSoon: true },
  { id: 'citizen', labelEn: 'Citizen Reports', labelBn: 'নাগরিক রিপোর্ট', icon: MessageSquare, comingSoon: true },
];

export default function LeftLayerRail() {
  const activeLayers = useMapStore((s) => s.activeLayers);
  const toggleLayer = useMapStore((s) => s.toggleLayer);
  const language = useMapStore((s) => s.language);
  const theme = useMapStore((s) => s.theme);
  const isDark = theme === 'dark';

  const [hoveredId, setHoveredId] = useState<MapLayerType | null>(null);

  return (
    <div
      className={cn(
        'fixed left-4 top-1/2 -translate-y-1/2 z-40',
        'flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-colors duration-200',
        isDark
          ? 'bg-slate-950/85 backdrop-blur-md border border-slate-800 text-slate-100 shadow-2xl'
          : 'bg-white/92 backdrop-blur-md border border-slate-200 text-slate-900 shadow-lg'
      )}
    >
      {LAYERS.map((layer) => {
        const Icon = layer.icon;
        const isActive = activeLayers.has(layer.id);
        const label = language === 'bn' ? layer.labelBn : layer.labelEn;
        const tooltipLabel = layer.comingSoon
          ? `${label} (${language === 'bn' ? 'শীঘ্রই আসছে' : 'Coming Soon'})`
          : label;

        return (
          <div
            key={layer.id}
            className="relative group"
            onMouseEnter={() => setHoveredId(layer.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* Layer Icon Button */}
            <button
              disabled={layer.comingSoon}
              onClick={() => toggleLayer(layer.id)}
              className={cn(
                'relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 cursor-pointer',
                layer.comingSoon
                  ? 'opacity-35 cursor-not-allowed'
                  : isDark
                    ? 'hover:bg-slate-800/80 active:scale-95'
                    : 'hover:bg-slate-100 active:scale-95',
                isActive && !layer.comingSoon && (
                  isDark
                    ? 'bg-sky-500/20 text-sky-400 ring-1 ring-sky-400/50'
                    : 'bg-sky-50 text-sky-600 ring-1 ring-sky-500/40'
                )
              )}
              aria-label={label}
            >
              <Icon
                size={19}
                className={cn(
                  'transition-colors',
                  layer.comingSoon
                    ? isDark ? 'text-slate-600' : 'text-slate-400'
                    : isActive
                      ? isDark ? 'text-sky-300' : 'text-sky-600'
                      : isDark ? 'text-slate-300' : 'text-slate-600'
                )}
              />
              {layer.comingSoon && (
                <Lock
                  size={10}
                  className={cn(
                    'absolute bottom-1 right-1',
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  )}
                />
              )}
            </button>

            {/* Floating Tooltip */}
            {hoveredId === layer.id && (
              <div
                className={cn(
                  'absolute left-full top-1/2 -translate-y-1/2 ml-3.5',
                  'flex items-center gap-2 whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide z-50 pointer-events-none select-none shadow-xl border',
                  isDark
                    ? 'bg-slate-900/95 text-slate-100 border-slate-700/80'
                    : 'bg-white/98 text-slate-900 border-slate-200'
                )}
              >
                <span>{label}</span>
                {layer.comingSoon ? (
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider',
                      isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {language === 'bn' ? 'শীঘ্রই আসছে' : 'Coming Soon'}
                  </span>
                ) : isActive ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    {language === 'bn' ? 'সক্রিয়' : 'Active'}
                  </span>
                ) : (
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider',
                      isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {language === 'bn' ? 'বন্ধ' : 'Off'}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
