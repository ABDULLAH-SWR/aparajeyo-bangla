'use client';

import React from 'react';
import { Map, AlertTriangle, Newspaper, PhoneCall } from 'lucide-react';
import { motion } from 'motion/react';
import type { Language } from '@/types';
import { cn } from '@/lib/utils';

interface FeaturesGridProps {
  language: Language;
}

export default function FeaturesGrid({ language }: FeaturesGridProps) {
  const features = [
    {
      icon: Map,
      badgeColor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      hoverBorder: 'hover:border-emerald-500/50 dark:hover:border-emerald-500/40',
      titleEn: 'Detailed 64-District Map Engine',
      titleBn: '৬৪টি জেলার বিস্তারিত ভেক্টর মানচিত্র',
      descriptionEn:
        'Smooth WebGL vector map rendering authentic Bangladesh district boundaries with instant boundary hover highlights, zoom-aware labels, and non-blocking desktop drawer exploration.',
      descriptionBn:
        'প্রামাণ্য জেলা সীমানা সম্বলিত অত্যাধুনিক ওয়েবজিএল ভেক্টর মানচিত্র। জেলা নির্বাচন, তাৎক্ষণিক জুম ও ডেস্কটপ প্যানেল সুবিধার মাধ্যমে যে-কোনো জেলার অবস্থা একনজরে দেখুন।',
      tagEn: 'Cartographic Core',
      tagBn: 'মানচিত্র প্রযুক্তি',
    },
    {
      icon: AlertTriangle,
      badgeColor: 'bg-[#D93829]/10 text-[#D93829] dark:text-red-400 border-[#D93829]/30',
      hoverBorder: 'hover:border-red-500/50 dark:hover:border-red-500/40',
      titleEn: 'Top Priority Issue Broadcasting',
      titleBn: 'জরুরি সতর্কতা ও দুর্যোগ সম্প্রচার',
      descriptionEn:
        'High-visibility color-coded severity beacons (Critical crimson, High amber, Advisory sky) with pulsating halos and rotating ticker alerts across flood zones and crisis hotspots.',
      descriptionBn:
        'আকস্মিক বন্যা, কালবৈশাখী কিংবা জরুরি নাগরিক পরিস্থিতিতে রং-চিহ্নিত সতর্কতা সংকেত (জরুরি, উচ্চ ও পরামর্শমূলক) ও সরাসরি লাইভ নোটিফিকেশন সুবিধা।',
      tagEn: 'Emergency Broadcast',
      tagBn: 'জরুরি সতর্কতা',
    },
    {
      icon: Newspaper,
      badgeColor: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30',
      hoverBorder: 'hover:border-sky-500/50 dark:hover:border-sky-500/40',
      titleEn: 'Multi-Outlet News Aggregation',
      titleBn: 'বহু-গণমাধ্যমের সমন্বিত সংবাদ ফিড',
      descriptionEn:
        'Stories from Prothom Alo, The Daily Star, bdnews24, Bangla Tribune, and Jamuna TV clustered by topic, featuring category filters and attribution-first direct source links.',
      descriptionBn:
        'প্রথম আলো, দ্য ডেইলি স্টার, বিডিনিউজ২৪ সহ প্রধান গণমাধ্যমের সংবাদ একত্রিত করে জেলাভিত্তিক প্রদর্শন। সরাসরি মূল উৎসের লিংকসহ সঠিক তথ্য নিশ্চিতকরণ।',
      tagEn: 'Verified Media',
      tagBn: 'সংবাদ ক্লাস্টার',
    },
    {
      icon: PhoneCall,
      badgeColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
      hoverBorder: 'hover:border-amber-500/50 dark:hover:border-amber-500/40',
      titleEn: 'Important Local & Civic Information',
      titleBn: 'জরুরি স্থানীয় হটলাইন ও নাগরিক সেবা',
      descriptionEn:
        'One-click access to district emergency hotlines (999, Fire Service, Ambulance, DC Office), administrative leadership intelligence, and local civic notices.',
      descriptionBn:
        'প্রতিটি জেলার জরুরি ফোন নম্বর (৯৯৯, ফায়ার সার্ভিস, অ্যাম্বুলেন্স, জেলা প্রশাসন), স্থানীয় প্রশাসনিক কর্মকর্তা ও নাগরিক নোটিশ সহজে খুঁজে পান।',
      tagEn: 'Civic Utility',
      tagBn: 'নাগরিক সেবা',
    },
  ];

  return (
    <section
      id="features"
      className="scroll-mt-20 py-20 sm:py-28 bg-[#FAF9F6] dark:bg-[#07110E] transition-colors duration-200 border-b border-slate-200 dark:border-slate-800"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="text-center max-w-3xl mx-auto space-y-4 mb-16"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-[#005A43] dark:text-emerald-400">
            {language === 'bn' ? 'প্রধান সুবিধাসমূহ' : 'Core Capabilities'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            {language === 'bn' ? 'নাগরিক তথ্যের স্মার্ট ও সমন্বিত রূপ' : 'Engineered for Clarity in Critical Moments'}
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400">
            {language === 'bn'
              ? 'একটি প্ল্যাটফর্মেই মানচিত্র, জরুরি সতর্কতা, গণমাধ্যমের সংবাদ ও স্থানীয় তথ্য পাওয়ার আধুনিক অভিজ্ঞতা।'
              : 'Built from the ground up to provide seamless situational awareness for every district of Bangladesh.'}
          </p>
        </motion.div>

        {/* 2x2 Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: idx * 0.1, ease: 'easeOut' }}
                whileHover={{ y: -5 }}
                className={cn(
                  'group p-8 rounded-3xl border transition-all duration-300 space-y-5',
                  'bg-white dark:bg-slate-950/70 border-slate-200 dark:border-slate-800/80 shadow-md hover:shadow-xl',
                  item.hoverBorder
                )}
              >
                {/* Header: Icon + Category Tag */}
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      'h-12 w-12 rounded-2xl border flex items-center justify-center transition-transform group-hover:scale-110 duration-200',
                      item.badgeColor
                    )}
                  >
                    <Icon size={24} className="stroke-[2.2]" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                    {language === 'bn' ? item.tagBn : item.tagEn}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-[#005A43] dark:group-hover:text-emerald-400 transition-colors">
                  {language === 'bn' ? item.titleBn : item.titleEn}
                </h3>

                {/* Description */}
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                  {language === 'bn' ? item.descriptionBn : item.descriptionEn}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
