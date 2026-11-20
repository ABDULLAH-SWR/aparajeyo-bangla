'use client';

import { Phone, Shield, ChevronRight, AlertCircle, Building } from 'lucide-react';
import type { CivicInfo, Language } from '@/types';
import { useMapStore } from '@/store/useMapStore';
import { cn } from '@/lib/utils';

interface CivicInfoTabProps {
  civic: CivicInfo;
  language: Language;
}

export function CivicInfoTab({ civic, language }: CivicInfoTabProps) {
  const theme = useMapStore((s) => s.theme);
  const isDark = theme === 'dark';

  return (
    <div className="space-y-4 pb-4">
      {/* District Overview Card */}
      <section
        className={cn(
          'p-4 rounded-xl border space-y-2',
          isDark
            ? 'bg-slate-900/80 border-slate-800/90'
            : 'bg-slate-50 border-slate-200/90 shadow-sm'
        )}
      >
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Building size={13} />
          {language === 'bn' ? 'সংক্ষিপ্ত জেলা বিবরণ' : 'District Overview'}
        </h3>
        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          {language === 'bn' ? civic.overviewBn : civic.overviewEn}
        </p>
      </section>

      {/* Emergency Hotlines Card */}
      <section
        className={cn(
          'p-4 rounded-xl border space-y-2.5',
          isDark
            ? 'bg-slate-900/80 border-slate-800/90'
            : 'bg-slate-50 border-slate-200/90 shadow-sm'
        )}
      >
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Phone size={13} className="text-red-500" />
          {language === 'bn' ? 'জরুরি যোগাযোগ নম্বর' : 'Emergency Hotlines'}
        </h3>
        <div className="grid grid-cols-1 gap-2 pt-1">
          {civic.emergencyNumbers.map((entry) => (
            <a
              key={entry.number}
              href={`tel:${entry.number}`}
              className={cn(
                'flex items-center justify-between p-2.5 rounded-lg border transition-all duration-200 group cursor-pointer',
                isDark
                  ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                  : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-100 shadow-xs'
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-7 w-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                  <Phone size={13} />
                </div>
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {language === 'bn' ? entry.labelBn : entry.label}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 group-hover:underline pl-2 shrink-0">
                {entry.number}
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* Civic Notices */}
      {civic.notices.length > 0 && (
        <section
          className={cn(
            'p-4 rounded-xl border space-y-2.5',
            isDark
              ? 'bg-slate-900/80 border-slate-800/90'
              : 'bg-slate-50 border-slate-200/90 shadow-sm'
          )}
        >
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <AlertCircle size={13} />
            {language === 'bn' ? 'প্রশাসনিক নোটিশ' : 'Civic Notices'}
          </h3>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800/60">
            {civic.notices.map((notice, idx) => (
              <li
                key={idx}
                className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-2 text-xs"
              >
                <ChevronRight size={13} className="mt-0.5 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {language === 'bn' ? notice.titleBn : notice.titleEn}
                  </p>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                    {notice.date}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Administrative Info Card */}
      <section
        className={cn(
          'p-4 rounded-xl border space-y-2.5',
          isDark
            ? 'bg-slate-900/80 border-slate-800/90'
            : 'bg-slate-50 border-slate-200/90 shadow-sm'
        )}
      >
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Shield size={13} />
          {language === 'bn' ? 'প্রশাসনিক তথ্য' : 'Administrative Intelligence'}
        </h3>
        <dl className="divide-y divide-slate-200 dark:divide-slate-800/60 pt-0.5">
          {civic.adminInfo.map((item, idx) => (
            <div
              key={idx}
              className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs gap-3"
            >
              <dt className="text-slate-600 dark:text-slate-400 font-medium shrink-0">
                {language === 'bn' ? item.labelBn : item.labelEn}
              </dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100 text-right truncate">
                {language === 'bn' ? item.valueBn : item.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
