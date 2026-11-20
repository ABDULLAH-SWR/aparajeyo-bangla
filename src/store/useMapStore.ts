import { create } from 'zustand';
import type { MapLayerType, Theme, Language, NewsCategory } from '@/types';

interface MapState {
  selectedDistrictCode: string | null;
  hoveredDistrictCode: string | null;
  activeLayers: Set<MapLayerType>;
  theme: Theme;
  language: Language;
  activeNewsCategory: NewsCategory;
  searchQuery: string;
  isPriorityModalOpen: boolean;
  isDrawerOpen: boolean;
  drawerActiveTab: 'priority' | 'news' | 'info';

  setSelectedDistrict: (code: string | null) => void;
  setHoveredDistrict: (code: string | null) => void;
  toggleLayer: (layer: MapLayerType) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  setActiveNewsCategory: (cat: NewsCategory) => void;
  setSearchQuery: (q: string) => void;
  setIsPriorityModalOpen: (open: boolean) => void;
  setDrawerActiveTab: (tab: 'priority' | 'news' | 'info') => void;
  openDrawer: (districtCode: string, tab?: 'priority' | 'news' | 'info') => void;
  closeDrawer: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  selectedDistrictCode: null,
  hoveredDistrictCode: null,
  activeLayers: new Set<MapLayerType>(['priority', 'news', 'civic']),
  theme: 'dark',
  language: 'en',
  activeNewsCategory: 'All',
  searchQuery: '',
  isPriorityModalOpen: false,
  isDrawerOpen: false,
  drawerActiveTab: 'priority',

  setSelectedDistrict: (code) => set({ selectedDistrictCode: code }),
  setHoveredDistrict: (code) => set({ hoveredDistrictCode: code }),
  toggleLayer: (layer) =>
    set((state) => {
      const next = new Set(state.activeLayers);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return { activeLayers: next };
    }),
  setTheme: (theme) => set({ theme }),
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  setLanguage: (language) => set({ language }),
  toggleLanguage: () =>
    set((state) => ({ language: state.language === 'en' ? 'bn' : 'en' })),
  setActiveNewsCategory: (cat) => set({ activeNewsCategory: cat }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setIsPriorityModalOpen: (open) => set({ isPriorityModalOpen: open }),
  setDrawerActiveTab: (tab) => set({ drawerActiveTab: tab }),
  openDrawer: (districtCode, tab = 'priority') =>
    set({ selectedDistrictCode: districtCode, isDrawerOpen: true, drawerActiveTab: tab }),
  closeDrawer: () => set({ isDrawerOpen: false, selectedDistrictCode: null }),
}));
