'use client';

import React from 'react';
import Link from 'next/link';
import { MousePointerClick, Search, BellRing, CloudLightning, MessageSquare, Layers, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import type { Language } from '@/types';

interface RoadmapSectionProps {
  language: Language;
}

export default function RoadmapSection({ language }: RoadmapSectionProps) {
  const steps = [
    {
      num: '01',
      icon: Search,
      titleEn: '1. Open the Map',
      titleBn: '১. মানচিত্র খুলুন',
      descEn:
        'Access the full-screen interactive map from any phone or computer without installing any app or creating an account.',
      descBn:
        'কোনো অ্যাপ ইনস্টল বা অ্যাকাউন্ট খোলার ঝামেলা ছাড়াই যেকোনো ডিভাইস থেকে সরাসরি ফুলস্ক্রিন মানচিত্রে প্রবেশ করুন।',
    },
    {
      num: '02',
      icon: MousePointerClick,
      titleEn: '2. Select Any District',
      titleBn: '২. জেলা নির্বাচন করুন',
      descEn:
        'Click directly on any of the 64 districts on the map, click an active incident beacon, or use the instant search bar.',
      descBn:
        'মানচিত্রে সরাসরি ৬৪টি জেলার যেকোনোটিতে ক্লিক করুন, অথবা সার্চবারে জেলার নাম লিখে দ্রুত সেই জেলায় চলে যান।',
    },
    {
      num: '03',
      icon: BellRing,
      titleEn: '3. Stay Informed & Prepared',
      titleBn: '৩. জানুন এবং সতর্ক থাকুন',
      descEn:
        'Browse active priority alerts, read clustered news stories, and access one-click emergency hotlines immediately.',
      descBn:
        'জরুরি সতর্কতাগুলো জেনে নিন, স্থানীয় সংবাদ পড়ুন এবং এক ক্লিকেই জরুরি হটলাইন নম্বরে যোগাযোগের ব্যবস্থা গ্রহণ করুন।',
    },
  ];

  const roadmapItems = [
    {
      icon: CloudLightning,
      titleEn: 'Weather & Flood Telemetry',
      titleBn: 'আবহাওয়া ও বন্যা পূর্বাভাস',
      descEn: 'Live integration with Bangladesh Meteorological Department (BMD) and FFWC river level stations.',
      descBn: 'আবহাওয়া অধিদপ্তর ও বন্যা পূর্বাভাস কেন্দ্রের লাইভ নদী ও বৃষ্টিপাত তথ্য সংযোজন।',
      statusEn: 'Coming in v1.5',
      statusBn: 'পরবর্তী সংস্করণে আসছে',
    },
    {
      icon: MessageSquare,
      titleEn: 'Citizen Civic Telemetry',
      titleBn: 'নাগরিক রিপোর্ট সুবিধা',
      descEn: 'Verified community reporting for localized waterlogging, road damage, and relief requests.',
      descBn: 'নাগরিকদের সরাসরি জলাবদ্ধতা, সড়ক সমস্যা ও স্থানীয় তথ্য জানানোর ব্যবস্থা।',
      statusEn: 'Coming in v2.0',
      statusBn: 'পরিকল্পনাধীন',
    },
    {
      icon: Layers,
      titleEn: 'Upazila-Level View',
      titleBn: 'উপজেলা ও ইউনিয়ন পর্যায়',
      descEn: 'Sub-district resolution maps expanding precision for 495+ upazilas across Bangladesh.',
      descBn: 'বাংলাদেশের ৪৯৫+ উপজেলার সীমানা ও তথ্যের আরও বিস্তারিত ভৌগোলিক রূপ।',
      statusEn: 'In Research',
      statusBn: 'গবেষণাধীন',
    },
  ];

  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 py-20 sm:py-28 bg-white dark:bg-slate-950 transition-colors duration-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        {/* Part 1: How It Works */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="text-center max-w-3xl mx-auto space-y-4 mb-16"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#005A43] dark:text-emerald-400">
              {language === 'bn' ? 'ব্যবহারবিধি' : 'Simple Workflow'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {language === 'bn' ? 'মাত্র ৩টি সহজ পদক্ষেপে জানুন' : 'How It Works in 3 Simple Steps'}
            </h2>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400">
              {language === 'bn'
                ? 'সবার জন্য সহজ ও বোধগম্য উপায়ে তথ্য জানার ব্যবস্থা।'
                : 'Zero learning curve. Designed to be fast, responsive, and completely frictionless.'}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 25 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: idx * 0.12, ease: 'easeOut' }}
                  whileHover={{ y: -5 }}
                  className="relative p-8 rounded-3xl border bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 dark:hover:border-emerald-500/30 transition-all duration-300 space-y-4 shadow-sm hover:shadow-lg"
                >
                  <span className="text-4xl font-extrabold text-[#005A43]/20 dark:text-emerald-500/20 block font-mono">
                    {step.num}
                  </span>
                  <div className="h-10 w-10 rounded-xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                    <Icon size={20} className="stroke-[2.2]" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {language === 'bn' ? step.titleBn : step.titleEn}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {language === 'bn' ? step.descBn : step.descEn}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Part 2: Roadmap Strip */}
        <motion.div
          id="roadmap"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="scroll-mt-20 rounded-3xl p-8 sm:p-12 border bg-gradient-to-br from-[#003E2E] via-[#052219] to-[#07110E] text-white border-emerald-500/30 space-y-10 shadow-2xl"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                {language === 'bn' ? 'পরবর্তী সম্প্রসারণ ও পরিকল্পনা' : 'Platform Roadmap'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {language === 'bn' ? 'ভবিষ্যতের আরও সমৃদ্ধ নাগরিক সুবিধা' : 'What We Are Building Next'}
              </h2>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-2 self-start md:self-auto px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#D93829] hover:bg-[#B6281B] transition-colors shadow-md active:scale-95"
            >
              <span>{language === 'bn' ? 'বর্তমান লাইভ মানচিত্র দেখুন' : 'Explore Live Map Today'}</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {roadmapItems.map((r, i) => {
              const Icon = r.icon;
              return (
                <motion.div
                  key={i}
                  whileHover={{ y: -4 }}
                  className="p-6 rounded-2xl border border-emerald-500/20 bg-slate-950/60 backdrop-blur-md space-y-3 hover:border-emerald-400/40 transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Icon size={18} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-emerald-400/30 text-emerald-300 bg-emerald-950/80">
                      {language === 'bn' ? r.statusBn : r.statusEn}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white">
                    {language === 'bn' ? r.titleBn : r.titleEn}
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {language === 'bn' ? r.descBn : r.descEn}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
