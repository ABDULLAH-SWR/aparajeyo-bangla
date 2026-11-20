'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useMapStore } from '@/store/useMapStore';
import { cn } from '@/lib/utils';

export default function MapLegend() {
  const [collapsed, setCollapsed] = useState(false);
  const theme = useMapStore((s) => s.theme);
  const language = useMapStore((s) => s.language);
  const isDark = theme === 'dark';

  const legendItems = [
    {
      labelEn: 'Critical',
      labelBn: 'জরুরি / সংকটাপন্ন',
      color: isDark ? 'bg-red-500/80 border-red-400' : 'bg-red-500 border-red-600',
    },
    {
      labelEn: 'High',
      labelBn: 'উচ্চ সতর্কতা',
      color: isDark ? 'bg-amber-500/80 border-amber-400' : 'bg-amber-500 border-amber-600',
    },
    {
      labelEn: 'Advisory',
      labelBn: 'পরামর্শমূলক',
      color: isDark ? 'bg-sky-400/80 border-sky-300' : 'bg-sky-500 border-sky-600',
    },
    {
      labelEn: 'Normal',
      labelBn: 'স্বাভাবিক',
      color: isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-200 border-slate-300',
    },
  ];

  return (
    <div
      className={cn(
        'fixed bottom-5 left-20 z-40 rounded-xl transition-all duration-200 select-none shadow-xl border',
        isDark
          ? 'bg-slate-950/85 backdrop-blur-md border-slate-800 text-slate-100'
          : 'bg-white/92 backdrop-blur-md border-slate-200 text-slate-900'
      )}
    >
      {/* Header / Collapse Toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className={cn(
          'flex w-full items-center justify-between gap-3 px-3.5 py-2 text-xs font-semibold tracking-wide cursor-pointer',
          isDark ? 'text-slate-200 hover:text-white' : 'text-slate-700 hover:text-slate-950'
        )}
      >
        <span>{language === 'bn' ? 'সতর্কতার মাত্রা' : 'Severity Legend'}</span>
        {collapsed ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>

      {/* Legend Items */}
      {!collapsed && (
        <div className="flex flex-col gap-2 px-3.5 pb-3 pt-0.5 border-t border-slate-100 dark:border-slate-800/60">
          {legendItems.map((item) => (
            <div key={item.labelEn} className="flex items-center gap-2.5">
              <span
                className={cn(
                  'inline-block h-3 w-3 rounded-full border shadow-sm shrink-0',
                  item.color
                )}
              />
              <span className={cn('text-[11px] font-medium leading-none', isDark ? 'text-slate-300' : 'text-slate-600')}>
                {language === 'bn' ? item.labelBn : item.labelEn}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
