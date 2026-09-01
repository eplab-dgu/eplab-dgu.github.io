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
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABS } from './cms-schema.js';
// 헤더 매핑은 xlsx 경로와 **똑같은 함수**를 쓴다. 두 소스가 다르게 해석하면
// 소스를 바꿨을 때 이유 없이 내용이 달라진다.
import { gridToObjects } from './xlsx-source.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const CACHE_DIR = join(ROOT, 'data-cache');
export { TABS };

export { gridToObjects };

/**
 * data-cache/*.json 로드 — Sheets API 장애 시의 폴백.
 *
 * 이 캐시는 `npm run cache:refresh` 가 시트에서 갱신한다. 갱신을 안 하면
 * 옛 내용이 배포되므로, _manifest.json 의 생성 시각을 함께 돌려준다.
 * 부르는 쪽이 "얼마나 오래된 데이터인지" 로그에 남길 수 있어야 한다.
 */
export function loadFromCache() {
  const presentTabs = existsSync(CACHE_DIR)
    ? readdirSync(CACHE_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_')).map((f) => f.slice(0, -5))
    : [];

  let generatedAt = null;
  try {
    generatedAt = JSON.parse(readFileSync(join(CACHE_DIR, '_manifest.json'), 'utf8')).generatedAt ?? null;
  } catch { /* 매니페스트가 없어도 캐시 자체는 쓸 수 있다 */ }

  const data = {};
  for (const tab of TABS) {
    const file = join(CACHE_DIR, `${tab}.json`);
    if (!existsSync(file)) continue;
    try {
      const rows = JSON.parse(readFileSync(file, 'utf8'));
      data[tab] = { headers: Object.keys(rows[0] ?? {}), rows };
    } catch (err) {
      console.warn(`  [cms] 캐시 파싱 실패: ${tab}.json (${err.message}) — 빈 탭으로 처리`);
      data[tab] = { headers: [], rows: [] };
    }
  }
  return { presentTabs, data, generatedAt };
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
