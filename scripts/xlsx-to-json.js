/**
 * xlsx-to-json — Phase 1 산출물(eplab_website_content.xlsx)을 data-cache/*.json 으로 덤프한다.
 *
 * 목적: Google Sheet 접근(서비스 계정) 없이도 로컬에서 빌드/개발이 가능하도록 목업 데이터를 만든다.
 * 이 캐시는 Sheets API 실패 시 폴백으로도 쓰인다. (src/_data/sheets.js 참고)
 *
 * 원칙: 컬럼 순서가 아니라 **헤더 이름**으로 매핑한다. 학생이 시트에서 열을 옮겨도 안전해야 한다.
 *
 *   npm run dump
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const XLSX_PATH = join(ROOT, 'eplab_website_content.xlsx');
const OUT_DIR = join(ROOT, 'data-cache');

/** 데이터 탭이 아니라 사용 안내문이므로 덤프에서 제외 */
const SKIP_SHEETS = new Set(['README']);

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** XLSX는 한글을 수치 문자 참조(&#50976;)로 저장한다. 명명 엔티티와 함께 디코딩. */
function decodeXml(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (whole, ent) => {
    if (ent[0] === '#') {
      const code = ent[1] === 'x' || ent[1] === 'X'
        ? parseInt(ent.slice(2), 16)
        : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ent in XML_ENTITIES ? XML_ENTITIES[ent] : whole;
  });
}

/** "A1" / "BC12" → 0-based 열 인덱스 */
function colIndex(ref) {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** 셀 하나의 텍스트 값. 빈 셀은 '' 반환. */
function cellText(xml, sharedStrings) {
  const type = xml.match(/\st="([^"]+)"/)?.[1];

  // inlineStr: <is> 안의 모든 <t> 조각을 이어 붙인다 (rich text 대응)
  if (type === 'inlineStr') {
    const is = xml.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? '';
    return decodeXml([...is.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));
  }

  const v = xml.match(/<v>([\s\S]*?)<\/v>/)?.[1];
  if (v === undefined) return '';

  // s: sharedStrings 인덱스. Google Sheets 내보내기는 이 형식을 쓰는 경우가 있다.
  if (type === 's') return sharedStrings[Number(v)] ?? '';
  if (type === 'b') return v === '1' ? 'TRUE' : 'FALSE';
  return decodeXml(v);
}

function parseSharedStrings(files) {
  const raw = files['xl/sharedStrings.xml'];
  if (!raw) return [];
  const xml = strFromU8(raw);
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    decodeXml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''))
  );
}

/** workbook.xml + rels 를 읽어 [{ name, path }] 를 워크북 탭 순서대로 반환 */
function listSheets(files) {
  const wb = strFromU8(files['xl/workbook.xml']);
  const rels = strFromU8(files['xl/_rels/workbook.xml.rels']);

  // 속성 순서(Id/Type/Target)는 생성기마다 다르므로 태그를 먼저 뽑고 속성을 개별 추출한다.
  const relMap = new Map(
    [...rels.matchAll(/<Relationship\s[^>]*\/>/g)].flatMap(([tag]) => {
      const id = tag.match(/\sId="([^"]+)"/)?.[1];
      const target = tag.match(/\sTarget="([^"]+)"/)?.[1];
      if (!id || !target) return [];
      return [[id, target.replace(/^\/?(xl\/)?/, 'xl/')]];
    })
  );

  return [...wb.matchAll(/<sheet\s[^>]*\/>/g)].map((m) => {
    const tag = m[0];
    const name = decodeXml(tag.match(/\sname="([^"]+)"/)?.[1] ?? '');
    const rid = tag.match(/r:id="([^"]+)"/)?.[1];
    return { name, path: relMap.get(rid) };
  });
}

/** 워크시트 XML → 2차원 문자열 배열 (빈 셀은 위치를 유지) */
function sheetToGrid(xml) {
  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const row = [];
    for (const cm of rowMatch[1].matchAll(/<c\s[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)) {
      const cell = cm[0];
      const ref = cell.match(/\sr="([A-Z]+\d+)"/)?.[1];
      row[ref ? colIndex(ref) : row.length] = cell;
    }
    return row;
  });
}

/**
 * 시트 운영이 시작된 뒤에 이 스크립트를 다시 돌리면 캐시가 Phase 1 시점으로 되돌아간다.
 * 그러면 API 장애 시 폴백이 옛 내용을 배포하게 된다. 그래서 덮어쓰기를 막는다.
 */
function assertCacheNotFromSheets(force) {
  const manifestPath = join(OUT_DIR, '_manifest.json');
  if (force || !existsSync(manifestPath)) return;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (manifest.source !== 'google-sheets') return;

    console.error('중단: data-cache/ 는 이미 Google Sheet 에서 갱신된 상태다.');
    console.error(`       (마지막 갱신: ${manifest.generatedAt})`);
    console.error('');
    console.error('  xlsx 는 Phase 1 시점에 동결된 파일이므로, 지금 덮어쓰면 캐시가 과거로 되돌아간다.');
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
  const files = unzipSync(readFileSync(XLSX_PATH));
  const sharedStrings = parseSharedStrings(files);
  mkdirSync(OUT_DIR, { recursive: true });

  const manifest = {};

  for (const { name, path } of listSheets(files)) {
    if (SKIP_SHEETS.has(name)) {
      console.log(`  skip  ${name} (데이터 탭 아님)`);
      continue;
    }
    if (!path || !files[path]) {
      console.warn(`  WARN  ${name}: 워크시트를 찾을 수 없음 (${path}) — 건너뜀`);
      continue;
    }

    const grid = sheetToGrid(strFromU8(files[path]));
    if (grid.length === 0) {
      console.warn(`  WARN  ${name}: 빈 시트 — 건너뜀`);
      continue;
    }

    // 1행 = 헤더. 이름으로 매핑하므로 열 순서가 바뀌어도 안전하다.
    const headers = grid[0].map((c) => (c ? cellText(c, sharedStrings).trim() : ''));

    const rows = [];
    for (const gridRow of grid.slice(1)) {
      const obj = {};
      let hasValue = false;
      headers.forEach((header, i) => {
        if (!header) return; // 헤더 없는 열은 무시
        const text = gridRow[i] ? cellText(gridRow[i], sharedStrings).trim() : '';
        obj[header] = text;
        if (text) hasValue = true;
      });
      if (hasValue) rows.push(obj); // 완전히 빈 행은 버린다
    }

    writeFileSync(join(OUT_DIR, `${name}.json`), JSON.stringify(rows, null, 2) + '\n', 'utf8');
    manifest[name] = { rows: rows.length, headers: headers.filter(Boolean) };
    console.log(`  ok    ${name.padEnd(18)} ${String(rows.length).padStart(3)} rows  [${headers.filter(Boolean).join(', ')}]`);
  }

  writeFileSync(
    join(OUT_DIR, '_manifest.json'),
    JSON.stringify({ source: 'xlsx', file: 'eplab_website_content.xlsx', generatedAt: new Date().toISOString(), sheets: manifest }, null, 2) + '\n',
    'utf8'
  );
  console.log(`\n덤프 완료 → data-cache/ (${Object.keys(manifest).length}개 탭)`);
}

main();
