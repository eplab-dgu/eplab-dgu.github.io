/**
 * sheets-source.js — Google Sheets API 원시 로더.
 *
 * 현재 빌드는 이걸 쓰지 않는다. 빌드의 데이터 소스는 cms.js 의 xlsx 어댑터다.
 * 이 파일이 남아 있는 이유는 둘:
 *   1. `npm run cache:refresh` (scripts/sheets-to-cache.js) 가 쓴다.
 *   2. Phase 4 에서 cms.js 의 `loadRawTabs()` 를 이걸로 갈아끼우면 소스 전환이 끝난다.
 *      반환 형태를 cms.js 의 계약과 일부러 동일하게 맞춰 뒀다.
 *
 * 반환 형태: { presentTabs: string[], data: { [tab]: { headers, rows } } }
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABS } from './cms-schema.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const CACHE_DIR = join(ROOT, 'data-cache');
export { TABS };

/** 시트 2차원 배열 → 헤더 이름 매핑 객체 배열 (열 순서 무관) */
export function gridToObjects(grid) {
  if (!grid || grid.length === 0) return { headers: [], rows: [] };

  const headerRow = (grid[0] ?? []).map((h) => String(h ?? '').trim());
  const headers = headerRow.filter(Boolean);

  const rows = grid.slice(1).flatMap((row) => {
    const obj = {};
    let hasValue = false;
    headerRow.forEach((header, i) => {
      if (!header) return;
      const cell = String(row?.[i] ?? '').trim();
      obj[header] = cell;
      if (cell) hasValue = true;
    });
    return hasValue ? [obj] : [];
  });

  return { headers, rows };
}

/**
 * Sheets API 로드. **탭을 통째로 요청하지 않는다.**
 * 먼저 메타데이터로 실재하는 탭을 조회한 뒤 교집합만 batchGet 한다.
 * 그러지 않으면 학생이 탭 하나 이름만 바꿔도 batchGet 전체가 400 으로 실패해
 * 사이트 전부가 폴백으로 내려간다. (탭 단위 격리)
 */
export async function loadFromSheetsApi(sheetId, serviceAccountJson) {
  const { google } = await import('googleapis');
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(serviceAccountJson),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: 'sheets.properties.title',
  });
  const presentTabs = (meta.data.sheets ?? []).map((s) => s.properties?.title).filter(Boolean);

  const wanted = TABS.filter((tab) => presentTabs.includes(tab));
  const data = {};

  if (wanted.length > 0) {
    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: sheetId,
      ranges: wanted.map((tab) => `${tab}!A1:Z2000`),
      majorDimension: 'ROWS',
    });
    (res.data.valueRanges ?? []).forEach((range, i) => {
      data[wanted[i]] = gridToObjects(range.values);
    });
  }

  return { presentTabs, data };
}
