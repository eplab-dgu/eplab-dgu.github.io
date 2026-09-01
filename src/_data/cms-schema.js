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

// ── enum 목록 (시트의 데이터 유효성 검사와 같은 값을 유지할 것) ──────────────
const MEMBER_CATEGORIES = ['Faculty', 'Graduate', 'Undergraduate', 'Alumni'];
const CV_SECTIONS = ['ResearchInterest', 'Education', 'Experience', 'Award', 'Activity'];
const NEWS_CATEGORIES = ['Paper', 'Research', 'Conference', 'Event', 'People', 'Award'];
const PROJECT_STATUS = ['Ongoing', 'Completed'];
const TEACHING_LEVELS = ['Undergraduate', 'Graduate'];
const PATENT_STATUS = ['Registered', 'Filed', 'Pending'];

/**
 * 필드 스펙:
 *   required : 비면 **행 전체 스킵** (경고)
 *   enum     : 목록 밖 값이면 **행 전체 스킵** (경고)
 *   type     : 'string'(기본) | 'number' | 'boolean' | 'url' | 'list'
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
      photo_url: { type: 'url' },
      scholar_url: { type: 'url' },
      notes: {},
    },
    derive: (r) => ({ name: r.name_en || r.name_ko || '' }),
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
    derive: (r) => ({ detailLines: splitList(r.detail, ' | ') }),
  },

  // ── Research ──────────────────────────────────────────────────────────────
  Research_Topics: {
    fields: {
      no: {},
      title_en: { required: true },
      title_ko: {},
      description: {},
      tags: { type: 'list' },
      image_url: { type: 'url' },
    },
    derive: (r) => ({ title: r.title_en || r.title_ko || '' }),
  },

  Research_Projects: {
    fields: {
      status: { required: true, enum: PROJECT_STATUS },
      title_en: { required: true },
      title_ko: {},
      partner: {},
      partner_logo_url: { type: 'url' },
      period_start: {},
      period_end: {},
      notes: {},
    },
    derive: (r) => ({
      title: r.title_en || r.title_ko || '',
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
      featured: { type: 'boolean' },
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
    derive: (r) => ({ title: r.title_en || r.title_ko || '' }),
  },

  // ── News / Gallery ────────────────────────────────────────────────────────
  News: {
    fields: {
      date: { required: true },
      category: { enum: NEWS_CATEGORIES },
      text_ko: {},
      text_en: {},
      image_url: { type: 'url' },
    },
    // 영어 전용 사이트지만(CLAUDE.md §2) 뉴스 영문 번역이 아직 비어 있다.
    // 번역이 채워지기 전까지는 한국어 원문이라도 내보낸다 — 빈 카드보다 낫다.
    // isFallbackKo 로 "아직 번역 안 된 행"을 세어 빌드 로그에 보고한다.
    derive: (r) => ({
      text: r.text_en || r.text_ko || '',
      isFallbackKo: !r.text_en && !!r.text_ko,
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
    derive: (r) => ({ year: yearOf(r.date) }),
  },

  // ── About ─────────────────────────────────────────────────────────────────
  Collaborators: {
    fields: {
      name: { required: true },
      logo_url: { type: 'url' },
      url: { type: 'url' },
      notes: {},
    },
  },
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
