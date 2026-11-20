import type {
  DistrictSummary, DistrictDetail, PriorityIssue, NewsCluster, NewsCategory, DivisionOverview,
} from '@/types';
import {
  districts, priorityIssues, newsClusters, getCivicInfo,
} from '@/data/mockData';

// Simulate async network delay
const delay = (ms = 80) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Public API ───────────────────────────────────────────────

export async function getAllDistrictSummaries(): Promise<DistrictSummary[]> {
  await delay();
  return districts.map((d) => {
    const priorities = priorityIssues.filter((p) => p.districtCode === d.districtCode && p.isActive);
    const news = newsClusters.filter((n) => n.districtCode === d.districtCode);
    const severityOrder: Record<string, number> = { Critical: 3, High: 2, Advisory: 1 };
    const highest = priorities.reduce<string | null>((acc, p) => {
      if (!acc || severityOrder[p.severity] > severityOrder[acc]) return p.severity;
      return acc;
    }, null);
    return {
      districtCode: d.districtCode,
      nameEn: d.nameEn,
      nameBn: d.nameBn,
      division: d.division,
      activePriorityCount: priorities.length,
      newsCount: news.length,
      highestSeverity: highest as DistrictSummary['highestSeverity'],
    };
  });
}

export async function getDistrictDetails(districtCode: string): Promise<DistrictDetail | null> {
  await delay();
  const district = districts.find((d) => d.districtCode === districtCode);
  if (!district) return null;
  return {
    district,
    priorities: priorityIssues.filter((p) => p.districtCode === districtCode),
    news: newsClusters.filter((n) => n.districtCode === districtCode),
    civic: getCivicInfo(districtCode),
  };
}

export async function getNationalPriorityIssues(): Promise<PriorityIssue[]> {
  await delay();
  return priorityIssues.filter((p) => p.isActive);
}

export async function searchDistrictsAndNews(
  query: string
): Promise<{ districts: DistrictSummary[]; news: NewsCluster[] }> {
  await delay();
  const q = query.toLowerCase().trim();
  if (!q) return { districts: [], news: [] };

  const matchedDistricts = districts
    .filter(
      (d) =>
        d.nameEn.toLowerCase().includes(q) ||
        d.nameBn.includes(q) ||
        d.division.toLowerCase().includes(q) ||
        d.districtCode.includes(q)
    )
    .map((d) => {
      const priorities = priorityIssues.filter((p) => p.districtCode === d.districtCode && p.isActive);
      const news = newsClusters.filter((n) => n.districtCode === d.districtCode);
      const severityOrder: Record<string, number> = { Critical: 3, High: 2, Advisory: 1 };
      const highest = priorities.reduce<string | null>((acc, p) => {
        if (!acc || severityOrder[p.severity] > severityOrder[acc]) return p.severity;
        return acc;
      }, null);
      return {
        districtCode: d.districtCode,
        nameEn: d.nameEn,
        nameBn: d.nameBn,
        division: d.division,
        activePriorityCount: priorities.length,
        newsCount: news.length,
        highestSeverity: highest as DistrictSummary['highestSeverity'],
      };
    });

  const matchedNews = newsClusters.filter(
    (n) =>
      n.headline.toLowerCase().includes(q) ||
      n.headlineBn.includes(q) ||
      n.summary.toLowerCase().includes(q)
  );

  return { districts: matchedDistricts, news: matchedNews };
}

export async function getNewsByCategory(
  districtCode: string,
  category: NewsCategory
): Promise<NewsCluster[]> {
  await delay();
  const all = newsClusters.filter((n) => n.districtCode === districtCode);
  if (category === 'All') return all;
  return all.filter((n) => n.category === category);
}

export async function getDivisionOverviews(): Promise<DivisionOverview[]> {
  await delay(40);
  const divisionList = [
    { division: 'Dhaka', nameBn: 'ঢাকা', keyDistrictCode: 'dhaka' },
    { division: 'Chattogram', nameBn: 'চট্টগ্রাম', keyDistrictCode: 'chattogram' },
    { division: 'Sylhet', nameBn: 'সিলেট', keyDistrictCode: 'sylhet' },
    { division: 'Rajshahi', nameBn: 'রাজশাহী', keyDistrictCode: 'rajshahi' },
    { division: 'Khulna', nameBn: 'খুলনা', keyDistrictCode: 'khulna' },
    { division: 'Rangpur', nameBn: 'রংপুর', keyDistrictCode: 'rangpur' },
    { division: 'Barishal', nameBn: 'বরিশাল', keyDistrictCode: 'barishal' },
    { division: 'Mymensingh', nameBn: 'ময়মনসিংহ', keyDistrictCode: 'mymensingh' },
  ];

  return divisionList.map((div) => {
    const divDistricts = districts.filter(
      (d) => d.division.toLowerCase() === div.division.toLowerCase()
    );
    const divCodes = new Set(divDistricts.map((d) => d.districtCode));
    const activePriorities = priorityIssues.filter(
      (p) => divCodes.has(p.districtCode) && p.isActive
    );
    const divNews = newsClusters.filter((n) => divCodes.has(n.districtCode));

    return {
      division: div.division,
      nameBn: div.nameBn,
      keyDistrictCode: div.keyDistrictCode,
      districtCount: divDistricts.length,
      activePriorityCount: activePriorities.length,
      topPriority: activePriorities[0],
      latestNews: divNews[0],
    };
  });
}
