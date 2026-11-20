'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'motion/react';
import type { Language } from '@/types';
import { getNationalPriorityIssues } from '@/services/dataService';

interface StatsStripProps {
  language: Language;
}

const toBanglaDigits = (n: number | string) =>
  n.toString().replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[parseInt(d, 10)]);

function AnimatedCounter({
  target,
  suffix = '',
  isBangla,
}: {
  target: number;
  suffix?: string;
  isBangla: boolean;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });

  useEffect(() => {
    if (!isInView) return;
    const duration = 1400; // ms
    const startTime = performance.now();
    let animId: number;

    const step = (now: number) => {
      const elapsed = Math.min((now - startTime) / duration, 1);
      // easeOutExpo
      const eased = elapsed === 1 ? 1 : 1 - Math.pow(2, -10 * elapsed);
      setCount(Math.round(eased * target));
      if (elapsed < 1) {
        animId = requestAnimationFrame(step);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isInView, target]);

  const display = isBangla ? toBanglaDigits(count) : count;
  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}

export default function StatsStrip({ language }: StatsStripProps) {
  const isBangla = language === 'bn';
  const [alertCount, setAlertCount] = useState<number>(5);

  useEffect(() => {
    getNationalPriorityIssues().then((issues) => {
      setAlertCount(issues.length || 5);
    });
  }, []);

  const stats = [
    {
      numeric: 64,
      suffix: '',
      labelEn: 'Districts Mapped',
      labelBn: 'জেলাভিত্তিক নিখুঁত মানচিত্র',
      subtextEn: 'Authentic BBS Boundaries',
      subtextBn: 'প্রমাণিত সীমানা ও অবস্থান',
    },
    {
      numeric: 8,
      suffix: isBangla ? 'টি' : '',
      labelEn: 'Divisions Connected',
      labelBn: 'বিভাগীয় নেটওয়ার্ক',
      subtextEn: 'National Federation Grid',
      subtextBn: 'সারাদেশব্যাপী সমন্বয়',
    },
    {
      numeric: 7,
      suffix: '+',
      labelEn: 'Leading News Outlets',
      labelBn: 'প্রধান গণমাধ্যম সূত্র',
      subtextEn: 'Attribution-First Stories',
      subtextBn: 'সরাসরি নির্ভরযোগ্য রিপোর্ট',
    },
    {
      numeric: alertCount,
      suffix: isBangla ? 'টি' : '',
      labelEn: 'Active Emergency Alerts',
      labelBn: 'সক্রিয় জরুরি সতর্কতা',
      subtextEn: 'Tiered Severity Beacons',
      subtextBn: 'রং-চিহ্নিত সতর্কতা সংকেত',
    },
  ];

  return (
    <section className="border-y transition-colors duration-200 bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
          {stats.map((s, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className={`flex flex-col items-center text-center ${idx > 0 ? 'pt-6 md:pt-0' : ''} px-4`}
            >
              <span className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#005A43] dark:text-emerald-400 font-sans">
                <AnimatedCounter target={s.numeric} suffix={s.suffix} isBangla={isBangla} />
              </span>
              <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 mt-2">
                {isBangla ? s.labelBn : s.labelEn}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isBangla ? s.subtextBn : s.subtextEn}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
