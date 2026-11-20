'use client';

import React from 'react';
import Link from 'next/link';
import { Shield, ArrowUpRight, Heart } from 'lucide-react';
import { useMapStore } from '@/store/useMapStore';

export default function HomeFooter() {
  const language = useMapStore((s) => s.language);
  const setLanguage = useMapStore((s) => s.setLanguage);

  return (
    <footer className="bg-[#003E2E] text-slate-200 border-t border-emerald-800/60 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start justify-between">
          {/* Brand & Slogan */}
          <div className="md:col-span-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-700/50 border border-emerald-400/40 flex items-center justify-center text-white">
                <Shield size={20} className="stroke-[2.2]" />
              </div>
              <span className="text-xl font-bold font-bangla text-white tracking-tight">
                অপরাজেয় বাংলা
              </span>
            </div>
            <p className="text-sm font-semibold text-emerald-300">
              {language === 'bn'
                ? 'অপরাজেয় বাংলা: সচেতন ও স্মার্ট বাংলাদেশের পথে।'
                : 'Aparajeyo Bangla: Empowering a Smarter Bangladesh.'}
            </p>
            <p className="text-xs text-slate-300 max-w-md leading-relaxed">
              {language === 'bn'
                ? 'বাংলাদেশের প্রতিটি নাগরিক ও জরুরি উদ্ধারকর্মীদের জন্য একটি উন্মুক্ত ও নিরপেক্ষ নাগরিক গোয়েন্দা মানচিত্র উদ্যোগ।'
                : 'An open, independent public-interest civic intelligence map initiative designed for Bangladeshi citizens and emergency responders.'}
            </p>
          </div>

          {/* Nav Links */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              {language === 'bn' ? 'ন্যাভিগেশন' : 'Navigation'}
            </h4>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <Link href="/" className="hover:text-white transition-colors flex items-center gap-1">
                  <span>{language === 'bn' ? 'লাইভ মানচিত্র' : 'Live Interactive Map'}</span>
                  <ArrowUpRight size={12} className="opacity-60" />
                </Link>
              </li>
              <li>
                <a href="#about" className="hover:text-white transition-colors">
                  {language === 'bn' ? 'প্ল্যাটফর্মের পরিচিতি' : 'About Platform'}
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  {language === 'bn' ? 'প্রধান সুবিধাসমূহ' : 'Core Features'}
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors">
                  {language === 'bn' ? 'ব্যবহারবিধি ও পরবর্তী পরিকল্পনা' : 'How It Works & Roadmap'}
                </a>
              </li>
            </ul>
          </div>

          {/* Language Switcher in Footer */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              {language === 'bn' ? 'ভাষা নির্বাচন' : 'Language'}
            </h4>
            <div className="flex items-center gap-2 text-xs font-bold">
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  language === 'en'
                    ? 'bg-emerald-800 border-emerald-400 text-white'
                    : 'bg-emerald-950/60 border-emerald-900 text-slate-400 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage('bn')}
                className={`px-3 py-1.5 rounded-lg border font-bangla transition-colors cursor-pointer ${
                  language === 'bn'
                    ? 'bg-emerald-800 border-emerald-400 text-white'
                    : 'bg-emerald-950/60 border-emerald-900 text-slate-400 hover:text-white'
                }`}
              >
                বাংলা
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Attribution Line */}
        <div className="pt-8 border-t border-emerald-800/50 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>
            © 2026 Aparajeyo Bangla (অপরাজেয় বাংলা). All rights reserved.
          </p>
          <p className="flex items-center gap-1.5">
            <span>Built for the resilient people of Bangladesh</span>
            <Heart size={12} className="text-red-400 fill-red-400" />
          </p>
        </div>
      </div>
    </footer>
  );
}
