/**
 * cms-schema.js — 시트 탭별 **스키마 정의**와 검증·정규화 로직.
 *
 * 여기 있는 것: "각 탭에 어떤 열이 있어야 하고, 각 열의 타입은 무엇이며,
 * 무엇이 없으면 그 행을 버려야 하는가."
 * 여기 없는 것: 데이터를 **어디서** 읽는가 — 그건 cms.js 의 소스 어댑터 몫.
 *
 * 이 분리 덕분에 나중에 xlsx → Google Sheets API 로 갈아탈 때
 * cms.js 의 어댑터 함수 하나만 바꾸면 되고, 이 파일은 그대로 쓴다.
 *
 * 설계 원칙 (CLAUDE.md §8):
 *  1. 빌드는 **항상 성공한다.** 어떤 행도 예외를 던지지 않는다. 나쁜 행은 경고 후 스킵.
 *  2. 열 **순서가 아니라 이름**으로 매핑한다 (학생이 시트에서 열을 옮겨도 안전).
 *  3. 링크 하나가 잘못됐다고 사람 한 명이 사이트에서 사라지면 안 된다
 *     → URL/숫자 같은 부가 필드는 값만 비우고, required 필드만 행을 버린다.
 */

/**
 * 표시 언어 우선순위 — **한글 우선** (2026-09-01 결정, CLAUDE.md §2).
 *
 * 확정 디자인(eP Lab Website.dc.html)이 한글 기준으로 작성돼 있어, 영문을 우선하면
 * 사이트가 디자인과 어긋난다. `*_ko` 가 있으면 그것을, 없으면 `*_en` 으로 넘어간다.
 *
 * 언어를 고르는 지점은 **반드시 이 함수 하나만 거친다.** 곳곳에서 `a || b` 를 쓰면
 * 규칙이 조용히 갈라진다.
 *
 * 예외: 디자인이 두 언어를 **동시에** 보여주는 자리(연구주제 카드의 영문 제목 +
 * 국문 부제, 구성원 카드의 한글 이름 + 영문 이름)는 이 함수를 쓰지 않고
 * 템플릿에서 `title_en`/`title_ko` 를 각각 직접 쓴다.
 */
export function preferred(ko, en) {
  return ko || en || '';
}

// ── enum 목록 (시트의 데이터 유효성 검사와 같은 값을 유지할 것) ──────────────
const MEMBER_CATEGORIES = ['Faculty', 'Graduate', 'Undergraduate', 'Alumni'];
const CV_SECTIONS = ['ResearchInterest', 'Education', 'Experience', 'Award', 'Activity'];
const NEWS_CATEGORIES = ['Paper', 'Research', 'Conference', 'Event', 'People', 'Award'];
const PROJECT_STATUS = ['Ongoing', 'Completed'];
const PROJECT_ROLES = ['PI', 'Co-I', 'Advisor'];
const TEACHING_LEVELS = ['Undergraduate', 'Graduate'];
const PATENT_STATUS = ['Registered', 'Filed', 'Pending'];

/** 졸업생 중 "학위 취득자"로 볼 position. 학부연구생은 여기 안 걸린다. */
const DEGREE_POSITION = /석사|박사|master|ph\.?\s*d|doctor/i;

/**
 * 필드 스펙:
 *   required : 비면 **행 전체 스킵** (경고)
 *   enum     : 목록 밖 값이면 **행 전체 스킵** (경고)
 *   type     : 'string'(기본) | 'number' | 'boolean' | 'url' | 'image' | 'list'
 *              'image' = url + 구글 드라이브 공유 링크를 직접 이미지 URL로 변환
 *   sep      : type:'list' 의 구분자 (기본 ',')
 *
 * 탭 옵션:
 *   hasPublish:false → publish/order 열이 없는 탭 (Site_Config)
 *   derive(row)      → 검증 통과 후 파생 필드 추가.
 *                      정규화까지만 한다 — 표현(색·포맷) 로직은 템플릿/필터에 둔다.
 */
export const SCHEMAS = {
  // ── 전역 설정 (key/value 표) ───────────────────────────────────────────────
  Site_Config: {
    hasPublish: false,
    fields: {
      key: { required: true },
      value_en: {},
      value_ko: {},
      notes: {},
    },
  },

  // ── Team ──────────────────────────────────────────────────────────────────
  Members: {
    fields: {
      category: { required: true, enum: MEMBER_CATEGORIES },
      name_en: { required: true },
      name_ko: {},
      position: {},
      email: {},
      cohort_period: {},
      current_affiliation: {},
      photo_url: { type: 'image' },
      scholar_url: { type: 'url' },
      notes: {},
    },
    derive: (r) => ({
      name: preferred(r.name_ko, r.name_en),
      // 졸업생은 두 갈래로 나뉜다 (2026-09-02):
      //   학위 취득자(석사·박사) → 사진 카드
      //   학부연구생            → 이름만 있는 텍스트 줄
      // position 문자열로 판정한다. 못 알아본 값은 **텍스트 줄로 떨어진다** —
      // 사진 없는 카드가 덩그러니 남는 것보다 그쪽이 덜 망가진다.
      isDegreeAlumni: r.category === 'Alumni' && DEGREE_POSITION.test(r.position),
      // 학위 취득 시점 = 재직 기간의 끝. "24.09 ~ 26.08" → "2026.08"
      degreeDate: endOfPeriod(r.cohort_period),
    }),
  },

  Leader_CV: {
    fields: {
      section: { required: true, enum: CV_SECTIONS },
      date: {},
      title: { required: true },
      detail: {},
    },
    // 디자인의 Education 항목은 지도교수/학위논문이 줄바꿈되어 있다(dc.html L170).
    // 셀 안에서 줄을 나누는 규칙: ` | ` 로 구분한다. 시트에 HTML 을 넣게 하면
    // 학생 입력이 그대로 마크업이 되므로 구분자 방식을 쓴다.
    //
    // 다만 "Advisor: … . Dissertation: …" 처럼 마침표로만 이어 쓰는 게 자연스러워서
    // 구분자를 빠뜨리기 쉽다. 그래서 `Dissertation:` 앞에서는 구분자가 없어도 줄을 나눈다.
    // (학생이 어느 쪽으로 쓰든 결과가 같게 — 2026-09-05)
    derive: (r) => ({ detailLines: splitCvDetail(r.detail) }),
  },

  // ── Research ──────────────────────────────────────────────────────────────
  Research_Topics: {
    fields: {
      no: {},
      title_en: { required: true },
      title_ko: {},
      description: {},
      image_url: { type: 'image' },
    },
    derive: (r) => ({ title: preferred(r.title_ko, r.title_en) }),
  },

  Research_Projects: {
    fields: {
      status: { required: true, enum: PROJECT_STATUS },
      // 이 탭엔 영문 제목 열이 없다 (2026-09-02 시트에서 삭제). 국문만 쓴다.
      title_ko: { required: true },
      // 교수님의 과제 참여 형태. 비어 있어도 행은 게시된다 — 표의 ROLE 칸만 빈다.
      role: { enum: PROJECT_ROLES },
      partner: {},
      period_start: {},
      period_end: {},
      notes: {},
    },
    derive: (r) => ({
      // 언어 선택지가 없으므로 preferred() 를 거치지 않는다.
      title: r.title_ko,
      // 디자인의 PERIOD 칸은 "2026.03 – 2026.12" 한 덩어리다 (DESIGN_SPEC §3).
      period: [r.period_start, r.period_end].filter(Boolean).join(' – '),
      isOngoing: r.status === 'Ongoing',
    }),
  },

  // ── Achievements ──────────────────────────────────────────────────────────
  Publications: {
    fields: {
      year: { required: true, type: 'number' },
      authors: { required: true },
      title: { required: true },
      venue: {},
      metrics: {},
      doi: { type: 'url' },
    },
    // 지표 칩은 "IF 4.2 · Q1 · JCR 13.0%" 를 가운뎃점으로 쪼갠 것 (DESIGN_SPEC §4-1).
    // 쪼개는 것까지가 정규화. 어느 칩을 오렌지로 칠할지는 템플릿/필터의 몫.
    derive: (r) => ({ metricsList: splitList(r.metrics, '·') }),
  },

  Conferences: {
    fields: {
      year: { required: true, type: 'number' },
      authors: {},
      title: { required: true },
      venue: {},
      location: {},
      date: {},
      notes: {},
    },
  },

  Patents: {
    fields: {
      country: {},
      status: { enum: PATENT_STATUS },
      title: { required: true },
      year: { type: 'number' },
      patent_no: {},
      inventors: {},
      notes: {},
    },
  },

  Invited_Talks: {
    fields: {
      date: { required: true },
      title: { required: true },
      host: {},
    },
    // "최근(2025+) vs 이전" 토글 분기에 쓸 연도 (DESIGN_SPEC §4-1).
    derive: (r) => ({ year: yearOf(r.date) }),
  },

  // ── Teaching ──────────────────────────────────────────────────────────────
  Teaching: {
    fields: {
      level: { required: true, enum: TEACHING_LEVELS },
      title_en: { required: true },
      title_ko: {},
      course_code: {},
      term: {},
      description: {},
      notes: {},
    },
    derive: (r) => ({ title: preferred(r.title_ko, r.title_en) }),
  },

  // ── News / Gallery ────────────────────────────────────────────────────────
  News: {
    fields: {
      date: { required: true },
      category: { enum: NEWS_CATEGORIES },
      text_ko: {},
      text_en: {},
      image_url: { type: 'image' },
    },
    // 한글 우선. 디자인 원본의 News 는 한국어 문장이다.
    // isFallbackEn = 한국어가 비어 영문으로 대체된 행. 원문이 빠진 것이므로 보고 대상.
    derive: (r) => ({
      text: preferred(r.text_ko, r.text_en),
      isFallbackEn: !r.text_ko && !!r.text_en,
      year: yearOf(r.date),
    }),
  },

  Gallery: {
    fields: {
      date: { required: true },
      title: { required: true },
      participants: {},
      photo_count: { type: 'number' },
      image_urls: { type: 'list' },
      notes: {},
    },
    // image_urls 는 리스트라 coerce 의 'image' 분기를 못 탄다. 여기서 항목별로 변환한다.
    derive: (r) => ({ year: yearOf(r.date), image_urls: r.image_urls.map((u) => driveDirect(u)) }),
  },

  // ── About ─────────────────────────────────────────────────────────────────
  // Collaborators — 2026-09-01 폐기.
  // 확정 디자인(eP Lab Website.dc.html)에 협력기관 섹션이 없어 어떤 페이지도 이 탭을
  // 쓰지 않았고, 시트에서도 탭을 삭제했다. 스키마에 남겨두면 매 빌드마다
  // "기대하는 탭이 시트에 없다" 드리프트 경고가 뜨므로 함께 내린다.
  // 되살리려면 이 블록의 주석을 풀고 시트에 같은 헤더로 탭을 만들면 된다.
  // Collaborators: {
  //   fields: {
  //     name: { required: true },
  //     logo_url: { type: 'url' },
  //     url: { type: 'url' },
  //     notes: {},
  //   },
  // },
};

/** 데이터 탭이 아니므로 "코드가 모르는 탭" 경고에서 제외한다. */
export const IGNORED_TABS = new Set(['README']);

/** 스키마가 아는 탭 목록 (= 빌드가 소비하는 탭) */
export const TABS = Object.keys(SCHEMAS);

// ── 값 변환 헬퍼 ────────────────────────────────────────────────────────────

const TRUTHY = new Set(['true', '1', 'y', 'yes', 'o']);

/** 시트 체크박스는 "TRUE"/"FALSE" 문자열로 온다. 빈 값은 false. */
export function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  return TRUTHY.has(String(value ?? '').trim().toLowerCase());
}

/** "2026.03" / "26.09" / "2026-03-01" → 4자리 연도. 판단 불가면 null. */
export function yearOf(value) {
  const first = String(value ?? '').match(/\d+/)?.[0];
  if (!first) return null;
  if (first.length === 4) return Number(first);
  if (first.length === 2) return 2000 + Number(first); // 디자인의 News/Gallery 는 "26.03" 표기
  return null;
}

/** "2026.03" / "2026-03-01" / "2026" → 정렬 가능한 키. 실패 시 '' (정렬 최하위). */
export function dateSortKey(value) {
  const digits = String(value ?? '').match(/\d+/g);
  if (!digits) return '';
  const [y = '', m = '', d = ''] = digits;
  const year = y.length === 2 ? `20${y}` : y;
  return `${year.padStart(4, '0')}${m.padStart(2, '0')}${d.padStart(2, '0')}`;
}

/**
 * 구글 드라이브 공유 링크를 **`<img src>` 로 쓸 수 있는 직접 이미지 URL**로 바꾼다.
 *
 * 학생이 드라이브에서 "링크 복사"를 누르면 이런 게 나온다:
 *     https://drive.google.com/file/d/<ID>/view?usp=drive_link
 * 이건 **이미지가 아니라 뷰어 웹페이지**다. `<img src>` 에 넣으면 아무것도 안 보인다.
 * 학생에게 URL을 손으로 고치라고 시킬 수는 없으니(반드시 틀린다) 여기서 바꾼다.
 *
 * 드라이브가 주는 링크 형태를 전부 받아 파일 ID만 뽑고, 이미지 바이트를 돌려주는
 * `thumbnail` 엔드포인트로 정규화한다. (`uc?export=view` 는 지금은 잘 막힌다.)
 *
 * ⚠️ 이건 **주소만** 고친다. 파일이 "링크가 있는 모든 사용자"로 공개돼 있지 않으면
 *    어떤 주소를 써도 구글 로그인 페이지가 돌아온다 — 사진이 안 나오면 공유 설정을 먼저 볼 것.
 * ⚠️ 드라이브 핫링크는 트래픽 제한이 있다. 최종적으로는 빌드 시 내려받아
 *    자체 호스팅하는 편이 맞다 (HOW_TO_BUILD 7단계).
 *
 * 드라이브 링크가 아니면 원본을 그대로 돌려준다.
 */
export function driveDirect(url, size = 1000) {
  const s = String(url ?? '');
  // 호스트를 문자열 매칭으로 보면 안 된다 — "//drive.google.com" 앞은 점도 문자열
  // 시작도 아니라서 정규식이 조용히 빗나간다. 파싱해서 호스트만 본다.
  let host;
  try { host = new URL(s).hostname.toLowerCase(); } catch { return s; }
  if (host !== 'drive.google.com' && !host.endsWith('.drive.google.com')) return s;
  const id =
    s.match(/\/file\/d\/([A-Za-z0-9_-]+)/)?.[1] ??      // /file/d/<ID>/view
    s.match(/[?&]id=([A-Za-z0-9_-]+)/)?.[1] ??          // /open?id=<ID>, /uc?id=<ID>
    s.match(/\/d\/([A-Za-z0-9_-]+)/)?.[1];              // 그 밖의 /d/<ID>
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${size}` : s;
}

/**
 * 기간 문자열의 **끝**을 "YY.MM" 으로. 졸업생의 학위 취득 시점에 쓴다.
 *
 *   "24.09 ~ 26.08"     → "26.08"
 *   "2024.09 ~ 2026.08" → "26.08"
 *   "26.08"             → "26.08"   (구분자가 없으면 통째로 끝으로 본다)
 *
 * 두 자리 연도를 쓰는 이유: 학부연구생 졸업생 줄이 시트의 `cohort_period` 를
 * 그대로 "(24.08 ~ 24.12)" 로 보여준다. 학위 취득자만 네 자리로 쓰면 같은 페이지
 * 안에서 표기가 갈린다.
 *
 * 시트에 학위 취득일 열이 따로 없어서 `cohort_period` 의 끝을 쓴다 — 연구실을
 * 떠난 시점이 곧 학위 취득 시점이라는 전제다. 이 전제가 안 맞는 사람이 생기면
 * 그때 전용 열을 만드는 게 맞다. 못 읽으면 빈 문자열(표시 안 함).
 */
export function endOfPeriod(period) {
  const s = String(period ?? '').trim();
  if (!s) return '';
  const last = s.split(/[~–—-]/).pop().trim();
  const m = last.match(/^(\d{2}|\d{4})\s*[.\-/]\s*(\d{1,2})$/);
  if (!m) return '';
  const [, y, mo] = m;
  return `${y.slice(-2)}.${mo.padStart(2, '0')}`;
}

/**
 * Leader_CV 의 detail 을 줄 단위로 나눈다.
 *
 * 기본 규칙은 ` | ` 구분자. 여기에 더해 `Dissertation:` 앞에서도 줄을 나눈다 —
 * 사람이 쓰기엔 "…Hong. Dissertation: …" 처럼 마침표로 잇는 게 자연스러워서
 * 구분자를 빠뜨리기 쉽고, 그러면 지도교수와 학위논문이 한 줄에 뭉친다.
 *
 * 앞 조각 끝의 마침표는 떼어 낸다("…Jung-Pyo Hong." → "…Jung-Pyo Hong").
 * 줄이 나뉘면 문장 끝 마침표가 어색하기 때문이다.
 */
export function splitCvDetail(detail) {
  return splitList(detail, ' | ')
    .flatMap((piece) => piece.split(/\s*(?=Dissertation\s*:)/i))
    .map((s) => s.trim().replace(/\.$/, '').trim())
    .filter(Boolean);
}

/** 구분자로 나눈 뒤 공백 정리. 빈 조각은 버린다. */
export function splitList(value, sep = ',') {
  return String(value ?? '')
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
}

function coerce(raw, spec, ctx, warn) {
  const value = typeof raw === 'string' ? raw.trim() : raw;
  const empty = value === '' || value === undefined || value === null;

  if (spec.required && empty) {
    warn(`${ctx}: 필수값 누락 — 행을 건너뜀`);
    return { ok: false };
  }

  switch (spec.type) {
    case 'list':
      return { ok: true, value: empty ? [] : splitList(value, spec.sep) };

    case 'boolean':
      return { ok: true, value: toBoolean(value) };

    case 'number': {
      if (empty) return { ok: true, value: null };
      const n = Number(String(value).replace(/[,\s]/g, ''));
      if (!Number.isFinite(n)) {
        if (spec.required) {
          warn(`${ctx}: 숫자가 아님 ("${value}") — 행을 건너뜀`);
          return { ok: false };
        }
        warn(`${ctx}: 숫자가 아니라 무시 ("${value}")`);
        return { ok: true, value: null };
      }
      return { ok: true, value: n };
    }

    case 'url': {
      if (empty) return { ok: true, value: null };
      // 잘못된 URL로 행을 죽이지 않는다. 링크만 사라지고 나머지는 게시된다.
      if (!/^https?:\/\//i.test(value)) {
        warn(`${ctx}: http(s) URL이 아니라 무시 ("${value}")`);
        return { ok: true, value: null };
      }
      return { ok: true, value };
    }

    // 'image' = url 과 같되, 구글 드라이브 공유 링크를 **직접 이미지 URL로 바꾼다.**
    case 'image': {
      if (empty) return { ok: true, value: null };
      if (!/^https?:\/\//i.test(value)) {
        warn(`${ctx}: http(s) URL이 아니라 무시 ("${value}")`);
        return { ok: true, value: null };
      }
      return { ok: true, value: driveDirect(value) };
    }

    default: {
      if (empty) return { ok: true, value: '' };
      if (spec.enum && !spec.enum.includes(value)) {
        warn(`${ctx}: 허용되지 않은 값 "${value}" (가능: ${spec.enum.join(' / ')}) — 행을 건너뜀`);
        return { ok: false };
      }
      return { ok: true, value };
    }
  }
}

/**
 * 한 탭의 원본 행(헤더명 → 셀 문자열)을 검증·정규화한다. **절대 throw 하지 않는다.**
 *
 * @param {string} tabName
 * @param {Array<Record<string,string>>} rawRows
 * @returns {{ rows: object[], skipped: number, unpublished: number, warnings: string[] }}
 *          rows = publish 통과 + 정규화 + order 오름차순 정렬 완료
 */
export function validateTab(tabName, rawRows) {
  const schema = SCHEMAS[tabName];
  const warnings = [];
  const warn = (m) => warnings.push(m);

  if (!schema) {
    warn(`알 수 없는 탭 "${tabName}" — 스키마 없음, 통째로 스킵`);
    return { rows: [], skipped: rawRows.length, unpublished: 0, warnings };
  }

  const hasPublish = schema.hasPublish !== false;
  const rows = [];
  let skipped = 0;
  let unpublished = 0;

  rawRows.forEach((raw, i) => {
    const rowNo = i + 2; // 시트 기준 행 번호 (1행 = 헤더)
    const ctx = `${tabName}!${rowNo}`;

    // 미게시 행은 검증하지 않는다. 학생이 작성 중인 초안이 매 빌드마다 경고를
    // 쏟아내면 경고 전체를 무시하게 된다. 게시하겠다고 체크한 행만 따진다.
    if (hasPublish && !toBoolean(raw.publish)) {
      unpublished += 1;
      return;
    }

    const out = {};
    let ok = true;
    for (const [field, spec] of Object.entries(schema.fields)) {
      const res = coerce(raw[field], spec, `${ctx}.${field}`, warn);
      if (!res.ok) {
        ok = false;
        break;
      }
      out[field] = res.value;
    }
    if (!ok) {
      skipped += 1;
      return;
    }

    if (schema.derive) Object.assign(out, schema.derive(out));

    if (hasPublish) {
      out.publish = true;
      const rawOrder = String(raw.order ?? '').trim();
      const order = Number(rawOrder);
      if (rawOrder !== '' && !Number.isFinite(order)) {
        warn(`${ctx}.order: 숫자가 아님 ("${rawOrder}") — 맨 뒤로 정렬`);
      }
      // order 없는 행은 맨 뒤. 시트 입력 순서를 tie-breaker 로 쓴다.
      out.order = Number.isFinite(order) ? order : Number.POSITIVE_INFINITY;
    }
    out._row = rowNo;
    rows.push(out);
  });

  if (hasPublish) rows.sort((a, b) => a.order - b.order || a._row - b._row);
  return { rows, skipped, unpublished, warnings };
}

/** 스키마가 기대하는 헤더 목록 (publish/order 포함) — 드리프트 검사용 */
export function expectedHeaders(tab) {
  const schema = SCHEMAS[tab];
  const base = schema.hasPublish === false ? [] : ['publish', 'order'];
  return [...base, ...Object.keys(schema.fields)];
}
