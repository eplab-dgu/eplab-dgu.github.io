/**
 * sheets-to-cache — Google Sheet 의 현재 내용을 data-cache/*.json 으로 갱신한다.
 *
 * 왜 필요한가: data-cache/ 는 Sheets API 장애 시 폴백으로 쓰인다. 그런데 이 캐시를
 * 만드는 유일한 수단이 xlsx 덤프(scripts/xlsx-to-json.js)뿐이면, 시트 운영이 시작된 뒤
 * 캐시는 Phase 1 시점에 멈춰 있게 된다. 그 상태로 API 가 죽으면 빌드는 성공하지만
 * **몇 달 전 내용이 조용히 배포된다** — 빌드 실패보다 나쁘다.
 *
 * 그래서 배포 파이프라인은 빌드 성공 시마다 이 스크립트로 캐시를 갱신하고 커밋해야 한다.
 *
 *   npm run cache:refresh
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import 'dotenv/config';
import { TABS, CACHE_DIR, loadFromSheetsApi } from '../src/_data/sheets-source.js';

const sheetId = process.env.SHEET_ID;
const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

if (!sheetId || !serviceAccountJson) {
  console.error('SHEET_ID / GOOGLE_SERVICE_ACCOUNT_JSON 이 필요하다. .env 또는 CI Secrets 를 확인할 것.');
  console.error('(로컬 목업만 쓰는 단계라면 이 스크립트는 실행할 필요가 없다.)');
  process.exit(1);
}

const { presentTabs, data } = await loadFromSheetsApi(sheetId, serviceAccountJson);
mkdirSync(CACHE_DIR, { recursive: true });

const manifest = {};
for (const tab of TABS) {
  const entry = data[tab];
  if (!entry) {
    // 탭이 시트에 없다. 기존 캐시를 지우지 않는다 — 실수로 이름을 바꾼 경우
    // 폴백까지 같이 날아가면 복구 수단이 없어진다.
    console.warn(`  WARN  ${tab}: 시트에 없음 — 기존 캐시 파일을 그대로 둔다`);
    continue;
  }
  writeFileSync(join(CACHE_DIR, `${tab}.json`), JSON.stringify(entry.rows, null, 2) + '\n', 'utf8');
  manifest[tab] = { rows: entry.rows.length, headers: entry.headers };
  console.log(`  ok    ${tab.padEnd(18)} ${String(entry.rows.length).padStart(3)} rows`);
}

writeFileSync(
  join(CACHE_DIR, '_manifest.json'),
  JSON.stringify(
    // SHEET_ID 는 넣지 않는다. .env 로 커밋에서 빼는 값인데 캐시 매니페스트로 새면
    // 앞뒤가 안 맞는다 (캐시는 저장소에 커밋된다).
    { source: 'google-sheets', generatedAt: new Date().toISOString(), presentTabs, sheets: manifest },
    null,
    2
  ) + '\n',
  'utf8'
);

console.log(`\n캐시 갱신 완료 → data-cache/ (${Object.keys(manifest).length}개 탭, source=google-sheets)`);
