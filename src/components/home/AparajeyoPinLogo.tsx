'use client';

import React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface AparajeyoPinLogoProps {
  className?: string;
}

export default function AparajeyoPinLogo({ className }: AparajeyoPinLogoProps) {
  return (
    <motion.div
      initial={{ scale: 0.8, y: -20, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 16 }}
      whileHover={{ scale: 1.06, rotate: -2, transition: { duration: 0.2 } }}
      className={cn(
        'relative shrink-0 select-none cursor-pointer filter drop-shadow-[0_16px_32px_rgba(0,0,0,0.48)]',
        'w-28 h-28 sm:w-36 sm:h-36 lg:w-44 lg:h-44',
        className
      )}
      title="Aparajeyo Bangla Emblem"
    >
      <svg
        viewBox="0 0 100 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          {/* Subtle gradient for white outer pin chassis */}
          <linearGradient id="pinChassis" x1="50" y1="6" x2="50" y2="114" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="0.75" stopColor="#F8FAFC" />
            <stop offset="1" stopColor="#E2E8F0" />
          </linearGradient>

          {/* Deep Bengal Emerald Field */}
          <radialGradient id="emeraldHead" cx="48" cy="40" r="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#007A5A" />
            <stop offset="0.6" stopColor="#005A43" />
            <stop offset="1" stopColor="#003E2E" />
          </radialGradient>

          {/* Surjo Crimson Sun Disc */}
          <radialGradient id="crimsonSun" cx="45" cy="40" r="15" gradientUnits="userSpaceOnUse">
            <stop stopColor="#EF4444" />
            <stop offset="0.7" stopColor="#D93829" />
            <stop offset="1" stopColor="#B6281B" />
          </radialGradient>

          {/* Soft inner shadow ring for the circular inset */}
          <filter id="innerDepth" x="14" y="6" width="72" height="72" filterUnits="userSpaceOnUse">
            <feOffset dx="0" dy="2" />
            <feGaussianBlur stdDeviation="2" result="offset-blur" />
            <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
            <feFlood floodColor="black" floodOpacity="0.3" result="color" />
            <feComposite operator="in" in="color" in2="inverse" result="shadow" />
            <feComposite operator="over" in="shadow" in2="SourceGraphic" />
          </filter>
        </defs>

        {/* Outer White Pin Silhouette */}
        <path
          d="M 50 114 C 47.5 106 14 74 14 42 A 36 36 0 1 1 86 42 C 86 74 52.5 106 50 114 Z"
          fill="url(#pinChassis)"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Inner Circular Well (Bengal Emerald) */}
        <circle
          cx="50"
          cy="42"
          r="29"
          fill="url(#emeraldHead)"
        />

        {/* Radar / Signal Ripple Ring (Subtle pulsing broadcast wave) */}
        <circle
          cx="50"
          cy="42"
          r="22"
          stroke="rgba(52, 211, 153, 0.45)"
          strokeWidth="1.2"
          strokeDasharray="3 3"
          className="animate-[spin_20s_linear_infinite]"
        />

        {/* Outer Signal Ripple Ring */}
        <circle
          cx="50"
          cy="42"
          r="26"
          stroke="rgba(16, 185, 129, 0.25)"
          strokeWidth="1"
        />

        {/* Surjo Crimson Sun Disc (Slightly off-center to 46, reflecting Bangladesh flag geometry) */}
        <circle
          cx="46"
          cy="42"
          r="14"
          fill="url(#crimsonSun)"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="0.8"
        />

        {/* High-tech centroid dot inside the red sun */}
        <circle
          cx="46"
          cy="42"
          r="2.5"
          fill="#FFFFFF"
          opacity="0.95"
        />

        {/* Subtle glossy glass highlight on top arc */}
        <path
          d="M 28 32 C 34 22 56 20 70 28"
          stroke="rgba(255, 255, 255, 0.4)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </motion.div>
  );
}
