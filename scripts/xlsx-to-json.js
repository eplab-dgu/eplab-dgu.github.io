/**
 * xlsx-to-json — eplab_website_content.xlsx 를 data-cache/*.json 으로 덤프한다.
 *
 * 목적: Sheets API 가 죽었을 때 쓸 **폴백 캐시**를 만든다.
 *       (개발 초기에는 목업 데이터 역할도 했지만, 지금은 빌드가 xlsx 를 직접 읽는다 —
 *        src/_data/cms.js 참고)
 *
 * ⚠️ 파싱은 반드시 src/_data/xlsx-source.js 를 통해서 한다.
 *    예전에는 이 스크립트가 자체 XML 파서를 갖고 있어서, 빌드(SheetJS)와 캐시(자체 파서)가
 *    같은 파일을 다르게 읽을 수 있었다. 갈라지는 지점이 하필 폴백이라 — 평소엔 멀쩡하고
 *    API 가 죽은 날에만 다른 값이 배포되는 — 가장 잡기 어려운 실패가 만들어졌다.
 *    파서는 하나로 유지할 것.
 *
 *   npm run dump
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadFromXlsx } from '../src/_data/xlsx-source.js';
import { CACHE_DIR } from '../src/_data/sheets-source.js';

/** 데이터 탭이 아니라 사용 안내문이므로 덤프에서 제외 */
const SKIP_SHEETS = new Set(['README']);

/**
 * 시트 운영이 시작된 뒤에 이 스크립트를 다시 돌리면 캐시가 xlsx 시점으로 되돌아간다.
 * 그 상태에서 API 가 실패하면 옛 내용이 조용히 배포된다 — 빌드 실패보다 나쁘다.
 * 그래서 덮어쓰기를 막는다.
 */
function assertCacheNotFromSheets(force) {
  const manifestPath = join(CACHE_DIR, '_manifest.json');
  if (force || !existsSync(manifestPath)) return;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (manifest.source !== 'google-sheets') return;

    console.error('중단: data-cache/ 는 이미 Google Sheet 에서 갱신된 상태다.');
    console.error(`       (마지막 갱신: ${manifest.generatedAt})`);
    console.error('');
    console.error('  지금 덮어쓰면 캐시가 xlsx 시점으로 되돌아가고,');
    console.error('  그 상태에서 Sheets API 가 실패하면 옛 내용이 그대로 배포된다.');
    console.error('');
    console.error('  시트에서 캐시를 갱신하려면:  npm run cache:refresh');
    console.error('  그래도 xlsx 로 덮어쓰려면:   npm run dump -- --force');
    process.exit(1);
  } catch {
    // 매니페스트를 못 읽으면 판단 근거가 없으므로 통과시킨다.
  }
}

function main() {
  assertCacheNotFromSheets(process.argv.includes('--force'));

  const { ok, presentTabs, data } = loadFromXlsx((msg) => console.error(`  ERROR ${msg}`));
  if (!ok) {
    console.error('xlsx 를 읽지 못해 덤프를 중단한다. 기존 캐시는 그대로 둔다.');
    process.exit(1);
  }

  mkdirSync(CACHE_DIR, { recursive: true });
  const manifest = {};

  for (const name of presentTabs) {
    if (SKIP_SHEETS.has(name)) {
      console.log(`  skip  ${name} (데이터 탭 아님)`);
      continue;
    }
    const { headers, rows } = data[name] ?? { headers: [], rows: [] };
    if (headers.length === 0) {
      console.warn(`  WARN  ${name}: 헤더가 없다 — 건너뜀`);
      continue;
    }

    writeFileSync(join(CACHE_DIR, `${name}.json`), JSON.stringify(rows, null, 2) + '\n', 'utf8');
    manifest[name] = { rows: rows.length, headers };
    console.log(`  ok    ${name.padEnd(18)} ${String(rows.length).padStart(3)} rows  [${headers.join(', ')}]`);
  }

  writeFileSync(
    join(CACHE_DIR, '_manifest.json'),
    JSON.stringify(
      {
        source: 'xlsx',
        file: 'eplab_website_content.xlsx',
        generatedAt: new Date().toISOString(),
        sheets: manifest,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
  console.log(`\n덤프 완료 → data-cache/ (${Object.keys(manifest).length}개 탭)`);
}

main();
