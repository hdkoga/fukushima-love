import postsByKai from '../data/posts_by_kai.json';
import instagramPostsRaw from '../data/instagram_posts.json';
import youtubeUrlsRaw from '../data/youtube_urls.json';
import geocodeCache from '../data/geocode_cache.json';
import photosManifestRaw from '../data/photos_manifest.json';
import sheetUrlsRaw from '../data/sheet_urls.json';
import ogpCacheRaw from '../data/ogp_cache.json';
import tabelogCacheRaw from '../data/tabelog_cache.json';
import googlePlaceCacheRaw from '../data/google_place_cache.json';
import type { EventRow } from './sheet';
import { fetchEvents } from './sheet';

export interface PostInfo {
  post_id: string;
  post_url: string;
  date_label?: string;
  text_snippet?: string;
}

export interface GeocodeInfo {
  lat: number | null;
  lon: number | null;
  display_name?: string | null;
  status?: string;
}

export interface PhotoInfo {
  files: string[];
  post_url?: string;
  processed_at?: string;
}

export interface OgpInfo {
  title: string;
  image: string;
  description: string;
}

export interface TabelogInfo {
  score: string;
  photos: string[];
}

export interface GoogleReview {
  author: string;
  rating: number | null;
  text: string;
  relative_time: string;
}

export interface GoogleOpeningHours {
  weekday_descriptions: string[];
  open_now?: boolean | null;
}

export type GooglePriceLevel =
  | 'PRICE_LEVEL_FREE'
  | 'PRICE_LEVEL_INEXPENSIVE'
  | 'PRICE_LEVEL_MODERATE'
  | 'PRICE_LEVEL_EXPENSIVE'
  | 'PRICE_LEVEL_VERY_EXPENSIVE';

export interface GooglePlaceInfo {
  place_id: string;
  name: string;
  rating: number | null;
  user_rating_count: number | null;
  reviews: GoogleReview[];
  photos: string[];
  opening_hours?: GoogleOpeningHours | null;
  price_level?: GooglePriceLevel | string | null;
  phone?: string | null;
  website?: string | null;
  business_status?: string | null;
}

export interface EnrichedEvent extends EventRow {
  post: PostInfo | null;
  geocode: GeocodeInfo | null;
  photos: string[];
  tabelogOgp: OgpInfo | null;
  tabelogInfo: TabelogInfo | null;
  googlePlaceInfo: GooglePlaceInfo | null;
  instagramPostUrl: string;
}

const postsMap: Record<string, PostInfo> = postsByKai as Record<string, PostInfo>;
const geoMap: Record<string, GeocodeInfo> = geocodeCache as Record<string, GeocodeInfo>;
const photosMap: Record<string, PhotoInfo> = photosManifestRaw as Record<string, PhotoInfo>;
const sheetUrls: Record<string, { tabelog?: string; instagram?: string; youtube?: string; googleReview?: string }> = sheetUrlsRaw as Record<string, { tabelog?: string; instagram?: string; youtube?: string; googleReview?: string }>;
const ogpCache: Record<string, OgpInfo> = ogpCacheRaw as Record<string, OgpInfo>;
const tabelogCache: Record<string, TabelogInfo> = tabelogCacheRaw as Record<string, TabelogInfo>;
const googlePlaceCache: Record<string, GooglePlaceInfo | null> = googlePlaceCacheRaw as Record<string, GooglePlaceInfo | null>;
const instagramPosts: Record<string, string> = instagramPostsRaw as Record<string, string>;
const youtubeUrls: Record<string, string> = youtubeUrlsRaw as Record<string, string>;

export async function getEnrichedEvents(): Promise<EnrichedEvent[]> {
  const events = await fetchEvents();
  return events.map((e) => {
    const post = postsMap[String(e.kai)] ?? null;
    // シートI列（fbPostUrl）があればそれを優先、なければpostsMap
    const fbFromSheet = e.fbPostUrl && e.fbPostUrl.includes('facebook.com') ? e.fbPostUrl : '';
    const mergedPost: PostInfo | null = fbFromSheet
      ? { post_id: '', post_url: fbFromSheet, ...(post ?? {}) }
      : post;
    const geocode = e.address ? geoMap[e.address] ?? null : null;
    const photoRecord = photosMap[String(e.kai)];
    const photos = (photoRecord?.files ?? [])
      .filter((f) => !f.startsWith('00_'))
      .map((f) => `/photos/${e.kai}/${f}`);
    const urls = sheetUrls[String(e.kai)] ?? {};
    const q = encodeURIComponent(e.storeName + (e.address ? ' ' + e.address : ''));
    const googleReview = e.googleReview || urls.googleReview ||
      (e.storeName ? `https://maps.google.com/maps?q=${q}` : '');
    const tabelog = e.tabelog || urls.tabelog || '';
    const instagram = e.instagram || urls.instagram || '';
    const youtube = e.youtube || urls.youtube || '';
    const tabelogOgp = (tabelog && ogpCache[String(e.kai)]?.image) ? ogpCache[String(e.kai)] : null;
    const rawTabelog = tabelogCache[String(e.kai)];
    const tabelogInfo = (tabelog && rawTabelog?.photos?.length) ? rawTabelog : null;
    const rawGooglePlace = googlePlaceCache[String(e.kai)];
    const googlePlaceInfo = (rawGooglePlace && (rawGooglePlace.rating || rawGooglePlace.reviews?.length || rawGooglePlace.photos?.length)) ? rawGooglePlace : null;
    const instagramPostUrl = instagramPosts[String(e.kai)] ?? '';
    const youtubeUrl = youtubeUrls[String(e.kai)] ?? youtube;
    return { ...e, googleReview, tabelog, instagram, youtube: youtubeUrl, post: mergedPost, geocode, photos, tabelogOgp, tabelogInfo, googlePlaceInfo, instagramPostUrl };
  });
}

export function formatDate(s: string): string {
  // 「2026/4/25」「2026-04-25」「2026年4月25日」等を緩く統一
  const m = s.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
  if (!m) return s;
  const [, y, mo, d] = m;
  return `${y}年${mo}月${d}日`;
}

export interface CategoryMeta {
  label: string;
  icon: string;
  color: string;
  cssClass: string;
}

export function categoryMeta(notes: string): CategoryMeta {
  if (notes && /出身|出生|福島県.*生まれ/.test(notes)) {
    return { label: '店主が福島出身', icon: '🏔️', color: '#e63329', cssClass: 'cat-origin' };
  }
  if (notes && /福島料理|郷土|いわき料理|会津料理/.test(notes)) {
    return { label: '福島料理', icon: '🍶', color: '#2bb673', cssClass: 'cat-cuisine' };
  }
  return { label: 'その他の福島縁', icon: '🌸', color: '#4a8df5', cssClass: 'cat-other' };
}

export function categoryFromNotes(notes: string): string {
  if (!notes) return 'その他';
  return categoryMeta(notes).label;
}

export function cleanSnippet(text: string | undefined | null): string {
  if (!text) return '';
  let s = text;

  // 先頭の投稿者行（名前 + バッジ + 日付）を除去
  s = s.replace(/^.{0,60}?(?:管理者|グループエキスパート|トップコントリビューター|副管理者|モデレーター).{0,80}?·\s*/u, '');

  // コメント・リアクション以降を切り捨て
  s = s
    .replace(/\s*もっと見る[\s\S]*/u, '')
    .replace(/\s*さらに表示[\s\S]*/u, '')
    .replace(/\s*\d+件以上[\s\S]*/u, '')
    .replace(/\s*いいね！[\s\S]*/u, '')
    .replace(/\s*公開コメントを入力[\s\S]*/u, '')
    .replace(/\s*See [Mm]ore[\s\S]*/u, '');

  // 残留バッジ語・記号の除去
  s = s
    .replace(/(管理者|副管理者|モデレーター|グループエキスパート|トップコントリビューター)/gu, '')
    .replace(/·/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[\s\u00a0]+$/u, '')
    .trim();

  return s;
}

export function priceLevelToYen(level: string | null | undefined): string | null {
  if (!level) return null;
  const map: Record<string, string> = {
    PRICE_LEVEL_FREE: '無料',
    PRICE_LEVEL_INEXPENSIVE: '￥',
    PRICE_LEVEL_MODERATE: '￥￥',
    PRICE_LEVEL_EXPENSIVE: '￥￥￥',
    PRICE_LEVEL_VERY_EXPENSIVE: '￥￥￥￥',
  };
  return map[level] ?? null;
}
