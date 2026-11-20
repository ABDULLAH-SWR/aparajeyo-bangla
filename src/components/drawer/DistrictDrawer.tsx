'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, AlertTriangle, Newspaper, Info } from 'lucide-react';
import { useMapStore } from '@/store/useMapStore';
import { getDistrictDetails } from '@/services/dataService';
import { cn } from '@/lib/utils';
import type { DistrictDetail, SeverityLevel } from '@/types';
import { PriorityTab } from './PriorityTab';
import { NewsAggregatorTab } from './NewsAggregatorTab';
import { CivicInfoTab } from './CivicInfoTab';

type DrawerTab = 'priority' | 'news' | 'info';

const TAB_CONFIG: Record<DrawerTab, { en: string; bn: string; icon: React.ElementType }> = {
  priority: { en: 'Alerts', bn: 'জরুরি সতর্কতা', icon: AlertTriangle },
  news: { en: 'News Feed', bn: 'সংবাদ ফিড', icon: Newspaper },
  info: { en: 'Civic Info', bn: 'নাগরিক তথ্য', icon: Info },
};

const SEVERITY_BADGE: Record<SeverityLevel, string> = {
  Critical: 'severity-critical',
  High: 'severity-high',
  Advisory: 'severity-advisory',
};

export function DistrictDrawer() {
  const selectedDistrictCode = useMapStore((s) => s.selectedDistrictCode);
  const isDrawerOpen = useMapStore((s) => s.isDrawerOpen);
  const closeDrawer = useMapStore((s) => s.closeDrawer);
  const language = useMapStore((s) => s.language);
  const theme = useMapStore((s) => s.theme);
  const isDark = theme === 'dark';
  const activeTab = useMapStore((s) => s.drawerActiveTab);
  const setActiveTab = useMapStore((s) => s.setDrawerActiveTab);

  const [detail, setDetail] = useState<DistrictDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedDistrictCode) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getDistrictDetails(selectedDistrictCode).then((data) => {
      if (!cancelled) {
        setDetail(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDistrictCode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawerOpen) closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDrawerOpen, closeDrawer]);

  const handleOverlayClick = useCallback(() => closeDrawer(), [closeDrawer]);

  const districtName =
    detail && language === 'bn'
      ? detail.district.nameBn
      : detail?.district.nameEn ?? '';

  const divisionName =
    detail && language === 'bn'
      ? detail.district.divisionBn
      : detail?.district.division ?? '';

  const highestSeverity: SeverityLevel | null = detail
    ? detail.priorities
        .filter((p) => p.isActive)
        .reduce<SeverityLevel | null>((acc, p) => {
          const order: Record<SeverityLevel, number> = { Critical: 3, High: 2, Advisory: 1 };
          if (!acc || order[p.severity] > order[acc]) return p.severity;
          return acc;
        }, null)
    : null;

  const tabs: DrawerTab[] = ['priority', 'news', 'info'];

  return (
    <>
      {/* Dimmed Overlay Backdrop — Mobile ONLY (md:hidden keeps desktop map crisp, unblurred and directly clickable) */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] transition-opacity duration-300 md:hidden',
          isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      {/* Slide-over Drawer (Desktop right panel, Mobile bottom sheet) */}
      <aside
        className={cn(
          'fixed z-50 flex flex-col transition-transform duration-300 ease-in-out',
          isDark
            ? 'bg-slate-950/95 backdrop-blur-xl border-slate-800 text-slate-100 shadow-2xl'
            : 'bg-white/98 backdrop-blur-xl border-slate-200 text-slate-900 shadow-2xl',
          // Desktop positioning
          'md:top-0 md:right-0 md:h-full md:w-[420px] md:border-l',
          isDrawerOpen ? 'md:translate-x-0' : 'md:translate-x-full',
          // Mobile bottom sheet
          'max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:h-[75vh] max-md:w-full max-md:rounded-t-3xl max-md:border-t',
          isDrawerOpen ? 'max-md:translate-y-0' : 'max-md:translate-y-full'
        )}
      >
        {/* District Drawer Header */}
        <div className="flex items-start justify-between gap-3 border-b p-5 border-slate-200 dark:border-slate-800/80">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight truncate text-slate-900 dark:text-slate-100">
                {loading ? (language === 'bn' ? 'লোড হচ্ছে…' : 'Loading…') : districtName}
              </h2>
              {highestSeverity && (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide',
                    SEVERITY_BADGE[highestSeverity]
                  )}
                >
                  {highestSeverity}
                </span>
              )}
            </div>
            {divisionName && (
              <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                {divisionName} {language === 'bn' ? 'বিভাগ' : 'Division'} · Bangladesh
              </p>
            )}
          </div>

          <button
            onClick={closeDrawer}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer shrink-0',
              isDark
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            )}
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* 3-Column Segmented Tab Bar */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800/80">
          <div className={cn(
            'grid grid-cols-3 gap-1 p-1 rounded-xl',
            isDark ? 'bg-slate-900 border border-slate-800/80' : 'bg-slate-100 border border-slate-200/80'
          )}>
            {tabs.map((tab) => {
              const item = TAB_CONFIG[tab];
              const Icon = item.icon;
              const isActive = activeTab === tab;
              const label = language === 'bn' ? item.bn : item.en;

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none truncate',
                    isActive
                      ? isDark
                        ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700/80'
                        : 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                      : isDark
                        ? 'text-slate-400 hover:text-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <Icon size={14} className="shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Tab Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500 dark:border-slate-700 dark:border-t-sky-400" />
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {language === 'bn' ? 'তথ্য লোড হচ্ছে…' : 'Loading district intelligence…'}
              </p>
            </div>
          )}

          {!loading && detail && activeTab === 'priority' && (
            <PriorityTab priorities={detail.priorities} language={language} />
          )}

          {!loading && detail && activeTab === 'news' && (
            <NewsAggregatorTab news={detail.news} language={language} />
          )}

          {!loading && detail && activeTab === 'info' && (
            <CivicInfoTab civic={detail.civic} language={language} />
          )}
        </div>
      </aside>
    </>
  );
}
