'use client';

import dynamic from 'next/dynamic';

const MapShell = dynamic(() => import('@/components/MapShell'), {
  ssr: false,
  loading: () => (
    <div className="w-screen h-screen flex items-center justify-center bg-bg-primary">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-text-secondary text-sm font-medium">Loading Aparajeyo Bangla…</p>
        <p className="text-text-muted text-xs mt-1 font-bangla">অপরাজেয় বাংলা লোড হচ্ছে…</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return <MapShell />;
}
