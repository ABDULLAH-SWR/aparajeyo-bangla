'use client';

import { AlertTriangle, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PriorityIssue, Language, SeverityLevel } from '@/types';
import { useMapStore } from '@/store/useMapStore';

interface PriorityTabProps {
  priorities: PriorityIssue[];
  language: Language;
}

const SEVERITY_STYLES: Record<SeverityLevel, string> = {
  Critical: 'severity-critical',
  High: 'severity-high',
  Advisory: 'severity-advisory',
};

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

export function PriorityTab({ priorities, language }: PriorityTabProps) {
  const theme = useMapStore((s) => s.theme);
  const isDark = theme === 'dark';
  const active = priorities.filter((p) => p.isActive);

  if (active.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
          <CheckCircle className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {language === 'bn' ? 'কোনো জরুরি সতর্কতা নেই' : 'No Active Priority Alerts'}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-[240px]">
            {language === 'bn'
              ? 'এই জেলায় বর্তমানে কোনো সক্রিয় জরুরি সম্প্রচার রিপোর্ট নেই।'
              : 'There are currently no active emergency broadcasts for this district.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      {active.map((issue) => (
        <div
          key={issue.id}
          className={cn(
            'p-4 rounded-xl border transition-all duration-200 space-y-2.5',
            isDark
              ? 'bg-slate-900/80 border-slate-800/90 hover:border-slate-700'
              : 'bg-slate-50 border-slate-200/90 shadow-sm hover:border-slate-300'
          )}
        >
          {/* Header: Severity Badge + Category */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider',
                SEVERITY_STYLES[issue.severity]
              )}
            >
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {issue.severity}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              {issue.category}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
            {language === 'bn' ? issue.titleBn : issue.title}
          </h3>

          {/* Description */}
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            {language === 'bn' ? issue.descriptionBn : issue.description}
          </p>

          {/* Footer Metadata */}
          <div className="pt-2 flex items-center justify-between text-[11px] border-t border-slate-200 dark:border-slate-800/60">
            <span className="font-medium text-slate-700 dark:text-slate-400 truncate max-w-[180px]">
              {issue.source}
            </span>
            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 shrink-0">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(issue.timestamp, language)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
