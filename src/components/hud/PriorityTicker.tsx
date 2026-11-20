'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, ChevronDown, Clock, ShieldAlert } from 'lucide-react';
import { useMapStore } from '@/store/useMapStore';
import { getNationalPriorityIssues } from '@/services/dataService';
import { districts } from '@/data/mockData';
import type { PriorityIssue, SeverityLevel } from '@/types';
import { cn } from '@/lib/utils';

const districtMap = new Map(districts.map((d) => [d.districtCode, d]));

function getDistrictDisplayName(code: string, lang: 'en' | 'bn'): string {
  const d = districtMap.get(code);
  if (!d) return code.replace(/_/g, ' ');
  return lang === 'bn' ? d.nameBn : d.nameEn;
}

const ROTATE_INTERVAL = 5500;

const severityBadgeClasses: Record<SeverityLevel, string> = {
  Critical: 'severity-critical',
  High: 'severity-high',
  Advisory: 'severity-advisory',
};

function timeAgo(timestamp: string, lang: 'en' | 'bn'): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return lang === 'bn' ? `${mins} মি. আগে` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return lang === 'bn' ? `${hrs} ঘণ্টা আগে` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return lang === 'bn' ? `${days} দিন আগে` : `${days}d ago`;
}

export default function PriorityTicker() {
  const openDrawer = useMapStore((s) => s.openDrawer);
  const language = useMapStore((s) => s.language);
  const theme = useMapStore((s) => s.theme);
  const isDark = theme === 'dark';

  const [issues, setIssues] = useState<PriorityIssue[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getNationalPriorityIssues().then((data) => setIssues(data));
  }, []);

  // Auto-rotate ticker
  useEffect(() => {
    if (issues.length <= 1 || isExpanded) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % issues.length);
    }, ROTATE_INTERVAL);
    return () => clearInterval(timer);
  }, [issues.length, isExpanded]);

  // Click outside to collapse
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleItemClick = useCallback(
    (districtCode: string) => {
      openDrawer(districtCode);
      setIsExpanded(false);
    },
    [openDrawer]
  );

  if (issues.length === 0) return null;

  const current = issues[currentIndex];

  return (
    <div
      ref={containerRef}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-40 hidden sm:block"
    >
      {/* Main Priority Ticker Pill */}
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className={cn(
          'flex h-11 items-center gap-2.5 px-4 rounded-xl cursor-pointer transition-all duration-200 group select-none',
          isDark
            ? 'bg-slate-950/85 backdrop-blur-md border border-red-500/35 text-slate-100 shadow-2xl hover:border-red-400/60'
            : 'bg-white/92 backdrop-blur-md border border-red-500/30 text-slate-900 shadow-lg hover:border-red-500/60'
        )}
      >
        {/* Pulsing red live broadcast indicator */}
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>

        {/* Priority Badge / Count */}
        <span className="text-xs font-bold text-red-500 dark:text-red-400 whitespace-nowrap tracking-tight">
          {issues.length} {language === 'bn' ? 'সতর্কতা' : 'Alerts'}
        </span>

        {/* Divider */}
        <span className={cn('w-px h-4 shrink-0', isDark ? 'bg-slate-800' : 'bg-slate-200')} />

        {/* Active Headline (with smooth transition & truncation) */}
        <span className={cn(
          'text-xs font-semibold truncate max-w-[200px] md:max-w-[340px] text-left transition-opacity duration-300',
          isDark ? 'text-slate-100' : 'text-slate-900'
        )}>
          {language === 'bn' ? current.titleBn : current.title}
        </span>

        {/* Expand/Collapse Chevron */}
        <ChevronDown
          size={14}
          className={cn(
            'shrink-0 transition-transform duration-200',
            isDark ? 'text-slate-400 group-hover:text-slate-200' : 'text-slate-500 group-hover:text-slate-800',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* Expanded Broadcast Dropdown List */}
      {isExpanded && (
        <div
          className={cn(
            'absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[340px] sm:w-[440px] rounded-xl border shadow-2xl max-h-84 overflow-y-auto custom-scrollbar z-50 p-2 space-y-1',
            isDark
              ? 'bg-slate-950/95 backdrop-blur-xl border-slate-800 text-slate-100'
              : 'bg-white/98 backdrop-blur-xl border-slate-200 text-slate-900'
          )}
        >
          <div className="flex items-center justify-between px-2.5 py-1 border-b pb-1.5 border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <ShieldAlert size={13} className="text-red-500" />
              {language === 'bn' ? 'জরুরি জাতীয় সম্প্রচার' : 'National Broadcasts'}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {issues.length} {language === 'bn' ? 'টি সক্রিয়' : 'active'}
            </span>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800/60 pt-0.5">
            {issues.map((issue) => (
              <button
                key={issue.id}
                onClick={() => handleItemClick(issue.districtCode)}
                className={cn(
                  'w-full text-left p-2.5 rounded-lg transition-colors flex items-start gap-2.5 group cursor-pointer',
                  isDark ? 'hover:bg-slate-800/80' : 'hover:bg-slate-100'
                )}
              >
                <span
                  className={cn(
                    'shrink-0 mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                    severityBadgeClasses[issue.severity]
                  )}
                >
                  {issue.severity}
                </span>

                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-xs font-semibold leading-snug line-clamp-2 transition-colors',
                    isDark ? 'text-slate-100 group-hover:text-white' : 'text-slate-900 group-hover:text-slate-950'
                  )}>
                    {language === 'bn' ? issue.titleBn : issue.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {getDistrictDisplayName(issue.districtCode, language)}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {timeAgo(issue.timestamp, language)}
                    </span>
                    <span>·</span>
                    <span className="truncate">{issue.source}</span>
                  </div>
                </div>

                <AlertTriangle size={14} className="text-red-500 shrink-0 mt-1 opacity-70 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
