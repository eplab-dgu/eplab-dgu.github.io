/**
 * content-report — 시트에서 **아직 안 채워진 것**을 한 장으로 보여준다.
 *
 * 왜 필요한가: 빌드는 미입력 필드를 조용히 넘긴다(그래야 사이트가 안 죽는다).
 * 그래서 "무엇을 더 채워야 사이트가 완성되는가"를 아무도 모르는 상태가 된다.
 * 이 스크립트가 그 목록을 만들어 교수님·학생에게 전달할 수 있게 한다.
 *
 * 빌드와 **같은 데이터**(src/_data/cms.js)를 본다. 별도 파싱을 하지 않으므로
 * 리포트와 실제 사이트가 어긋날 수 없다.
 *
 *   npm run report
 */
import loadCms from '../src/_data/cms.js';
import { TABS } from '../src/_data/cms-schema.js';
import { loadFromXlsx } from '../src/_data/xlsx-source.js';

/**
 * 비었을 때 **사이트에 눈에 띄는 구멍**이 생기는 필드만 본다.
 * notes 같은 내부 메모는 비어 있는 게 정상이므로 세지 않는다.
 *
 * 항목은 'field' 또는 { field, only } — only 는 "그 행에서 이 필드가 실제로 화면에
 * 나오는가"를 판정한다. 정상인 공백까지 결함으로 찍으면 리포트를 아무도 안 보게 된다.
 * (예: 이메일은 디자인상 Faculty/Graduate 카드에만 나온다. 학부연구생·졸업생의
 *  빈 이메일은 누락이 아니다.)
 */
const WATCH = {
  Members: [
    'photo_url',
    { field: 'email', only: (m) => m.category === 'Faculty' || m.category === 'Graduate' },
  ],
  Research_Topics: ['description', 'image_url'],
  Research_Projects: ['role', 'partner', 'period_start', 'period_end'],
  Publications: ['venue', 'metrics', 'doi'],
  Conferences: ['authors', 'venue'],
  Patents: ['patent_no', 'inventors'],
  Invited_Talks: ['host'],
  Teaching: ['term', 'description'],
  News: ['text_en'],
  Gallery: ['image_urls', 'participants'],
  // Collaborators: ['name', 'logo_url', 'url'],  // 탭 폐기 (cms-schema.js 참고)
};

const isEmpty = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

const cms = await loadCms();

// 미게시 행 수는 정규화된 데이터에 남지 않으므로 원시 시트에서 센다.
const { data: raw } = loadFromXlsx(() => {});
const rawCount = (tab) => (raw[tab]?.rows ?? []).length;

console.log('\n════ eP Lab 시트 입력 현황 ════════════════════════════════════');
console.log(`소스: ${cms._meta.source}   생성: ${new Date().toLocaleString('ko-KR')}\n`);

console.log('탭                게시  미게시   미입력 필드');
console.log('─'.repeat(78));

const todo = [];

for (const tab of TABS) {
  const rows = cms[tab] ?? [];
  const total = rawCount(tab);
  const unpublished = Math.max(0, total - rows.length);

  const gaps = [];
  for (const entry of WATCH[tab] ?? []) {
    const field = typeof entry === 'string' ? entry : entry.field;
    const only = typeof entry === 'string' ? null : entry.only;

    const scope = only ? rows.filter(only) : rows;
    const missing = scope.filter((r) => isEmpty(r[field])).length;
    if (missing === 0) continue;

    gaps.push(`${field} ${missing}/${scope.length}`);
    if (missing === scope.length && scope.length > 0) {
      todo.push(`${tab}.${field} — ${scope.length}행 전부 비어 있음`);
    }
  }

  const flag = rows.length === 0 && total > 0 ? '  ← 게시된 행이 없다' : '';
  console.log(
    `${tab.padEnd(18)}${String(rows.length).padStart(4)}${String(unpublished).padStart(7)}   ${
      gaps.length ? gaps.join(', ') : '없음'
    }${flag}`
  );
}

// Site_Config 는 key/value 라 위 표와 형태가 달라 따로 본다.
const emptyConfig = (cms.Site_Config ?? []).filter((r) => !r.value_en && !r.value_ko).map((r) => r.key);
if (emptyConfig.length) todo.push(`Site_Config — 값이 빈 키: ${emptyConfig.join(', ')}`);

console.log('\n──── 채워야 할 것 (해당 필드가 전부 비어 있음) ────────────────');
if (todo.length === 0) {
  console.log('  없음 — 감시 대상 필드가 모두 채워졌다.');
} else {
  for (const t of todo) console.log(`  · ${t}`);
}

// 스키마가 required 로 잡은 필드는 비면 행 자체가 사라지므로 별도로 경고한다.
console.log('\n──── 참고 ────────────────────────────────────────────────────');
console.log(`  게시 행 합계   ${TABS.reduce((n, t) => n + (cms[t] ?? []).length, 0)}`);
console.log(`  빌드 경고      ${cms._meta.totalWarnings}건 · 스킵 ${cms._meta.totalSkipped}행`);
console.log(`  홈 통계 타일   researchers ${cms.stats.researchers} · publications ${cms.stats.publications} · projects ${cms.stats.projects}`);
console.log('');
console.log('  미게시 행은 publish 체크박스가 꺼져 있다는 뜻이다 (오류가 아님).');
console.log('  required 필드가 비면 그 행은 통째로 스킵되고 빌드 로그에 행 번호가 찍힌다.');
console.log('');
