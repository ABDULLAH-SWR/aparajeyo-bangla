'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, Globe, ChevronRight, X, Home } from 'lucide-react';
import { useMapStore } from '@/store/useMapStore';
import { searchDistrictsAndNews } from '@/services/dataService';
import type { DistrictSummary, NewsCluster } from '@/types';
import { cn } from '@/lib/utils';

export default function TopSearchBar() {
  const searchQuery = useMapStore((s) => s.searchQuery);
  const setSearchQuery = useMapStore((s) => s.setSearchQuery);
  const language = useMapStore((s) => s.language);
  const toggleLanguage = useMapStore((s) => s.toggleLanguage);
  const openDrawer = useMapStore((s) => s.openDrawer);
  const theme = useMapStore((s) => s.theme);
  const isDark = theme === 'dark';

  const [isFocused, setIsFocused] = useState(false);
  const [results, setResults] = useState<{
    districts: DistrictSummary[];
    news: NewsCluster[];
  }>({ districts: [], news: [] });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  const handleInputChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        if (!value.trim()) {
          setResults({ districts: [], news: [] });
          return;
        }
        const res = await searchDistrictsAndNews(value);
        setResults(res);
      }, 250);
    },
    [setSearchQuery]
  );

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasResults = results.districts.length > 0 || results.news.length > 0;
  const showDropdown = isFocused && searchQuery.trim().length > 0 && hasResults;

  return (
    <div
      ref={containerRef}
      className="fixed top-4 left-4 z-40 flex items-center gap-2.5"
    >
      {/* Standalone Home Logo Button */}
      <Link
        href="/home"
        title="Aparajeyo Bangla — Home"
        aria-label="Aparajeyo Bangla — Home"
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 cursor-pointer shrink-0',
          isDark
            ? 'bg-slate-950/85 backdrop-blur-md border border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800 hover:border-emerald-500/50 shadow-2xl'
            : 'bg-white/92 backdrop-blur-md border border-slate-200 text-slate-700 hover:text-slate-950 hover:bg-slate-100 hover:border-emerald-600/40 shadow-lg'
        )}
      >
        <Home size={18} className="stroke-[2.2]" />
      </Link>

      {/* Search box with Instant Autocomplete & Clear Button */}
      <div className="relative">
        <div
          className={cn(
            'flex h-11 items-center gap-2 px-3.5 rounded-xl w-[200px] sm:w-[260px] md:w-[300px] transition-all duration-200',
            isDark
              ? 'bg-slate-950/85 backdrop-blur-md border border-slate-800 shadow-2xl text-slate-100'
              : 'bg-white/92 backdrop-blur-md border border-slate-200 shadow-lg text-slate-900',
            isFocused && (isDark ? 'ring-1 ring-sky-400 border-sky-500/60' : 'ring-1 ring-sky-500 border-sky-500')
          )}
        >
          <Search size={16} className={isDark ? 'text-slate-400 shrink-0' : 'text-slate-500 shrink-0'} />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setIsFocused(true)}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsFocused(false);
              }
            }}
            placeholder={language === 'bn' ? 'জেলা বা সংবাদ খুঁজুন…' : 'Search districts or news…'}
            className={cn(
              'flex-1 min-w-0 bg-transparent text-sm outline-none',
              isDark
                ? 'text-slate-100 placeholder:text-slate-500'
                : 'text-slate-900 placeholder:text-slate-400'
            )}
          />
          {searchQuery.length > 0 && (
            <button
              onClick={() => {
                setSearchQuery('');
                setResults({ districts: [], news: [] });
              }}
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full transition-colors cursor-pointer shrink-0',
                isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-slate-400 hover:text-slate-900 hover:bg-slate-200'
              )}
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Autocomplete Dropdown */}
        {showDropdown && (
          <div
            className={cn(
              'absolute top-full left-0 right-0 mt-2 rounded-xl border shadow-2xl max-h-80 overflow-y-auto custom-scrollbar z-50 divide-y',
              isDark
                ? 'bg-slate-950/95 backdrop-blur-xl border-slate-800 divide-slate-800/60 text-slate-100'
                : 'bg-white/98 backdrop-blur-xl border-slate-200 divide-slate-100 text-slate-900'
            )}
          >
            {/* Matched Districts */}
            {results.districts.length > 0 && (
              <div className="p-2">
                <p className={cn(
                  'text-[10px] font-semibold uppercase px-2 py-1 tracking-wider',
                  isDark ? 'text-slate-400' : 'text-slate-600'
                )}>
                  {language === 'bn' ? 'জেলাসমূহ' : 'Districts'}
                </p>
                {results.districts.slice(0, 5).map((d) => (
                  <button
                    key={d.districtCode}
                    onClick={() => {
                      openDrawer(d.districtCode);
                      setIsFocused(false);
                    }}
                    className={cn(
                      'w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group cursor-pointer',
                      isDark
                        ? 'hover:bg-slate-800/80 text-slate-100'
                        : 'hover:bg-slate-100 text-slate-900'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {language === 'bn' ? d.nameBn : d.nameEn}
                      </span>
                      {d.activePriorityCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold severity-critical">
                          {d.activePriorityCount}
                        </span>
                      )}
                    </div>
                    <span className={cn('text-xs flex items-center gap-1 font-medium', isDark ? 'text-slate-400' : 'text-slate-600')}>
                      {d.division}
                      <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Matched News Headlines */}
            {results.news.length > 0 && (
              <div className="p-2">
                <p className={cn(
                  'text-[10px] font-semibold uppercase px-2 py-1 tracking-wider',
                  isDark ? 'text-slate-400' : 'text-slate-600'
                )}>
                  {language === 'bn' ? 'সংবাদ' : 'News'}
                </p>
                {results.news.slice(0, 5).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      openDrawer(n.districtCode, 'news');
                      setIsFocused(false);
                    }}
                    className={cn(
                      'w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors cursor-pointer',
                      isDark
                        ? 'hover:bg-slate-800/80 text-slate-100'
                        : 'hover:bg-slate-100 text-slate-900'
                    )}
                  >
                    <span className="line-clamp-1 font-medium text-slate-900 dark:text-slate-100">
                      {language === 'bn' ? n.headlineBn : n.headline}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Language Toggle Pill */}
      <button
        onClick={toggleLanguage}
        className={cn(
          'flex h-11 items-center gap-1.5 px-3 rounded-xl transition-all duration-200 cursor-pointer font-medium text-xs',
          isDark
            ? 'bg-slate-950/85 backdrop-blur-md border border-slate-800 text-slate-200 hover:bg-slate-800/80 shadow-2xl'
            : 'bg-white/92 backdrop-blur-md border border-slate-200 text-slate-800 hover:bg-slate-50 shadow-lg'
        )}
        title="Switch Language / ভাষা পরিবর্তন"
      >
        <Globe size={14} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
        <span>{language === 'en' ? 'বাংলা' : 'EN'}</span>
      </button>
    </div>
  );
}
