export const SHEET_ID = '1uZJ9fUZFX-WD4RVVvHb9cXZjCzZU_2jvtVMpEw07HAM';
// HTTP referrer restriction recommended in Google Cloud Console
export const GOOGLE_MAPS_API_KEY = 'AIzaSyA65u85mjtLfP9flcwA9RmU5xzuEQdmROE';
export const SHEET_GID = '0';
export const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
export const FB_GROUP_URL = 'https://www.facebook.com/groups/296655063832420';

export interface EventRow {
  kai: number;
  date: string;
  storeName: string;
  tabelog: string;
  instagram: string;
  youtube: string;
  googleReview: string;
  address: string;
  notes: string;
  fbPostUrl: string;
}

/**
 * ごく小さいCSVパーサ。ダブルクオート内のカンマ・改行・エスケープに対応。
 * 外部依存を持ち込まないためここで実装する。
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (c === '\r') {
        // skip
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function toInt(s: string): number | null {
  const n = parseInt(s.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * ビルド時にスプレッドシートを取得してイベント行を返す。
 * Astroのフロントマター（top-level await）で利用する。
 */
export async function fetchEvents(): Promise<EventRow[]> {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) {
    throw new Error(`シート取得失敗: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const header = rows[0];
  const idx = (candidates: string[]): number => {
    for (const c of candidates) {
      const i = header.findIndex((h) => h && h.includes(c));
      if (i >= 0) return i;
    }
    return -1;
  };

  const cKai = idx(['回']);
  const cDate = idx(['開催日', '日付']);
  const cStore = idx(['店名', '店']);
  const cTabelog = idx(['食べログ']);
  const cInsta = idx(['Instagram', 'インスタ']);
  const cYt = idx(['Youtube', 'YouTube']);
  const cGoogle = idx(['Google', 'グーグル', 'google口コミ', 'google']);
  const cAddr = idx(['住所']);
  const cNotes = idx(['特徴', 'メモ']);
  const cFb = idx(['FB投稿URL', 'FB']);

  const events: EventRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r.some((x) => x && x.trim().length > 0)) continue;
    const kai = cKai >= 0 ? toInt(r[cKai] ?? '') : null;
    if (kai === null) continue;
    events.push({
      kai,
      date: (cDate >= 0 ? r[cDate] ?? '' : '').trim(),
      storeName: (cStore >= 0 ? r[cStore] ?? '' : '').trim(),
      tabelog: (() => { const v = (cTabelog >= 0 ? r[cTabelog] ?? '' : '').trim(); return v.startsWith('http') ? v : ''; })(),
      instagram: (() => { const v = (cInsta >= 0 ? r[cInsta] ?? '' : '').trim(); return v.startsWith('http') ? v : ''; })(),
      youtube: (() => { const v = (cYt >= 0 ? r[cYt] ?? '' : '').trim(); return v.startsWith('http') ? v : ''; })(),
      googleReview: (() => { const v = (cGoogle >= 0 ? r[cGoogle] ?? '' : '').trim(); return v.startsWith('http') ? v : ''; })(),
      address: (cAddr >= 0 ? r[cAddr] ?? '' : '').trim(),
      notes: (cNotes >= 0 ? r[cNotes] ?? '' : '').trim(),
      fbPostUrl: (cFb >= 0 ? r[cFb] ?? '' : '').trim(),
    });
  }
  events.sort((a, b) => b.kai - a.kai);
  return events;
}
