'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Pause, Play } from 'lucide-react';
import { motion } from 'motion/react';
import type { Language } from '@/types';
import { cn } from '@/lib/utils';
import AparajeyoPinLogo from './AparajeyoPinLogo';

interface HeroSectionProps {
  language: Language;
}

export default function HeroSection({ language }: HeroSectionProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Imperative video autoplay & hydration fix
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Resolve React/Next.js hydration muted quirk
    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;

    const attemptPlay = () => {
      const promise = video.play();
      if (promise !== undefined) {
        promise
          .then(() => {
            setIsPlaying(true);
          })
          .catch(() => {
            setIsPlaying(false);
          });
      }
    };

    if (video.readyState >= 2) {
      attemptPlay();
    } else {
      video.addEventListener('loadeddata', attemptPlay, { once: true });
      video.addEventListener('canplay', attemptPlay, { once: true });
    }

    return () => {
      video.removeEventListener('loadeddata', attemptPlay);
      video.removeEventListener('canplay', attemptPlay);
    };
  }, []);

  const togglePlayPause = () => {
    if (videoRef.current && !videoFailed) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <section className="relative min-h-[calc(100vh-4rem)] w-full overflow-hidden flex items-center bg-[#07110E] text-white py-16 sm:py-24">
      {/* ─── Layer 0: HTML5 Video & Bulletproof Animated SVG Fallback ─── */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* HTML5 Cinematic Video Element */}
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/media/hero-bangladesh-poster.jpg"
          aria-hidden="true"
          onError={() => setVideoFailed(true)}
          className={cn(
            'absolute inset-0 h-full w-full object-cover scale-[1.02] transition-opacity duration-1000',
            videoFailed ? 'opacity-0' : 'opacity-100'
          )}
        >
          <source src="/media/hero-bangladesh.mp4" type="video/mp4" />
          <source
            src="/media/hero-bangladesh.webm"
            type="video/webm"
            onError={() => setVideoFailed(true)}
          />
        </video>

        {/* Animated Rich Sundarbans Pine & Aerial Contour Fallback */}
        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-br from-[#003E2E] via-[#041913] to-[#07110E] transition-opacity duration-1000',
            videoFailed ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          <motion.div
            animate={
              isPlaying
                ? {
                    scale: [1, 1.06, 1],
                    x: [0, -15, 0],
                    y: [0, -10, 0],
                  }
                : {}
            }
            transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 w-full h-full opacity-35"
          >
            <svg
              viewBox="0 0 1600 900"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full object-cover"
            >
              <defs>
                <radialGradient id="deltaGlow" cx="800" cy="450" r="600" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#005A43" stopOpacity="0.4" />
                  <stop offset="0.6" stopColor="#04140F" stopOpacity="0.2" />
                  <stop offset="1" stopColor="#07110E" stopOpacity="0" />
                </radialGradient>
              </defs>

              <rect width="1600" height="900" fill="url(#deltaGlow)" />

              {/* Flowing Braided River Delta Curves (Padma, Meghna, Jamuna) */}
              <path
                d="M 500 -50 C 580 150 540 280 680 420 C 760 500 840 560 880 720 C 920 860 960 950 1020 1000"
                stroke="rgba(52, 211, 153, 0.4)"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 520 -50 C 600 160 565 290 710 435 C 790 515 880 575 920 735 C 955 870 1000 960 1060 1000"
                stroke="rgba(56, 189, 248, 0.28)"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 850 100 C 820 220 780 320 720 400 C 660 480 610 580 620 720 C 630 840 680 950 720 1000"
                stroke="rgba(16, 185, 129, 0.3)"
                strokeWidth="3"
                strokeDasharray="6 4"
                fill="none"
              />

              {/* Distributary branches and mangrove estuaries */}
              <path
                d="M 680 420 C 600 480 520 540 480 680 C 450 780 470 900 480 1000"
                stroke="rgba(52, 211, 153, 0.25)"
                strokeWidth="2"
                fill="none"
              />
              <path
                d="M 880 720 C 980 760 1100 820 1180 920"
                stroke="rgba(52, 211, 153, 0.2)"
                strokeWidth="2"
                fill="none"
              />

              {/* Bangladesh Geographic Vector Contour */}
              <path
                d="M 640 180 L 760 210 L 850 310 L 810 390 L 890 500 L 980 600 L 930 730 L 870 810 L 760 840 L 670 920 L 580 880 L 540 760 L 480 680 L 510 550 L 460 440 L 530 330 L 610 280 Z"
                stroke="rgba(52, 211, 153, 0.3)"
                strokeWidth="1.8"
                strokeDasharray="5 5"
                fill="rgba(0, 90, 67, 0.08)"
              />

              {/* Pulsing Coordinates Halo around Dhaka */}
              <circle cx="730" cy="520" r="12" fill="#D93829" opacity="0.85" />
              <circle cx="730" cy="520" r="36" stroke="#D93829" strokeWidth="1.2" opacity="0.5" />
              <circle cx="730" cy="520" r="70" stroke="rgba(52, 211, 153, 0.3)" strokeWidth="1" strokeDasharray="3 3" />
            </svg>
          </motion.div>
        </div>
      </div>

      {/* ─── Layer 1: Two-Layer Bengal Emerald Broadcast Overlay ─── */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* 1. Directional Emerald Wash: deep on the left for text contrast, translucent on the right for skyline visibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#00291E]/80 via-[#003E2E]/55 to-[#004D39]/32" />

        {/* 2. Subtle Top/Bottom Vignette for smooth navbar and section transitions */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#04140F]/40 via-transparent to-[#04140F]/55" />

        {/* 3. Subtle Halftone Dot-Matrix Pattern */}
        <div
          className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255, 255, 255, 0.22) 1px, transparent 1px)',
            backgroundSize: '5px 5px',
          }}
        />
      </div>

      {/* ─── Layer 2: Clean Full-Bleed Editorial Left-Aligned Lockup ─── */}
      <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12 sm:py-16 flex flex-col items-start text-left space-y-6 sm:space-y-8">
        {/* Oversized Pin + Stacked Display Typography Lockup */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-start gap-6 sm:gap-8 pt-1">
          {/* Custom Oversized Bangladesh Pin Emblem */}
          <AparajeyoPinLogo />

          {/* Bold Stacked Typography */}
          <div className="flex flex-col text-left">
            {language === 'bn' ? (
              <>
                <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-emerald-300/90 mb-1">
                  Aparajeyo Bangla
                </span>
                <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-extrabold tracking-tight text-white font-bangla drop-shadow-[0_4px_24px_rgba(0,0,0,0.7)] leading-[1.08]">
                  অপরাজেয়<br />
                  বাংলা
                </h1>
              </>
            ) : (
              <>
                <span className="text-sm sm:text-base font-semibold text-emerald-300 font-bangla tracking-wider mb-1">
                  অপরাজেয় বাংলা
                </span>
                <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-extrabold tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.7)] leading-[1.02]">
                  Aparajeyo<br />
                  Bangla{' '}
                  <span className="text-[#D93829] inline-block font-sans drop-shadow-[0_0_14px_rgba(217,56,41,0.8)]">
                    •
                  </span>{' '}
                  <span className="text-white/80 font-mono text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-light">
                    bd
                  </span>
                </h1>
              </>
            )}
          </div>
        </div>

        {/* Official Slogan (Directly Above Action Buttons with Zero Extra Paragraph) */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-base sm:text-lg lg:text-xl font-bold text-emerald-200 leading-snug drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)] max-w-none text-left sm:whitespace-nowrap"
        >
          {language === 'bn'
            ? 'অপরাজেয় বাংলা: সচেতন ও স্মার্ট বাংলাদেশের পথে।'
            : 'Aparajeyo Bangla: Empowering a Smarter Bangladesh.'}
        </motion.p>

        {/* Quick Action CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-wrap items-center justify-start gap-4 pt-2"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm text-white shadow-2xl transition-all duration-200 active:scale-95 bg-[#D93829] hover:bg-[#B6281B] border border-red-400/30 cursor-pointer"
          >
            <span>{language === 'bn' ? 'সরাসরি মানচিত্রে যান →' : 'Launch Live Map →'}</span>
          </Link>

          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl font-semibold text-sm border border-white/20 bg-black/35 hover:bg-black/55 text-white backdrop-blur-md transition-colors cursor-pointer"
          >
            <span>{language === 'bn' ? 'ব্যবহারবিধি জানুন' : 'How It Works'}</span>
          </a>
        </motion.div>
      </div>

      {/* ─── Layer 3: Subtle Glassmorphic Pause / Play Button (Relocated to bottom-6 right-6) ─── */}
      <div className="absolute bottom-6 right-6 z-20">
        <button
          onClick={togglePlayPause}
          aria-label={isPlaying ? 'Pause background video' : 'Play background video'}
          title={isPlaying ? 'Pause background video' : 'Play background video'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-black/45 hover:bg-black/65 text-white/80 hover:text-white backdrop-blur-md text-xs font-medium transition-all shadow-lg select-none cursor-pointer"
        >
          {isPlaying ? <Pause size={13} /> : <Play size={13} />}
          <span>{isPlaying ? (language === 'bn' ? 'বিরতি' : 'Pause') : (language === 'bn' ? 'প্লে' : 'Play')}</span>
        </button>
      </div>
    </section>
  );
}
