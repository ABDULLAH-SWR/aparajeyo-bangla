'use client';

import React from 'react';
import { Compass, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import type { Language } from '@/types';

interface MissionSectionProps {
  language: Language;
}

export default function MissionSection({ language }: MissionSectionProps) {
  return (
    <section
      id="about"
      className="scroll-mt-20 py-20 sm:py-28 bg-[#FAF9F6] dark:bg-[#07110E] transition-colors duration-200"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 sm:space-y-8">
        {/* Subtle pill tag with motion reveal */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 shadow-xs"
        >
          <Compass size={14} className="stroke-[2.5]" />
          <span>{language === 'bn' ? 'আমাদের লক্ষ্য ও পরিচিতি' : 'Our Mission & Vision'}</span>
        </motion.div>

        {/* Big Editorial Mission Statement (Zero technical jargon) */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-snug sm:leading-tight"
        >
          {language === 'bn' ? (
            <>
              বাংলাদেশের যে-কোনো প্রান্তের মানুষের কাছে{' '}
              <span className="text-[#005A43] dark:text-emerald-400">সঠিক তথ্য</span> ও{' '}
              <span className="text-[#D93829] dark:text-red-400">জরুরি সতর্কতা</span>{' '}
              মুহূর্তেই পৌঁছে দেওয়াই আমাদের অঙ্গীকার।
            </>
          ) : (
            <>
              One unified map where anyone in Bangladesh can check{' '}
              <span className="text-[#005A43] dark:text-emerald-400">district-level priority alerts</span>, browse{' '}
              <span className="text-[#0284C7] dark:text-sky-400">trusted news</span>, and find emergency help in seconds.
            </>
          )}
        </motion.h2>

        {/* Supporting Narrative */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
          className="text-base sm:text-xl text-slate-700 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed"
        >
          {language === 'bn'
            ? 'বন্যা, কালবৈশাখী, অগ্নিকাণ্ড বা নাগরিক যেকোনো পরিস্থিতিতে বিভিন্ন গণমাধ্যম ও সরকারি সংস্থার তথ্য খোঁজা কঠিন হয়ে পড়ে। অপরাজেয় বাংলা এই সব গুরুত্বপূর্ণ তথ্যকে একটি সহজ, আধুনিক ও নির্ভরযোগ্য মানচিত্রে একত্রিত করে সবার জন্য উন্মুক্ত করেছে।'
            : 'During floods, natural disasters, or civic disruptions, fragmented reports create panic and delays. Aparajeyo Bangla transforms civic intelligence into an open, accessible visual dashboard for citizens, responders, and community leaders nationwide.'}
        </motion.p>

        {/* Clean Signature/Values Pill Bar */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
          className="pt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400"
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            <span>{language === 'bn' ? '১০০% উন্মুক্ত ও নাগরিক-বান্ধব' : '100% Free & Open to All'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#D93829] dark:bg-red-400" />
            <span>{language === 'bn' ? 'বিজ্ঞাপন ও বিভ্রান্তিমুক্ত' : 'Zero Ad Clutter'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sky-600 dark:bg-sky-400" />
            <span>{language === 'bn' ? 'সরাসরি গণমাধ্যম উৎস' : 'Direct Outlet Attribution'}</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
