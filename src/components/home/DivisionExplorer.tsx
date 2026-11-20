'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, AlertTriangle, Newspaper, ArrowRight, Layers, Shield } from 'lucide-react';
import { getDivisionOverviews } from '@/services/dataService';
import type { DivisionOverview, Language } from '@/types';
import { cn } from '@/lib/utils';

interface DivisionExplorerProps {
  language: Language;
}

const toBanglaDigits = (n: number | string) =>
  n.toString().replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[parseInt(d, 10)]);

const initialDivisions: DivisionOverview[] = [
  { division: 'Dhaka', nameBn: 'ঢাকা', keyDistrictCode: 'dhaka', districtCount: 13, activePriorityCount: 2 },
  { division: 'Chattogram', nameBn: 'চট্টগ্রাম', keyDistrictCode: 'chattogram', districtCount: 11, activePriorityCount: 1 },
  { division: 'Sylhet', nameBn: 'সিলেট', keyDistrictCode: 'sylhet', districtCount: 4, activePriorityCount: 2 },
  { division: 'Rajshahi', nameBn: 'রাজশাহী', keyDistrictCode: 'rajshahi', districtCount: 8, activePriorityCount: 0 },
  { division: 'Khulna', nameBn: 'খুলনা', keyDistrictCode: 'khulna', districtCount: 10, activePriorityCount: 0 },
  { division: 'Rangpur', nameBn: 'রংপুর', keyDistrictCode: 'rangpur', districtCount: 8, activePriorityCount: 0 },
  { division: 'Barishal', nameBn: 'বরিশাল', keyDistrictCode: 'barishal', districtCount: 6, activePriorityCount: 0 },
  { division: 'Mymensingh', nameBn: 'ময়মনসিংহ', keyDistrictCode: 'mymensingh', districtCount: 4, activePriorityCount: 0 },
];

export default function DivisionExplorer({ language }: DivisionExplorerProps) {
  const isBangla = language === 'bn';
  const [divisions, setDivisions] = useState<DivisionOverview[]>(initialDivisions);
  const [selectedDivisionName, setSelectedDivisionName] = useState<string>('Dhaka');

  useEffect(() => {
    getDivisionOverviews().then((data) => {
      if (data && data.length > 0) {
        setDivisions(data);
      }
    });
  }, []);

  const selectedDivision =
    divisions.find((d) => d.division.toLowerCase() === selectedDivisionName.toLowerCase()) ||
    divisions[0];

  return (
    <section className="py-14 sm:py-18 bg-[#FAF9F6] dark:bg-[#07110E] transition-colors duration-200 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="text-center max-w-2xl mx-auto space-y-2"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
            <Layers size={13} className="stroke-[2.5]" />
            <span>{isBangla ? 'বিভাগভিত্তিক লাইভ ওভারভিউ' : 'Division Quick-Explorer'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            {isBangla ? 'বাংলাদেশের ৮টি বিভাগের একনজরে অবস্থা' : 'Live Situation Across 8 Divisions'}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isBangla
              ? 'যেকোনো বিভাগ নির্বাচন করে সক্রিয় সতর্কতা, সংবাদ ও জেলার সংখ্যা জানুন।'
              : 'Select any division to inspect active alerts, district counts, and recent local headlines.'}
          </p>
        </motion.div>

        {/* 8-Division Clickable Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 max-w-4xl mx-auto">
          {divisions.map((div) => {
            const isSelected =
              selectedDivision?.division.toLowerCase() === div.division.toLowerCase();
            return (
              <button
                key={div.division}
                onClick={() => setSelectedDivisionName(div.division)}
                className={cn(
                  'px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer flex items-center gap-2 select-none border',
                  isSelected
                    ? 'bg-[#005A43] dark:bg-emerald-600 text-white border-[#005A43] dark:border-emerald-500 shadow-md scale-102'
                    : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300'
                )}
              >
                <span>{isBangla ? div.nameBn : div.division}</span>
                {div.activePriorityCount > 0 && (
                  <span
                    className={cn(
                      'px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                      isSelected
                        ? 'bg-red-500 text-white'
                        : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                    )}
                  >
                    {isBangla ? toBanglaDigits(div.activePriorityCount) : div.activePriorityCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Live Summary Panel */}
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedDivision.division}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="p-6 sm:p-8 rounded-3xl border bg-white dark:bg-slate-950/70 border-slate-200 dark:border-slate-800/80 shadow-lg space-y-6"
            >
              {/* Division Title & Key Metrics */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                    <MapPin size={22} className="stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                      {isBangla ? `${selectedDivision.nameBn} বিভাগ` : `${selectedDivision.division} Division`}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isBangla
                        ? `${toBanglaDigits(selectedDivision.districtCount)}টি জেলা অন্তর্ভুক্ত`
                        : `${selectedDivision.districtCount} Districts covered in this regional grid`}
                    </p>
                  </div>
                </div>

                {/* Division Status Pill */}
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5',
                      selectedDivision.activePriorityCount > 0
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    )}
                  >
                    {selectedDivision.activePriorityCount > 0 ? (
                      <>
                        <AlertTriangle size={14} />
                        <span>
                          {isBangla
                            ? `${toBanglaDigits(selectedDivision.activePriorityCount)}টি সক্রিয় সতর্কতা`
                            : `${selectedDivision.activePriorityCount} Active Alert${selectedDivision.activePriorityCount > 1 ? 's' : ''}`}
                        </span>
                      </>
                    ) : (
                      <>
                        <Shield size={14} />
                        <span>{isBangla ? 'কোনো সংকট নেই' : 'Normal Conditions'}</span>
                      </>
                    )}
                  </div>

                  {/* Explore Division CTA Button */}
                  <Link
                    href={`/?district=${selectedDivision.keyDistrictCode}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all duration-150 active:scale-95 bg-[#D93829] hover:bg-[#B6281B] shadow-sm shrink-0"
                  >
                    <span>
                      {isBangla
                        ? `${selectedDivision.nameBn} মানচিত্রে দেখুন`
                        : `Explore ${selectedDivision.division} on Map`}
                    </span>
                    <ArrowRight size={14} className="stroke-[2.5]" />
                  </Link>
                </div>
              </div>

              {/* Grid: Active Issue Snapshot + Latest News Preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Priority alert card */}
                <div className="p-4 rounded-2xl border bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <AlertTriangle size={12} className="text-amber-500" />
                    {isBangla ? 'শীর্ষ আঞ্চলিক সতর্কতা' : 'Top Regional Alert'}
                  </span>
                  {selectedDivision.topPriority ? (
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                        {isBangla
                          ? selectedDivision.topPriority.titleBn
                          : selectedDivision.topPriority.title}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {isBangla
                          ? selectedDivision.topPriority.descriptionBn
                          : selectedDivision.topPriority.description}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400 py-1">
                      {isBangla
                        ? 'এই মুহূর্তে এই বিভাগে কোনো জরুরি সতর্কতা সংকেত নেই।'
                        : 'No urgent emergency alerts currently active in this division.'}
                    </p>
                  )}
                </div>

                {/* Right: Latest news snapshot */}
                <div className="p-4 rounded-2xl border bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Newspaper size={12} className="text-sky-500" />
                    {isBangla ? 'সর্বশেষ সংবাদ প্রকাশ' : 'Latest Field News'}
                  </span>
                  {selectedDivision.latestNews ? (
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                        {isBangla
                          ? selectedDivision.latestNews.headlineBn
                          : selectedDivision.latestNews.headline}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {isBangla
                          ? selectedDivision.latestNews.summaryBn
                          : selectedDivision.latestNews.summary}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400 py-1">
                      {isBangla
                        ? 'সাম্প্রতিক কোনো সংবাদ তালিকাভুক্ত নেই।'
                        : 'No recent localized news recorded.'}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
