// ─── Core Type Contracts for Aparajeyo Bangla ─────────────────────────

export type MapLayerType = 'priority' | 'news' | 'civic' | 'flood' | 'citizen';

export type SeverityLevel = 'Critical' | 'High' | 'Advisory';

export type NewsCategory = 'All' | 'Politics' | 'Disaster' | 'Infrastructure' | 'Economy' | 'Crime' | 'Local';

export type Theme = 'dark' | 'light';
export type Language = 'en' | 'bn';

export interface District {
  districtCode: string;
  nameEn: string;
  nameBn: string;
  division: string;
  divisionBn: string;
  lat: number;
  lng: number;
  population?: number;
  area?: number;
}

export interface PriorityIssue {
  id: string;
  districtCode: string;
  title: string;
  titleBn: string;
  description: string;
  descriptionBn: string;
  severity: SeverityLevel;
  source: string;
  sourceUrl?: string;
  timestamp: string;
  isActive: boolean;
  category: NewsCategory;
}

export interface NewsOutletSource {
  name: string;
  nameBn: string;
  url: string;
  logoColor: string;
}

export interface NewsCluster {
  id: string;
  districtCode: string;
  headline: string;
  headlineBn: string;
  summary: string;
  summaryBn: string;
  category: NewsCategory;
  outlets: NewsOutletSource[];
  timestamp: string;
  storyCount: number;
}

export interface CivicInfo {
  districtCode: string;
  overviewEn: string;
  overviewBn: string;
  emergencyNumbers: { label: string; labelBn: string; number: string }[];
  notices: { titleEn: string; titleBn: string; date: string }[];
  adminInfo: { labelEn: string; labelBn: string; value: string; valueBn: string }[];
}

export interface DistrictSummary {
  districtCode: string;
  nameEn: string;
  nameBn: string;
  division: string;
  activePriorityCount: number;
  newsCount: number;
  highestSeverity: SeverityLevel | null;
}

export interface DistrictDetail {
  district: District;
  priorities: PriorityIssue[];
  news: NewsCluster[];
  civic: CivicInfo;
}

export interface MapLayerConfig {
  id: MapLayerType;
  labelEn: string;
  labelBn: string;
  icon: string;
  enabled: boolean;
  comingSoon: boolean;
}

export interface DivisionOverview {
  division: string;
  nameBn: string;
  keyDistrictCode: string;
  districtCount: number;
  activePriorityCount: number;
  topPriority?: PriorityIssue;
  latestNews?: NewsCluster;
}
