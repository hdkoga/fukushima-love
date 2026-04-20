import type { EnrichedEvent } from './data';

export interface GenreStat {
  label: string;
  count: number;
}

export interface LoveKaiStats {
  totalKai: number;
  uniqueStores: number;
  yearsActive: number;
  firstDate: string;
  latestDate: string;
  totalPhotos: number;
  genreBreakdown: GenreStat[];
  repeatStores: number;
  avgGoogleRating: number | null;
}

function parseDate(s: string): Date | null {
  const m = s.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  return Number.isFinite(dt.getTime()) ? dt : null;
}

function formatDateShort(s: string): string {
  const m = s.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
  if (!m) return s;
  const [, y, mo] = m;
  return `${y}.${mo}`;
}

export function computeStats(events: EnrichedEvent[]): LoveKaiStats {
  const totalKai = events.reduce((max, e) => Math.max(max, e.kai), 0);
  const stores = new Set<string>();
  for (const e of events) {
    if (e.storeName) stores.add(e.storeName.trim());
  }
  const uniqueStores = stores.size;

  const dates = events.map((e) => parseDate(e.date)).filter((d): d is Date => d !== null);
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const firstDate = sorted.length ? formatDateShort(events.find((e) => parseDate(e.date)?.getTime() === sorted[0].getTime())?.date ?? '') : '';
  const latestDate = sorted.length ? formatDateShort(events.find((e) => parseDate(e.date)?.getTime() === sorted[sorted.length - 1].getTime())?.date ?? '') : '';
  const yearsActive = sorted.length >= 2
    ? Math.max(1, Math.round(((sorted[sorted.length - 1].getTime() - sorted[0].getTime()) / (1000 * 60 * 60 * 24 * 365.25)) * 10) / 10)
    : 0;

  const totalPhotos = events.reduce((sum, e) => sum + (e.photos?.length ?? 0), 0);

  const genreCount = new Map<string, number>();
  for (const e of events) {
    for (const g of e.tags.genres) {
      if (!g) continue;
      genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
    }
  }
  const genreBreakdown: GenreStat[] = [...genreCount.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const storeCount = new Map<string, number>();
  for (const e of events) {
    const key = e.storeName?.trim();
    if (!key) continue;
    storeCount.set(key, (storeCount.get(key) ?? 0) + 1);
  }
  const repeatStores = [...storeCount.values()].filter((n) => n >= 2).length;

  const ratings = events
    .map((e) => e.googlePlaceInfo?.rating)
    .filter((r): r is number => typeof r === 'number' && r > 0);
  const avgGoogleRating = ratings.length
    ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
    : null;

  return {
    totalKai,
    uniqueStores,
    yearsActive,
    firstDate,
    latestDate,
    totalPhotos,
    genreBreakdown,
    repeatStores,
    avgGoogleRating,
  };
}
