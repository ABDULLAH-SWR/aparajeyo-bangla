'use client';

import { useState, useMemo } from 'react';
import { ExternalLink, Clock, Newspaper, Filter } from 'lucide-react';
import { useMapStore } from '@/store/useMapStore';
import { cn } from '@/lib/utils';
import type { NewsCluster, Language, NewsCategory } from '@/types';

interface NewsAggregatorTabProps {
  news: NewsCluster[];
  language: Language;
}

const CATEGORIES: { value: NewsCategory; en: string; bn: string }[] = [
  { value: 'All', en: 'All', bn: 'সব' },
  { value: 'Disaster', en: 'Disaster', bn: 'দুর্যোগ' },
  { value: 'Infrastructure', en: 'Infrastructure', bn: 'অবকাঠামো' },
  { value: 'Politics', en: 'Politics', bn: 'রাজনীতি' },
  { value: 'Economy', en: 'Economy', bn: 'অর্থনীতি' },
  { value: 'Crime', en: 'Crime', bn: 'অপরাধ' },
  { value: 'Local', en: 'Local', bn: 'স্থানীয়' },
];

function formatRelativeTime(timestamp: string, lang: 'en' | 'bn'): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return lang === 'bn' ? 'এইমাত্র' : 'Just now';
  if (mins < 60) return lang === 'bn' ? `${mins} মি. আগে` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return lang === 'bn' ? `${hours} ঘণ্টা আগে` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return lang === 'bn' ? `${days} দিন আগে` : `${days}d ago`;
}

export function NewsAggregatorTab({ news, language }: NewsAggregatorTabProps) {
  const activeCategory = useMapStore((s) => s.activeNewsCategory);
  const setActiveCategory = useMapStore((s) => s.setActiveNewsCategory);
  const theme = useMapStore((s) => s.theme);
  const isDark = theme === 'dark';

  const [selectedOutlet, setSelectedOutlet] = useState<string>('All');

  // Compute category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: news.length };
    for (const item of news) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [news]);

  // Extract unique outlets from news data
  const availableOutlets = useMemo(() => {
    const map = new Map<string, { name: string; nameBn: string; color: string }>();
    for (const cluster of news) {
      for (const outlet of cluster.outlets) {
        if (!map.has(outlet.name)) {
          map.set(outlet.name, {
            name: outlet.name,
            nameBn: outlet.nameBn,
            color: outlet.logoColor,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [news]);

  // Combined filtering: category + outlet
  const filtered = useMemo(() => {
    return news.filter((cluster) => {
      const matchesCategory =
        activeCategory === 'All' || cluster.category === activeCategory;
      const matchesOutlet =
        selectedOutlet === 'All' ||
        cluster.outlets.some((o) => o.name === selectedOutlet);
      return matchesCategory && matchesOutlet;
    });
  }, [news, activeCategory, selectedOutlet]);

  return (
    <div className="space-y-4 pb-4">
      {/* Category Filter Pills with Active Counts */}
      <div className="flex flex-wrap gap-1.5 pb-1">
        {CATEGORIES.map((cat) => {
          const isSelected = activeCategory === cat.value;
          const count = categoryCounts[cat.value] || 0;
          return (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer select-none flex items-center gap-1.5',
                isSelected
                  ? isDark
                    ? 'bg-sky-500 text-white shadow-sm ring-1 ring-sky-400/50'
                    : 'bg-sky-600 text-white shadow-sm ring-1 ring-sky-500/50'
                  : isDark
                    ? 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                    : 'bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              <span>{language === 'bn' ? cat.bn : cat.en}</span>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                  isSelected
                    ? 'bg-white/20 text-white'
                    : isDark
                      ? 'bg-slate-800 text-slate-400'
                      : 'bg-slate-100 text-slate-500'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Outlet Filter Bar */}
      {availableOutlets.length > 1 && (
        <div className="flex items-center gap-2 pt-0.5 pb-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 shrink-0">
            <Filter size={12} />
            <span className="font-medium text-[11px] uppercase tracking-wider">
              {language === 'bn' ? 'গণমাধ্যম ফিল্টার:' : 'Filter Outlet:'}
            </span>
          </div>

          <select
            value={selectedOutlet}
            onChange={(e) => setSelectedOutlet(e.target.value)}
            className={cn(
              'text-xs rounded-lg px-2.5 py-1 font-medium border outline-none cursor-pointer transition-colors',
              isDark
                ? 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700'
                : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
            )}
          >
            <option value="All">
              {language === 'bn' ? 'সকল গণমাধ্যম (All Outlets)' : 'All Outlets'}
            </option>
            {availableOutlets.map((outlet) => (
              <option key={outlet.name} value={outlet.name}>
                {language === 'bn' ? outlet.nameBn : outlet.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Clustered News Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400">
            <Newspaper className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {language === 'bn' ? 'কোনো সংবাদ পাওয়া যায়নি' : 'No News in this View'}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-[240px]">
              {language === 'bn'
                ? 'নির্বাচিত ক্যাটাগরি বা গণমাধ্যমের সাথে মিলিয়ে কোনো সক্রিয় প্রতিবেদন নেই।'
                : 'There are no active clustered news reports matching your filters.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((cluster) => (
            <div
              key={cluster.id}
              className={cn(
                'p-4 rounded-xl border transition-all duration-200 space-y-3',
                isDark
                  ? 'bg-slate-900/80 border-slate-800/90 hover:border-slate-700'
                  : 'bg-slate-50 border-slate-200/90 shadow-sm hover:border-slate-300'
              )}
            >
              {/* Category & Time Header */}
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded',
                    isDark
                      ? 'bg-slate-800 text-slate-300'
                      : 'bg-slate-200/80 text-slate-700'
                  )}
                >
                  {cluster.category}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(cluster.timestamp, language)}
                </span>
              </div>

              {/* Headline */}
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {language === 'bn' ? cluster.headlineBn : cluster.headline}
              </h3>

              {/* Summary */}
              <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-3 leading-relaxed">
                {language === 'bn' ? cluster.summaryBn : cluster.summary}
              </p>

              {/* Coverage Summary Pill */}
              <div className="flex items-center justify-between pt-1">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border',
                    isDark
                      ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                      : 'bg-sky-50 text-sky-700 border-sky-200'
                  )}
                >
                  <Newspaper className="h-3 w-3" />
                  {language === 'bn'
                    ? `${cluster.outlets.length}টি গণমাধ্যমে বিস্তারিত`
                    : `Covered by ${cluster.outlets.length} ${cluster.outlets.length === 1 ? 'outlet' : 'outlets'}`}
                </span>
              </div>

              {/* Attribution-First Outlet Outbound Links */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {cluster.outlets.map((outlet) => (
                  <a
                    key={outlet.name}
                    href={outlet.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all hover:scale-105 select-none cursor-pointer',
                      isDark
                        ? 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-950 shadow-xs'
                    )}
                    title={`${language === 'bn' ? outlet.nameBn : outlet.name} প্রতিবেদন দেখুন`}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: outlet.logoColor }}
                    />
                    <span>{language === 'bn' ? outlet.nameBn : outlet.name}</span>
                    <ExternalLink className="h-2.5 w-2.5 opacity-50 shrink-0" />
                  </a>
                ))}
              </div>

              {/* Card Footer: Read Outlets Primary Link */}
              {cluster.outlets[0]?.url && (
                <div className="pt-2 flex items-center justify-end text-xs border-t border-slate-200 dark:border-slate-800/60">
                  <a
                    href={cluster.outlets[0].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    <span>
                      {language === 'bn' ? 'মূল উৎস সরাসরি পড়ুন' : 'Read Outlets'}
                    </span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
