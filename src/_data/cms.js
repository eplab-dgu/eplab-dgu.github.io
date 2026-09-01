/**
 * cms.js — Eleventy 글로벌 데이터. 템플릿에서는 `{{ cms.Publications }}` 처럼 쓴다.
 *
 * ┌─ 이 파일의 역할 ────────────────────────────────────────────────────────┐
 * │  ① 소스 어댑터: 데이터를 **어디서** 읽는가 (지금은 루트의 xlsx)          │
 * │  ② 조립: 탭별 검증(cms-schema.js) → 정규화된 JSON + 파생 데이터      │
 * │  ③ 보고: 스킵된 행·구조 드리프트를 빌드 로그에 시끄럽게 남긴다           │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * ## Google Sheets API 로 갈아타는 법 (Phase 4)
 *
 * 아래 `SOURCE ADAPTER` 구역의 `loadRawTabs()` **하나만** 바꾸면 된다.
 * 계약은 이것뿐:
 *
 *   loadRawTabs() -> Promise<{
 *     source: string,                    // 로그용 소스 이름
 *     presentTabs: string[],             // 실제로 존재하는 탭 이름 전부 (드리프트 검사용)
 *     data: { [tab]: { headers: string[], rows: Array<Record<string,string>> } }
 *   }>
 *
 * 즉 "헤더 이름 → 셀 문자열" 매핑 배열만 돌려주면 되고, 값 변환·정렬·검증은
 * 전부 이 아래 파이프라인이 처리한다. Sheets API 판 로더는 이미
 * `src/_data/sheets-source.js` 의 `loadFromSheetsApi()` 에 있으므로,
 * 그때는 그 함수를 호출하도록 어댑터를 교체하고 data-cache 폴백을 붙이면 된다.
 *
 * ## 출력 스키마 (템플릿이 의존하는 계약)
 *
 * `cms` 객체:
 *
 *   cms.<탭이름>   각 탭의 행 배열. publish=TRUE 행만, order 오름차순.
 *   cms.config     Site_Config 를 { key: value_en || value_ko } 맵으로.
 *   cms.stats      홈 통계 타일용 자동 집계 (DESIGN_SPEC §5-8).
 *   cms._meta      소스·스킵·경고 요약 (디버그·푸터 표시용).
 *
 * 모든 데이터 행에는 공통으로 `publish:true`, `order:number`, `_row:number`(시트 행번호).
 * 문자열 필드는 값이 없으면 `''`, URL/숫자 필드는 `null`, list 필드는 `[]`.
 *
 *   Site_Config       key, value_en, value_ko, notes                   (publish/order 없음)
 *   Members           category(Faculty|Graduate|Undergraduate|Alumni), name_en, name_ko,
 *                     position, email, cohort_period, current_affiliation,
 *                     photo_url, scholar_url, notes, +name
 *   Leader_CV         section(ResearchInterest|Education|Experience|Award|Activity),
 *                     date, title, detail
 *   Research_Topics   no, title_en, title_ko, description, tags[], image_url, +title
 *   Research_Projects status(Ongoing|Completed), title_en, title_ko, partner,
 *                     partner_logo_url, period_start, period_end, notes,
 *                     +title, +period("시작 – 끝"), +isOngoing
 *   Publications      year(number), authors, title, venue, metrics, doi,
 *                     featured(boolean), +metricsList[]
 *   Conferences       year(number), authors, title, venue, location, date, notes
 *   Patents           country, status, title, year(number), patent_no, inventors, notes
 *   Invited_Talks     date, title, host, +year(number|null)
 *   Teaching          level(Undergraduate|Graduate), title_en, title_ko, course_code,
 *                     term, description, notes, +title
 *   News              date, category, text_ko, text_en, image_url,
 *                     +text, +isFallbackKo, +year
 *   Gallery           date, title, participants, photo_count(number),
 *                     image_urls[], notes, +year
 *   Collaborators     name, logo_url, url, notes
 *
 * 필드별 상세(필수 여부·enum)는 cms-schema.js 의 SCHEMAS 를 볼 것.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { TABS, IGNORED_TABS, validateTab, expectedHeaders } from './cms-schema.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const XLSX_PATH = join(ROOT, 'eplab_website_content.xlsx');

// ═══ SOURCE ADAPTER ═══════════════════════════════════════════════════════
// 여기만 갈아끼우면 소스가 바뀐다. 위 주석의 계약을 지킬 것.

/**
 * 루트의 eplab_website_content.xlsx 를 읽어 탭별 원시 행을 돌려준다.
 * 실패해도 throw 하지 않는다 — 빈 데이터로 빌드가 계속되고, 로그에 이유가 남는다.
 */
async function loadRawTabs() {
  if (!existsSync(XLSX_PATH)) {
    console.warn(`  [cms] !! ${XLSX_PATH} 없음 — 빈 데이터로 빌드한다`);
    return { source: 'missing', presentTabs: [], data: {} };
  }

  try {
    // cellDates:false + raw:false → 모든 셀을 "보이는 그대로의 문자열"로 받는다.
    // 시트에서 오는 값과 형태를 맞춰야(예: "2026.03" 이 날짜로 뒤바뀌지 않도록)
    // 나중에 Sheets API 로 바꿔도 파싱 결과가 동일하다.
    const wb = XLSX.read(readFileSync(XLSX_PATH), { type: 'buffer', cellDates: false });
    const data = {};

    for (const name of wb.SheetNames) {
      const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], {
        header: 1, // 2차원 배열로 받아 헤더 매핑을 우리가 직접 한다
        raw: false,
        defval: '',
        blankrows: false,
      });
      data[name] = gridToObjects(grid);
    }

    return { source: 'xlsx', presentTabs: wb.SheetNames, data };
  } catch (err) {
    console.warn(`  [cms] !! xlsx 읽기 실패: ${err.message} — 빈 데이터로 빌드한다`);
    return { source: 'xlsx-error', presentTabs: [], data: {} };
  }
}

// ═══ 이하 소스 무관 파이프라인 ═════════════════════════════════════════════

/**
 * 2차원 배열 → 헤더 **이름** 매핑 객체 배열. 열 순서에 의존하지 않는다.
 * headers 를 함께 돌려주는 이유: 조용히 사라진 열을 탐지하려면
 * "실제 시트에 있던 헤더 목록"이 필요하다. rows 만 봐서는 알 수 없다.
 */
function gridToObjects(grid) {
  if (!grid || grid.length === 0) return { headers: [], rows: [] };

  const headerRow = (grid[0] ?? []).map((h) => String(h ?? '').trim());
  const headers = headerRow.filter(Boolean);

  const rows = grid.slice(1).flatMap((row) => {
    const obj = {};
    let hasValue = false;
    headerRow.forEach((header, i) => {
      if (!header) return; // 헤더 없는 열은 무시
      const cell = String(row?.[i] ?? '').trim();
      obj[header] = cell;
      if (cell) hasValue = true;
    });
    return hasValue ? [obj] : []; // 완전히 빈 행은 버린다
  });

  return { headers, rows };
}

/**
 * 탭·헤더 구조가 스키마와 어긋나는지 검사한다.
 * 행 검증과 달리 여기 걸리는 문제는 **경고가 없으면 아무도 모르는** 종류다 —
 * 학생이 탭이나 열 이름을 바꾸면 빌드는 멀쩡히 성공하고 내용만 조용히 사라진다.
 */
function detectDrift(presentTabs, data) {
  const warnings = [];
  const known = new Set(TABS);

  for (const tab of presentTabs) {
    if (known.has(tab) || IGNORED_TABS.has(tab)) continue;
    warnings.push(`시트에 있으나 코드가 모르는 탭: "${tab}" — 페이지로 만들려면 스키마·템플릿 추가가 필요하다`);
  }

  for (const tab of TABS) {
    if (!presentTabs.includes(tab)) {
      warnings.push(`스키마가 기대하는 탭 "${tab}" 이 없다 — 이름이 바뀌었거나 삭제됨. 빈 채로 빌드된다`);
      continue;
    }

    const actual = data[tab]?.headers ?? [];
    if (actual.length === 0) continue;

    const expected = expectedHeaders(tab);
    const unknown = actual.filter((h) => !expected.includes(h));
    const missing = expected.filter((h) => !actual.includes(h));

    for (const h of missing) {
      const hint = unknown.length ? ` (혹시 "${unknown.join('" / "')}" 로 바꿨나?)` : '';
      warnings.push(`${tab}: 스키마의 헤더 "${h}" 가 시트에 없다${hint} — 이 필드는 전부 비어서 나간다`);
    }
    for (const h of unknown) {
      warnings.push(`${tab}: 코드가 모르는 헤더 "${h}" — 이 열은 사이트에 나오지 않는다`);
    }
  }

  return warnings;
}

/** 홈 통계 타일(DESIGN_SPEC §5-8)은 하드코딩하지 않고 집계한다. */
function buildStats(result) {
  const members = result.Members ?? [];
  return {
    researchers: members.filter((m) => m.category === 'Graduate' || m.category === 'Undergraduate').length,
    publications: (result.Publications ?? []).length,
    projects: (result.Research_Projects ?? []).length,
    ongoingProjects: (result.Research_Projects ?? []).filter((p) => p.isOngoing).length,
    alumni: members.filter((m) => m.category === 'Alumni').length,
  };
}

export default async function () {
  const { source, presentTabs, data } = await loadRawTabs();

  const result = {};
  let totalSkipped = 0;
  let totalWarnings = 0;

  const drift = detectDrift(presentTabs, data);
  if (drift.length) {
    console.warn('  [cms] ─ 구조 드리프트 ─────────────────────────────');
    for (const w of drift) console.warn(`  [cms]   !! ${w}`);
    totalWarnings += drift.length;
  }

  console.log('  [cms] ─ 탭별 검증 결과 ───────────────────────────');
  for (const tab of TABS) {
    const { rows, skipped, unpublished, warnings } = validateTab(tab, data[tab]?.rows ?? []);
    result[tab] = rows;
    totalSkipped += skipped;
    totalWarnings += warnings.length;

    const detail = [`${String(rows.length).padStart(3)} rows`];
    if (unpublished) detail.push(`unpublished ${unpublished}`);
    if (skipped) detail.push(`SKIPPED ${skipped}`);
    console.log(`  [cms]   ${tab.padEnd(18)} ${detail.join('  ·  ')}`);
    for (const w of warnings) console.warn(`  [cms]     ! ${w}`);
  }

  // Site_Config 는 key/value 표다. 템플릿에서 쓰기 쉽게 맵으로도 제공한다.
  result.config = Object.fromEntries(
    (result.Site_Config ?? []).map((r) => [r.key, r.value_en || r.value_ko || ''])
  );

  result.stats = buildStats(result);

  // 영문 미번역 뉴스는 한국어로 폴백해 나간다. 검수 대상이므로 개수를 보고한다.
  const untranslatedNews = (result.News ?? []).filter((n) => n.isFallbackKo).length;
  if (untranslatedNews) {
    console.warn(`  [cms]   ! News: ${untranslatedNews}건이 text_en 미작성 — 한국어 원문으로 나간다`);
  }

  result._meta = { source, totalSkipped, totalWarnings, untranslatedNews, builtAt: new Date().toISOString() };

  console.log(`  [cms] ─ source=${source} · 스킵 ${totalSkipped}행 · 경고 ${totalWarnings}건 ─`);
  if (totalSkipped > 0) {
    console.warn(`  [cms] !! ${totalSkipped}개 행이 게시되지 않았다. 위 경고를 확인할 것.`);
  }

  return result;
}
