'use client';

import React, { useEffect } from 'react';
import { MotionConfig } from 'motion/react';
import { useMapStore } from '@/store/useMapStore';
import HomeNavbar from '@/components/home/HomeNavbar';
import HeroSection from '@/components/home/HeroSection';
import MissionSection from '@/components/home/MissionSection';
import StatsStrip from '@/components/home/StatsStrip';
import DivisionExplorer from '@/components/home/DivisionExplorer';
import FeaturesGrid from '@/components/home/FeaturesGrid';
import RoadmapSection from '@/components/home/RoadmapSection';
import HomeFooter from '@/components/home/HomeFooter';

export default function HomePage() {
  const theme = useMapStore((s) => s.theme);
  const language = useMapStore((s) => s.language);

  // Sync document theme classes
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Fix Browser Back & Hash Navigation
  useEffect(() => {
    const handleHashOrPop = () => {
      const hash = window.location.hash;
      if (!hash || hash === '#' || hash === '') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const target = document.querySelector(hash);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    window.addEventListener('hashchange', handleHashOrPop);
    window.addEventListener('popstate', handleHashOrPop);

    // Initial check on mount if hash was present
    if (window.location.hash) {
      setTimeout(handleHashOrPop, 100);
    }

    return () => {
      window.removeEventListener('hashchange', handleHashOrPop);
      window.removeEventListener('popstate', handleHashOrPop);
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col bg-[#FAF9F6] dark:bg-[#07110E] text-slate-900 dark:text-slate-100 transition-colors duration-200 overflow-x-clip selection:bg-emerald-500 selection:text-white pt-16">
        <HomeNavbar />
        <main className="flex-1">
          <HeroSection language={language} />
          <MissionSection language={language} />
          <StatsStrip language={language} />
          <DivisionExplorer language={language} />
          <FeaturesGrid language={language} />
          <RoadmapSection language={language} />
        </main>
        <HomeFooter />
      </div>
    </MotionConfig>
  );
}
