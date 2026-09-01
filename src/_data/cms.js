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
 *   cms.config     Site_Config 를 { key: value_ko || value_en } 맵으로 (한글 우선).
 *   cms.configEn   같은 표의 영문 우선 버전. 디자인이 영문을 쓰는 자리에만 쓴다.
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
 *   Research_Topics   no, title_en, title_ko, description, image_url, +title
 *   Research_Projects status(Ongoing|Completed), role(PI|Co-I|Advisor), title_ko,
 *                     partner, period_start, period_end, notes,
 *                     +title, +period("시작 – 끝"), +isOngoing
 *   Publications      year(number), authors, title, venue, metrics, doi,
 *                     featured(boolean), +metricsList[]
 *   Conferences       year(number), authors, title, venue, location, date, notes
 *   Patents           country, status, title, year(number), patent_no, inventors, notes
 *   Invited_Talks     date, title, host, +year(number|null)
 *   Teaching          level(Undergraduate|Graduate), title_en, title_ko, course_code,
 *                     term, description, notes, +title
 *   News              date, category, text_ko, text_en, image_url,
 *                     +text(한글 우선), +isFallbackEn, +year
 *   Gallery           date, title, participants, photo_count(number),
 *                     image_urls[], notes, +year
 *   (Collaborators    2026-09-01 폐기 — 디자인에 협력기관 섹션이 없다)
 *
 * 필드별 상세(필수 여부·enum)는 cms-schema.js 의 SCHEMAS 를 볼 것.
 */
import 'dotenv/config';
import { TABS, IGNORED_TABS, validateTab, expectedHeaders, preferred } from './cms-schema.js';
import { loadFromXlsx } from './xlsx-source.js';
import { loadFromSheetsApi, loadFromCache } from './sheets-source.js';

// ═══ SOURCE ADAPTER ═══════════════════════════════════════════════════════
//
// 소스 우선순위:
//   1. Google Sheets API   — SHEET_ID + GOOGLE_SERVICE_ACCOUNT_JSON 이 있을 때 (운영)
//   2. data-cache/*.json   — API 가 실패했을 때의 폴백 (직전 성공 데이터)
//   3. eplab_website_content.xlsx — 키가 없는 로컬/오프라인 개발
//
// CMS_SOURCE=xlsx 로 강제하면 키가 있어도 1을 건너뛴다 (네트워크 없이 개발할 때).
//
// **어떤 경로에서도 throw 하지 않는다.** 시트가 죽어도 배포가 멈추면 안 된다.
// (CLAUDE.md 맹점 #3 — fail-safe)

const warn = (msg) => console.warn(`  [cms] !! ${msg}`);

/** googleapis 에러 메시지는 스택까지 여러 줄로 온다. 로그엔 첫 줄만 남긴다. */
const firstLine = (msg) => String(msg ?? '').split('\n')[0].trim();

/** xlsx → 실패 시 캐시. 키가 없거나 API 가 죽었을 때의 로컬 경로. */
function loadOffline() {
  const x = loadFromXlsx(warn);
  if (x.ok && Object.keys(x.data).length) {
    return { source: 'xlsx', presentTabs: x.presentTabs, data: x.data };
  }
  const c = loadFromCache();
  if (Object.keys(c.data).length) {
    warn(`xlsx 를 못 읽어 data-cache 로 빌드한다 (캐시 생성: ${c.generatedAt ?? '알 수 없음'})`);
    return { source: 'cache', presentTabs: c.presentTabs, data: c.data };
  }
  warn('xlsx 도 data-cache 도 없다 — 빈 사이트로 빌드한다');
  return { source: 'none', presentTabs: [], data: {} };
}

async function loadRawTabs() {
  const sheetId = process.env.SHEET_ID;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (process.env.CMS_SOURCE === 'xlsx') {
    console.log('  [cms] CMS_SOURCE=xlsx — 시트를 건너뛰고 로컬 파일로 빌드한다');
    return loadOffline();
  }
  if (!sheetId || !key) {
    console.log('  [cms] SHEET_ID / GOOGLE_SERVICE_ACCOUNT_JSON 없음 → 로컬 파일로 빌드한다');
    return loadOffline();
  }

  try {
    const { presentTabs, data } = await loadFromSheetsApi(sheetId, key);
    console.log('  [cms] Google Sheets API 에서 로드');
    return { source: 'sheets-api', presentTabs, data };
  } catch (err) {
    // 시트 장애로 배포가 멈추면 안 된다. 다만 **조용히** 넘어가서도 안 된다 —
    // 폴백 데이터가 몇 달 전 것이면 빌드 성공이 오히려 더 나쁘다.
    warn(`Sheets API 실패: ${firstLine(err.message)}`);
    const c = loadFromCache();
    if (Object.keys(c.data).length) {
      warn(`data-cache 폴백으로 계속한다 (캐시 생성: ${c.generatedAt ?? '알 수 없음'}) — 내용이 오래됐을 수 있다`);
      return { source: 'cache-fallback', presentTabs: c.presentTabs, data: c.data };
    }
    warn('캐시도 없어 로컬 xlsx 로 계속한다');
    return loadOffline();
  }
}

// ═══ 이하 소스 무관 파이프라인 ═════════════════════════════════════════════

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
  // 언어 선택은 preferred() 한 곳을 거친다 — 한글 우선 (CLAUDE.md §2).
  result.config = Object.fromEntries(
    (result.Site_Config ?? []).map((r) => [r.key, preferred(r.value_ko, r.value_en)])
  );

  // 디자인이 **의도적으로 영문을 쓰는 자리**가 있다 — 헤더 브랜드의 DONGGUK UNIVERSITY,
  // 히어로 eyebrow, Leader 카드의 소속(원본 L28·L61·L144-146). 그 자리에서만
  // cms.configEn 을 쓴다. 언어 규칙을 어기는 게 아니라, 디자인이 두 언어를 다르게
  // 쓰는 곳을 템플릿에서 명시하는 것이다.
  result.configEn = Object.fromEntries(
    (result.Site_Config ?? []).map((r) => [r.key, r.value_en || r.value_ko || ''])
  );

  result.stats = buildStats(result);

  // 한글 원문이 빠져 영문으로 대체된 뉴스. 원문이 없는 것이므로 검수 대상이다.
  const untranslatedNews = (result.News ?? []).filter((n) => n.isFallbackEn).length;
  if (untranslatedNews) {
    console.warn(`  [cms]   ! News: ${untranslatedNews}건이 text_ko 미작성 — 영문으로 대체해 나간다`);
  }

  result._meta = { source, totalSkipped, totalWarnings, untranslatedNews, builtAt: new Date().toISOString() };

  console.log(`  [cms] ─ source=${source} · 스킵 ${totalSkipped}행 · 경고 ${totalWarnings}건 ─`);
  if (totalSkipped > 0) {
    console.warn(`  [cms] !! ${totalSkipped}개 행이 게시되지 않았다. 위 경고를 확인할 것.`);
  }

  return result;
}
