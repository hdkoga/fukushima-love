import tabelogCacheRaw from '../data/tabelog_cache.json';
import googlePlaceCacheRaw from '../data/google_place_cache.json';
import genreMappingRaw from '../data/genre_mapping.json';
import tagsOverrideRaw from '../data/tags_override.json';

export type Scene = '通常' | '湘南BBQ' | 'ツアー' | 'リモート' | '特別';

export interface EventTags {
  genres: string[];
  origin: string | null;
  scene: Scene;
}

interface TabelogEntry {
  score?: string;
  photos?: string[];
  genre?: string[];
}
interface GooglePlaceEntry {
  primary_type?: string | null;
  types?: string[];
}
interface OverrideEntry {
  genres?: string[];
  genre?: string[]; // aliasも許容
  origin?: string | null;
  scene?: Scene;
}

const tabelogCache = tabelogCacheRaw as Record<string, TabelogEntry | null>;
const googlePlaceCache = googlePlaceCacheRaw as Record<string, GooglePlaceEntry | null>;
const genreMapping = genreMappingRaw as Record<string, string>;
const tagsOverride = tagsOverrideRaw as Record<string, OverrideEntry>;

// 出身地検出パターン（長いものから順に評価）
const ORIGIN_PATTERNS: Array<[RegExp, string]> = [
  [/会津若松/, '会津若松'],
  [/喜多方/, '喜多方'],
  [/猪苗代/, '猪苗代'],
  [/いわき/, 'いわき'],
  [/浪江/, '浪江'],
  [/相馬/, '相馬'],
  [/楢葉/, '楢葉'],
  [/広野/, '広野'],
  [/葛尾/, '葛尾'],
  [/川内/, '川内'],
  [/双葉/, '双葉'],
  [/福島市/, '福島市'],
  [/白河/, '白河'],
  [/西郷/, '西郷村'],
  [/石川/, '石川'],
  [/伊達/, '伊達'],
  [/矢吹/, '矢吹'],
  [/田村/, '田村'],
  [/会津/, '会津'],
];

export function judgeOrigin(notes: string | undefined | null): string | null {
  if (!notes) return null;
  for (const [pattern, label] of ORIGIN_PATTERNS) {
    if (pattern.test(notes)) return label;
  }
  return null;
}

function normalizeGenre(raw: string): string {
  const mapped = genreMapping[raw];
  if (mapped !== undefined) return mapped; // 空文字も「その他扱い」として意図的許容
  return raw; // マッピングになければ生ジャンルをそのまま
}

export function judgeGenre(kai: number | string): string[] {
  const key = String(kai);

  // 1. 手動補正優先
  const override = tagsOverride[key];
  if (override) {
    const ogGenres = override.genres ?? override.genre;
    if (ogGenres && ogGenres.length > 0) return [...ogGenres];
  }

  const results = new Set<string>();

  // 2. 食べログジャンル
  const tabelog = tabelogCache[key];
  if (tabelog?.genre) {
    for (const g of tabelog.genre) {
      const norm = normalizeGenre(g);
      if (norm) results.add(norm);
    }
  }

  // 3. Google Places primary_type（食べログが空の場合のみ採用）
  if (results.size === 0) {
    const gp = googlePlaceCache[key];
    if (gp?.primary_type) {
      const norm = normalizeGenre(gp.primary_type);
      if (norm) results.add(norm);
    }
    // 補助的に types も見る
    if (results.size === 0 && gp?.types) {
      for (const t of gp.types) {
        const norm = normalizeGenre(t);
        if (norm) {
          results.add(norm);
          break; // 1つ見つかれば十分
        }
      }
    }
  }

  return Array.from(results);
}

export function judgeScene(storeName: string, notes: string | undefined | null): Scene {
  const name = storeName || '';
  const mem = notes || '';
  if (name.includes('海の家') || /湘南/.test(mem)) return '湘南BBQ';
  if (/ツアー|村、|町$/.test(name)) return 'ツアー';
  if (/リモート/.test(name) || /リモート/.test(mem)) return 'リモート';
  return '通常';
}

export function getTags(kai: number | string, storeName: string, notes: string | undefined | null): EventTags {
  const key = String(kai);
  const override = tagsOverride[key] ?? {};
  return {
    genres: judgeGenre(kai),
    origin: override.origin !== undefined ? override.origin : judgeOrigin(notes),
    scene: override.scene ?? judgeScene(storeName, notes),
  };
}
