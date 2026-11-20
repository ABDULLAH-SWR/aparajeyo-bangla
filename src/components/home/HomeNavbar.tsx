'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sun, Moon, ArrowRight } from 'lucide-react';
import { motion, useScroll, useSpring } from 'motion/react';
import { useMapStore } from '@/store/useMapStore';
import { cn } from '@/lib/utils';

export default function HomeNavbar() {
  const language = useMapStore((s) => s.language);
  const setLanguage = useMapStore((s) => s.setLanguage);
  const theme = useMapStore((s) => s.theme);
  const toggleTheme = useMapStore((s) => s.toggleTheme);
  const isDark = theme === 'dark';

  const [activeSection, setActiveSection] = useState<string>('');

  // Scroll Progress Indicator
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  // IntersectionObserver Scroll-Spy
  useEffect(() => {
    const sectionIds = ['about', 'features', 'how-it-works', 'roadmap'];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0.1,
      }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Handle Logo Click
  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      if (window.location.hash) {
        window.history.pushState(null, '', '/home');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const navLinks = [
    { id: 'about', labelEn: 'About', labelBn: 'পরিচিতি' },
    { id: 'features', labelEn: 'Features', labelBn: 'সুবিধাসমূহ' },
    { id: 'how-it-works', labelEn: 'How It Works', labelBn: 'ব্যবহারবিধি' },
    { id: 'roadmap', labelEn: 'Roadmap', labelBn: 'পরিকল্পনা' },
  ];

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-16 w-full backdrop-blur-md border-b transition-colors duration-200 bg-white/85 dark:bg-slate-950/85 border-slate-200/80 dark:border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & PetaBencana-style Circular Language Switcher */}
        <div className="flex items-center gap-4 sm:gap-6">
          <a
            href="/home"
            onClick={handleLogoClick}
            className="flex items-center gap-2.5 group select-none cursor-pointer"
            title="অপরাজেয় বাংলা — Home"
          >
            {/* Compact Pin Mark */}
            <svg
              viewBox="0 0 100 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-7 h-7 shrink-0 select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition-transform duration-200 group-hover:scale-105"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="navPinChassis" x1="50" y1="6" x2="50" y2="114" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FFFFFF" />
                  <stop offset="0.75" stopColor="#F8FAFC" />
                  <stop offset="1" stopColor="#E2E8F0" />
                </linearGradient>
                <radialGradient id="navEmeraldHead" cx="48" cy="40" r="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#007A5A" />
                  <stop offset="0.6" stopColor="#005A43" />
                  <stop offset="1" stopColor="#003E2E" />
                </radialGradient>
                <radialGradient id="navCrimsonSun" cx="45" cy="40" r="15" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#EF4444" />
                  <stop offset="0.7" stopColor="#D93829" />
                  <stop offset="1" stopColor="#B6281B" />
                </radialGradient>
              </defs>

              <path
                d="M 50 114 C 47.5 106 14 74 14 42 A 36 36 0 1 1 86 42 C 86 74 52.5 106 50 114 Z"
                fill="url(#navPinChassis)"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <circle cx="50" cy="42" r="29" fill="url(#navEmeraldHead)" />
              <circle cx="50" cy="42" r="22" stroke="rgba(52, 211, 153, 0.45)" strokeWidth="1.2" strokeDasharray="3 3" />
              <circle cx="46" cy="42" r="14" fill="url(#navCrimsonSun)" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="0.8" />
              <circle cx="46" cy="42" r="2.5" fill="#FFFFFF" opacity="0.95" />
            </svg>

            {/* Bangla-Only Brand Wordmark */}
            <span className="text-xl sm:text-[22px] font-bold tracking-tight leading-none text-[#0F1F1B] dark:text-white font-bangla transition-colors group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
              অপরাজেয় বাংলা
            </span>
          </a>

          {/* Divider */}
          <div className="hidden sm:block h-5 w-px bg-slate-200 dark:bg-slate-800" />

          {/* Circular Pill Language Switcher (PetaBencana style) */}
          <div className="flex items-center p-0.5 rounded-full border bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setLanguage('en')}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer',
                language === 'en'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('bn')}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-bold font-bangla transition-all cursor-pointer',
                language === 'bn'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              বাং
            </button>
          </div>
        </div>

        {/* Center: Anchor Links with Scroll-Spy Active Indicator */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold uppercase tracking-wider">
          {navLinks.map((link) => {
            const isActive = activeSection === link.id;
            return (
              <a
                key={link.id}
                href={`#${link.id}`}
                className={cn(
                  'relative py-1 transition-colors duration-200',
                  isActive
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
                )}
              >
                {language === 'bn' ? link.labelBn : link.labelEn}
                {isActive && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-emerald-500 rounded-full"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Right: Theme Toggle & Primary Map CTA */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="flex h-9 w-9 items-center justify-center rounded-xl border transition-colors cursor-pointer text-slate-600 hover:text-slate-950 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800"
          >
            {isDark ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} />}
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all active:scale-95 bg-[#D93829] hover:bg-[#B6281B]"
          >
            <span>{language === 'bn' ? 'লাইভ মানচিত্র খুলুন' : 'Open Live Map'}</span>
            <ArrowRight size={14} className="stroke-[2.5]" />
          </Link>
        </div>
      </div>

      {/* Docked Scroll Progress Bar along bottom edge */}
      <motion.div
        style={{ scaleX }}
        className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-teal-400 to-[#D93829] origin-left pointer-events-none"
      />
    </header>
  );
}
