/**
 * build-artboards — 시트 데이터에서 Claude Design 아티보드(.dc.html)를 생성한다.
 *
 * 테마: 동국대 검정/주황.
 * 레이아웃 문법: imweb 레퍼런스에서 가져온 「좌측 대형 제목 + 우측 내용」 2단 그리드,
 * 하이라인 행 리스트, 알약 아웃라인 버튼, 다단 푸터.
 *
 * 주황의 정확한 CI 값이 아직 미확인이라 아티보드마다 accent 색 트윅을 붙였다.
 * 캔버스 위쪽 칩에서 바꾸면 강조색이 한 번에 따라간다.
 *
 * 출력: design/*.dc.html + design/canvas.json   ·   실행: node design/build-artboards.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const load = (n) => JSON.parse(readFileSync(join(ROOT, 'data-cache', `${n}.json`), 'utf8'));

const Members = load('Members').filter((m) => m.publish === 'TRUE' && m.name_en);
const CV = load('Leader_CV').filter((r) => r.publish === 'TRUE');
const Topics = load('Research_Topics').filter((r) => r.publish === 'TRUE');
const Projects = load('Research_Projects').filter((r) => r.publish === 'TRUE');
const Pubs = load('Publications').filter((r) => r.publish === 'TRUE');
const Patents = load('Patents').filter((r) => r.publish === 'TRUE');
const Teach = load('Teaching').filter((r) => r.publish === 'TRUE');
const News = load('News').filter((r) => r.publish === 'TRUE');
const Config = Object.fromEntries(load('Site_Config').map((r) => [r.key, r.value_en || '']));

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ── 동국대 검정/주황 ─────────────────────────────────────
   중성색은 주황 쪽으로 살짝 따뜻하게 기울였다 — 순회색은 고른 티가 난다. */
const INK = '#14110F';        // 따뜻한 근사 검정
const INK2 = '#3A332E';
const MUT = '#77706B';
const FAINT = '#A9A29C';
const RULE = '#E7E2DE';
const HAIR = '#F1EDE9';
const SOFT = '#FAF8F6';
const ORANGE = '#EA5514';     // 가정값 — 공식 브랜드 가이드 확인 필요
const NOTE_BG = '#F4F2F0';    // 스키마 공백 박스는 브랜드색과 싸우지 않게 중립으로
const SANS = "Inter, 'Pretendard', 'Segoe UI', system-ui, sans-serif";
const MONO = 'Inconsolata, Consolas, monospace';

const A = '{{accent}}';       // 트윅으로 조절되는 강조색

const LOGO = `<svg viewBox="0 0 64 64" width="26" height="26" aria-hidden="true">
      <circle cx="32" cy="32" r="24" fill="none" stroke="${INK}" stroke-width="5.4"></circle>
      <g fill="${INK}"><polygon points="41.75,32.78 38.24,41.86 30.65,44.7 33.02,32.51"></polygon><polygon points="27.05,42.7 18.05,38.99 15.07,31.46 27.21,34.08"></polygon><polygon points="21.98,27.35 25.49,18.27 33.08,15.43 30.71,27.62"></polygon><polygon points="36.68,17.43 45.68,21.14 48.66,28.67 36.52,26.05"></polygon></g>
      <g fill="${ORANGE}"><polygon points="38.24,41.86 31.98,48.4 24.44,45.32 33.02,36.44"></polygon><polygon points="18.05,38.99 15.6,30.2 20.79,23.79 25.14,35.44"></polygon><polygon points="25.49,18.27 31.75,11.73 39.29,14.81 30.71,23.69"></polygon><polygon points="45.68,21.14 48.13,29.93 42.94,36.34 38.59,24.69"></polygon></g>
      <circle cx="32" cy="32" r="6.6" fill="${INK}"></circle><circle cx="32" cy="32" r="2.5" fill="#FFFFFF"></circle>
    </svg>`;

const NAV = ['About', 'Team', 'Research', 'Achievements', 'Teaching', 'News', 'Contact'];

const header = (active) => `
  <div style="display: flex; align-items: center; gap: 22px; height: 74px; padding: 0 110px; border-bottom: 1px solid ${RULE};">
    <div style="display: flex; align-items: center; gap: 9px; flex-grow: 1;">${LOGO}
      <span style="font-size: 14px; font-weight: 700; letter-spacing: -0.02em;">eP Lab</span>
    </div>
    <div style="display: flex; gap: 28px; font-size: 13.5px; font-weight: 500; color: ${MUT};">
      ${NAV.map((n) =>
        n === active
          ? `<span style="color: ${INK}; font-weight: 600; border-bottom: 2px solid ${A}; padding-bottom: 4px;">${n}</span>`
          : `<span>${n}</span>`
      ).join('\n      ')}
    </div>
    <span style="font-size: 12.5px; font-weight: 600; color: ${MUT}; letter-spacing: 0.04em;">ENG</span>
  </div>`;

const footer = () => `
  <div style="border-top: 1px solid ${RULE}; background: ${SOFT}; padding: 54px 110px 40px;">
    <div style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)) auto; gap: 26px; align-items: start;">
      ${[
        ['About', ['Overview', 'Collaborators', 'Contact']],
        ['Team', ['Leader', 'Researchers', 'Alumni']],
        ['Research', ['Topics', 'Projects']],
        ['Achievements', ['Publications', 'Conferences', 'Patents']],
        ['More', ['Teaching', 'News', 'Google Scholar']],
      ].map(([h, items]) => `<div>
        <h4 style="margin: 0 0 14px; font-size: 11.5px; font-weight: 700; color: ${MUT}; letter-spacing: 0.1em; text-transform: uppercase;">${h}</h4>
        <div style="display: grid; gap: 9px;">${items.map((i) => `<span style="font-size: 13px; font-weight: 500;">${i}</span>`).join('')}</div>
      </div>`).join('\n      ')}
      <div><span style="display: inline-block; padding: 10px 19px; border-radius: 99px; border: 1px solid ${RULE}; font-size: 12.5px; font-weight: 600; color: ${MUT};">Back to top &uarr;</span></div>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-top: 44px; padding-top: 20px; border-top: 1px solid ${RULE}; font-size: 12px; color: ${MUT};">
      <span>Dept. of Mechanical, Robotics, and Energy Engineering &middot; Dongguk University</span>
      <span>&copy; 2025 electrified Propulsion Lab.</span>
    </div>
  </div>`;

/** 페이지 머리 — 좌측 대형 제목 + 우측 리드 */
const titleBlock = (eyebrow, title, lead, url) => `
  <div style="padding: 92px 110px 66px; display: grid; grid-template-columns: 1fr 1.45fr; gap: 60px; align-items: end;">
    <div>
      <div style="font-family: ${MONO}; font-size: 12px; letter-spacing: 0.2em; color: ${A}; margin-bottom: 18px;">${eyebrow}</div>
      <h1 style="margin: 0; font-size: 54px; font-weight: 300; letter-spacing: -0.038em; line-height: 1.05;">${title}</h1>
    </div>
    <div>
      <p style="margin: 0 0 12px; font-size: 16px; line-height: 1.8; color: ${MUT}; max-width: 54ch;">${lead}</p>
      <div style="font-family: ${MONO}; font-size: 12px; color: ${FAINT};">${url}</div>
    </div>
  </div>`;

/** imweb 문법의 핵심 — 좌측 큰 제목, 우측 내용 */
const section = (heading, count, content, { soft = false, pad = '92px' } = {}) => `
  <div style="${soft ? `background: ${SOFT}; border-top: 1px solid ${RULE}; border-bottom: 1px solid ${RULE}; ` : ''}padding: ${pad} 110px;">
    <div style="display: grid; grid-template-columns: 1fr 1.45fr; gap: 60px; align-items: start;">
      <div>
        <h2 style="margin: 0 0 10px; font-size: 34px; font-weight: 300; letter-spacing: -0.032em; line-height: 1.15;">${heading}</h2>
        ${count ? `<div style="font-family: ${MONO}; font-size: 12px; letter-spacing: 0.14em; color: ${A};">${count}</div>` : ''}
      </div>
      <div>${content}</div>
    </div>
  </div>`;

const arrow = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${A}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13"></path><path d="M13 6l6 6-6 6"></path></svg>`;

/** 하이라인 행 — 좌측 라벨 / 본문 / 우측 배지 */
const row = (left, main, sub, right, last) => `
      <div style="display: grid; grid-template-columns: ${left ? '116px ' : ''}1fr ${right ? 'auto' : '0px'}; gap: 24px; padding: 21px 0; border-top: 1px solid ${RULE};${last ? ` border-bottom: 1px solid ${RULE};` : ''} align-items: start;">
        ${left ? `<div style="font-family: ${MONO}; font-size: 12.5px; color: ${MUT}; line-height: 1.55;">${left}</div>` : ''}
        <div>
          <h3 style="margin: 0 0 ${sub ? '5px' : '0'}; font-size: 15.5px; font-weight: 700; line-height: 1.45; letter-spacing: -0.012em;">${main}</h3>
          ${sub ? `<p style="margin: 0; font-size: 13px; color: ${MUT}; line-height: 1.55;">${sub}</p>` : ''}
        </div>
        ${right ? `<div style="justify-self: end; display: flex; align-items: center; gap: 12px;">${right}</div>` : '<div></div>'}
      </div>`;

const chip = (label, strong) =>
  `<span style="padding: 4px 11px; border-radius: 99px; ${strong ? `background: ${A}; color: #FFFFFF;` : `background: #F1EDE9; color: ${MUT};`} font-size: 11px; font-weight: 700; letter-spacing: 0.05em; white-space: nowrap;">${esc(label)}</span>`;

const pill = (label, solid) =>
  `<span style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 23px; border-radius: 99px; border: 1px solid ${solid ? A : RULE}; ${solid ? `background: ${A}; color: #FFFFFF;` : `color: ${MUT};`} font-size: 13.5px; font-weight: 600;">${label}</span>`;

/** 스키마 공백 — 브랜드색과 싸우지 않게 중립으로 */
const gap = (text) => `
      <div style="margin: 20px 0 0; padding: 15px 18px; background: ${NOTE_BG}; border-left: 3px solid ${INK2}; font-family: ${MONO}; font-size: 12.5px; color: ${INK2}; line-height: 1.65;">${text}</div>`;

const dash = (h, label) =>
  `<div style="height: ${h}px; border: 1px dashed #D2CBC5; border-radius: 2px; display: flex; align-items: center; justify-content: center; color: ${FAINT}; font-family: ${MONO}; font-size: 11.5px; letter-spacing: 0.1em; text-align: center; line-height: 1.7;">${label}</div>`;

const page = (width, body) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inconsolata:wght@400;600&family=Inter:wght@300;400;500;600;700;800&display=swap');
    body { margin: 0; background: #FFFFFF; }
    a { color: ${ORANGE}; text-decoration: none; }
    a:hover { color: #B8400C; }
  </style>
</helmet>
<div style="width: ${width}px; background: #FFFFFF; color: ${INK}; font-family: ${SANS}; font-size: 16px; line-height: 1.6;">
${body}
</div>
</x-dc>
<script data-dc-script data-props='{"accent":{"editor":"color","default":"${ORANGE}","options":["${ORANGE}","#D94A0F","#F26522","#111111"],"section":"Theme"}}'>
class Component extends DCLogic {
  renderVals() {
    return { accent: this.props.accent ?? '${ORANGE}' };
  }
}
</script>
</body>
</html>
`;

const out = {};
const emit = (name, width, body) => { out[name] = page(width, body); };

/* ══════════ About Us ══════════ */
{
  const areas = [1, 2, 3, 4].map((i) => Config[`research_area_${i}`]).filter(Boolean);
  const body = `${header('About')}

  <div style="padding: 118px 110px 92px; text-align: center;">
    <h1 style="margin: 0 0 30px; font-size: 82px; font-weight: 300; letter-spacing: -0.045em; line-height: 1.02; text-transform: uppercase;">Electrified<br>Propulsion<br>Systems</h1>
    <p style="margin: 0 auto; font-size: 17px; line-height: 1.8; color: ${MUT}; max-width: 60ch;">Electric machine design, electromagnetic&ndash;thermal coupled analysis, and surrogate modeling at Dongguk University.</p>
  </div>

  <div style="height: 340px; background: linear-gradient(168deg, #F7F1EC, #FBF8F5 55%, #F4EFEA); border-top: 1px solid ${RULE}; border-bottom: 1px solid ${RULE}; display: flex; align-items: center; justify-content: center; color: ${FAINT}; font-family: ${MONO}; font-size: 12.5px; letter-spacing: 0.18em;">[HERO ILLUSTRATION &mdash; src/assets/hero.svg]</div>

${section('Research<br>Areas', `0${areas.length} AREAS`, `
      ${areas.map((a, i) => `<a style="display: grid; grid-template-columns: 1fr auto; gap: 22px; align-items: center; padding: 24px 0; border-top: 1px solid ${RULE};${i === areas.length - 1 ? ` border-bottom: 1px solid ${RULE};` : ''}">
        <div>
          <div style="font-family: ${MONO}; font-size: 11px; letter-spacing: 0.18em; color: ${A}; margin-bottom: 7px;">AREA 0${i + 1}</div>
          <h3 style="margin: 0; font-size: 20px; font-weight: 700; line-height: 1.35; letter-spacing: -0.02em;">${esc(a)}</h3>
        </div>
        ${arrow}
      </a>`).join('\n      ')}
      ${gap('[SCHEMA] Site_Config 의 research_area_1~4 와 Research_Topics 6건이 서로 다른 목록입니다. Research_Topics 에 featured 열을 두고 출처를 하나로 합쳐야 합니다.')}`)}

${section('Recent<br>News', `${News.length} ENTRIES`, `
      ${News.slice(0, 4).map((n, i) => row(esc(n.date), esc(n.title_en.slice(0, 120)), '', chip(n.category, n.category === 'Paper'), i === 3)).join('')}
      <div style="margin-top: 26px;">${pill('All news &rarr;', false)}</div>`, { soft: true })}

${section('Collaborators', '00 PUBLISHED', `
      <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px;">
        ${Array.from({ length: 6 }, () => dash(84, '[LOGO]')).join('\n        ')}
      </div>
      ${gap('[DATA] Collaborators 6행이 모두 publish=FALSE 이고 기관명·로고가 비어 있습니다.')}`)}

  <div style="background: ${INK}; color: #F6F3F1; padding: 92px 110px;">
    <div style="display: grid; grid-template-columns: 1fr 1.45fr; gap: 60px; align-items: start;">
      <h2 style="margin: 0; font-size: 40px; font-weight: 300; letter-spacing: -0.035em; line-height: 1.12;">Join<br>the Lab.</h2>
      <div>
        <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.85; color: #B5ADA7; max-width: 60ch;">${esc(Config.recruit_statement)}</p>
        <span style="display: inline-flex; align-items: center; gap: 8px; padding: 13px 25px; border-radius: 99px; background: ${A}; color: #FFFFFF; font-size: 14px; font-weight: 700;">${esc(Config.email)} &nearr;</span>
      </div>
    </div>
  </div>
${footer()}`;
  emit('Main', 1440, body);
}

/* ══════════ Team / Leader ══════════ */
{
  const sec = (s) => CV.filter((r) => r.section === s);
  const list = (s, limit) => {
    const rows = sec(s);
    const shown = limit ? rows.slice(0, limit) : rows;
    return shown.map((r, i) => row(esc(r.date || '&mdash;'), esc(r.title), esc(r.detail || ''), '', i === shown.length - 1)).join('') +
      (rows.length > shown.length ? `<div style="margin-top: 20px;">${pill(`Show all ${rows.length} &rarr;`, false)}</div>` : '');
  };
  const interests = sec('ResearchInterest');
  const body = `${header('Team')}
${titleBlock('TEAM / LEADER', 'Soo-Hwan<br>Park', 'Assistant Professor, Dept. of Mechanical, Robotics, and Energy Engineering, Dongguk University. Ph.D. in Automotive Engineering, Hanyang University.', '/team/leader')}

  <div style="padding: 0 110px 84px; display: grid; grid-template-columns: 1fr 1.45fr; gap: 60px; align-items: start;">
    <div>
      ${dash(360, '[PHOTO]<br>Members.photo_url<br>미입력')}
      <div style="margin-top: 22px; font-size: 13.5px; line-height: 2; color: ${MUT};">
        ${esc(Config.email)}<br>${esc(Config.tel)}<br>${esc(Config.office_1)}
      </div>
      <div style="margin-top: 20px;">${pill('Google Scholar &nearr;', false)}</div>
      ${gap('[DATA] scholar_url 미입력')}
    </div>
    <div>
      <h2 style="margin: 0 0 22px; font-size: 26px; font-weight: 300; letter-spacing: -0.028em;">Research Interests</h2>
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px 26px; margin-bottom: 20px;">
        ${interests.map((r) => `<div style="display: flex; gap: 10px; align-items: baseline; font-size: 14.5px; line-height: 1.6;"><span style="color: ${A}; font-weight: 700;">&bull;</span><span>${esc(r.title)}</span></div>`).join('\n        ')}
      </div>
    </div>
  </div>

${section('Education', `0${sec('Education').length}`, list('Education'), { soft: true, pad: '72px' })}
${section('Experience', `0${sec('Experience').length}`, list('Experience'), { pad: '72px' })}
${section('Awards', `0${sec('Award').length}`, list('Award'), { soft: true, pad: '72px' })}
${section('Academic<br>Activities', `0${sec('Activity').length}`, list('Activity'), { pad: '72px' })}
${section('Invited<br>Talks', `${sec('InvitedTalk').length} TALKS`, list('InvitedTalk', 6) +
  gap('[SCHEMA] Invited Talks 24건이 Leader_CV 안에 section 값으로 들어 있습니다. Achievements/Conferences 에서도 쓰려면 별도 탭 분리를 검토해야 합니다.'), { soft: true, pad: '72px' })}
${footer()}`;
  emit('TeamLeader', 1440, body);
}

/* ══════════ Team / Researchers ══════════ */
{
  const group = (cat) => Members.filter((m) => m.category === cat);
  const card = (m) => `<div style="display: flex; gap: 16px; align-items: flex-start; padding: 20px 0; border-top: 1px solid ${RULE};">
        <div style="width: 60px; height: 60px; flex-shrink: 0;">${dash(60, 'PHOTO')}</div>
        <div>
          <h3 style="margin: 0 0 3px; font-size: 16px; font-weight: 700; letter-spacing: -0.014em;">${esc(m.name_en)}</h3>
          <p style="margin: 0 0 2px; font-size: 13px; color: ${MUT};">${esc(m.position || '')}</p>
          ${m.cohort_period ? `<p style="margin: 0; font-family: ${MONO}; font-size: 12px; color: ${FAINT};">${esc(m.cohort_period)}</p>` : ''}
          ${m.current_affiliation ? `<p style="margin: 5px 0 0; font-size: 12.5px; color: ${A}; font-weight: 600;">&rarr; ${esc(m.current_affiliation)}</p>` : ''}
        </div>
      </div>`;
  const block = (cat, cols) => {
    const g = group(cat);
    if (!g.length) return '';
    return `<div style="display: grid; grid-template-columns: repeat(${cols}, minmax(0, 1fr)); gap: 0 30px;">
      ${g.map(card).join('\n      ')}
    </div>`;
  };
  const body = `${header('Team')}
${titleBlock('TEAM / RESEARCHERS', 'Researchers', `${Members.length} members across faculty, graduate and undergraduate researchers, and alumni.`, '/team/researchers')}
${section('Faculty', '01', block('Faculty', 1), { pad: '64px' })}
${section('Graduate', `0${group('Graduate').length}`, block('Graduate', 2), { soft: true, pad: '64px' })}
${section('Under-<br>graduate', `0${group('Undergraduate').length}`, block('Undergraduate', 2) +
  gap('[DATA] 학부연구생 1명은 name_en 이 비어 게시되지 않습니다 (유나경 — 원본에 Seo-Hyun Hong 로 중복 표기).'), { pad: '64px' })}
${section('Alumni', `0${group('Alumni').length}`, block('Alumni', 2) +
  gap('[DATA] 구성원 사진(photo_url)과 Google Scholar 링크가 전원 미입력입니다.'), { soft: true, pad: '64px' })}
${footer()}`;
  emit('TeamResearchers', 1440, body);
}

/* ══════════ Research / Topics ══════════ */
{
  const body = `${header('Research')}
${titleBlock('RESEARCH / TOPICS', 'Research<br>Topics', 'Six topics spanning machine design, coupled-field analysis, thermal systems, and AI-assisted engineering.', '/research/topics')}
${section('Topics', `0${Topics.length} TOPICS`, `
      ${Topics.map((t, i) => `<a style="display: grid; grid-template-columns: 1fr auto; gap: 22px; align-items: center; padding: 26px 0; border-top: 1px solid ${RULE};${i === Topics.length - 1 ? ` border-bottom: 1px solid ${RULE};` : ''}">
        <div>
          <div style="font-family: ${MONO}; font-size: 11px; letter-spacing: 0.18em; color: ${A}; margin-bottom: 7px;">TOPIC ${String(i + 1).padStart(2, '0')}</div>
          <h3 style="margin: 0 0 6px; font-size: 20px; font-weight: 700; line-height: 1.35; letter-spacing: -0.02em;">${esc(t.title)}</h3>
          <p style="margin: 0; font-size: 13.5px; color: ${FAINT};">[DESCRIPTION 미작성]</p>
        </div>
        ${arrow}
      </a>`).join('\n      ')}
      ${gap('[SCHEMA] description 6건 전부 공란, image_url 전부 미입력. 카드 링크를 만들려면 slug 열이 필요합니다.')}`, { pad: '72px' })}
${footer()}`;
  emit('ResearchTopics', 1440, body);
}

/* ══════════ Research / Projects ══════════ */
{
  const roleChip = (r) => (/^PI\b/.test(r || '') ? chip('PI', true) : /Advisor/i.test(r || '') ? chip('ADVISOR', false) : chip('CO-PI', false));
  const ongoing = Projects.filter((p) => p.status === 'Ongoing');
  const done = Projects.filter((p) => p.status === 'Completed');
  const body = `${header('Research')}
${titleBlock('RESEARCH / PROJECTS', 'Research<br>Projects', `${Projects.length} funded projects with industry and national research partners.`, '/research/projects')}
${section('Projects', `0${Projects.length} PROJECTS`, `
      <div style="display: flex; gap: 8px; margin-bottom: 24px;">
        <span style="padding: 8px 17px; border-radius: 99px; background: ${INK}; color: #FFFFFF; font-size: 13px; font-weight: 600;">Ongoing&nbsp;&nbsp;${ongoing.length}</span>
        <span style="padding: 8px 17px; border-radius: 99px; border: 1px solid ${RULE}; color: ${FAINT}; font-size: 13px; font-weight: 600;">Completed&nbsp;&nbsp;${done.length}</span>
      </div>
      ${ongoing.map((p, i) => row(
        `${esc(p.period_start)}&ndash;${esc(p.period_end)}`,
        esc(p.title_en),
        esc(p.funder_en || ''),
        roleChip(p.role_en),
        i === ongoing.length - 1
      )).join('')}
      ${done.length === 0 ? gap('[DATA] 9건 전부 status=Ongoing 입니다. Completed 탭이 항상 0이므로, 종료 과제를 채우거나 탭을 빼야 합니다.') : ''}`, { pad: '72px' })}
${footer()}`;
  emit('ResearchProjects', 1440, body);
}

/* ══════════ Achievements / Publications ══════════ */
{
  const years = [...new Set(Pubs.map((p) => p.year))].sort((a, b) => Number(b) - Number(a));
  const badge = (m) => {
    const mm = /IF:\s*([\d.]+),\s*(Q\d),\s*JCR:\s*([\d.]+)%/.exec(m || '');
    if (!mm) return '';
    const [, iff, q, jcr] = mm;
    const top = Number(jcr) <= 25;
    return `<div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 11px;">
            <span style="padding: 4px 10px; border-radius: 99px; ${top ? `background: ${A}; color: #FFFFFF;` : `background: #F6EFE9; color: ${INK2};`} font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em;">JCR ${top ? 'TOP ' : ''}${jcr}%</span>
            <span style="padding: 4px 10px; border-radius: 99px; background: #F1EDE9; color: ${INK2}; font-size: 10.5px; font-weight: 700;">${q}</span>
            <span style="padding: 4px 10px; border-radius: 99px; background: #F1EDE9; color: ${MUT}; font-size: 10.5px; font-weight: 700;">IF ${iff}</span>
          </div>`;
  };
  let n = Pubs.length;
  const item = (p) => `
      <div style="display: grid; grid-template-columns: 42px 1fr; gap: 18px; padding: 21px 0; border-top: 1px solid ${HAIR}; align-items: start;">
        <div style="font-family: ${MONO}; font-size: 13px; color: ${FAINT};">[${n--}]</div>
        <div>
          <h3 style="margin: 0 0 5px; font-size: 15.5px; font-weight: 700; line-height: 1.45; letter-spacing: -0.012em;">${esc(p.title)}</h3>
          <p style="margin: 0 0 4px; font-size: 12.5px; color: ${MUT};">${esc(p.authors)}</p>
          <p style="margin: 0; font-size: 13px; color: ${MUT};"><em style="color: ${INK};">${esc(p.venue)}</em>${p.details ? ', ' + esc(p.details) : ''}</p>
          ${badge(p.metrics)}
        </div>
      </div>`;
  const shown = years.slice(0, 3);
  const rest = Pubs.length - shown.reduce((a, y) => a + Pubs.filter((p) => p.year === y).length, 0);
  const body = `${header('Achievements')}
${titleBlock('ACHIEVEMENTS / PUBLICATIONS', 'Publications', `${Pubs.length} peer-reviewed journal articles, ${years[years.length - 1]}&ndash;${years[0]}.`, '/achievements/publications')}
${shown.map((y, k) => section(String(y), `${String(Pubs.filter((p) => p.year === y).length).padStart(2, '0')} ARTICLES`,
    Pubs.filter((p) => p.year === y).map(item).join(''), { soft: k % 2 === 1, pad: '64px' })).join('\n')}
${section('Earlier', `${rest} MORE`, `
      <div style="font-family: ${MONO}; font-size: 13.5px; color: ${MUT}; line-height: 2;">${years.slice(3).join(' &middot; ')}</div>
      <div style="margin-top: 22px;">${pill('Show all 34 &rarr;', false)}</div>
      ${gap('[IDEA] Greene Lab 템플릿처럼 doi 만으로 저자·학술지·연도를 자동으로 채울 수 있습니다. 지금은 학생이 전부 손으로 입력해야 합니다.')}`, { pad: '64px' })}
${footer()}`;
  emit('Publications', 1440, body);
}

/* ══════════ Achievements / Conferences ══════════ */
{
  const confNews = News.filter((n) => n.category === 'Conference');
  const talks = CV.filter((r) => r.section === 'InvitedTalk');
  const body = `${header('Achievements')}
${titleBlock('ACHIEVEMENTS / CONFERENCES', 'Conferences', 'Conference papers and presentations.', '/achievements/conferences')}

  <div style="padding: 0 110px 40px;">
    <div style="padding: 30px 32px; background: ${INK}; color: #F6F3F1; border-radius: 2px;">
      <div style="font-family: ${MONO}; font-size: 12px; letter-spacing: 0.2em; color: ${A}; margin-bottom: 12px;">NO DATA SOURCE</div>
      <h2 style="margin: 0 0 12px; font-size: 26px; font-weight: 400; letter-spacing: -0.028em;">이 페이지를 채울 탭이 시트에 없습니다.</h2>
      <p style="margin: 0; font-size: 15px; line-height: 1.85; color: #B5ADA7; max-width: 72ch;">Publications 탭은 학술지 논문 ${Pubs.length}편만 담고 있습니다. 학회 논문·발표를 실으려면 <strong style="color: #F6F3F1;">Conferences 탭을 새로 만들어야</strong> 합니다. 아래 두 후보는 현재 시트에서 가장 가깝지만 둘 다 학회 논문이 아닙니다.</p>
    </div>
  </div>

${section('후보 A<br>News', `${confNews.length} ENTRIES`, `
      <p style="margin: 0 0 18px; font-size: 14px; color: ${MUT};">News 의 <code style="font-family: ${MONO};">category=Conference</code> — 학회 <strong>참가 소식</strong>이라 발표 논문 제목·저자·학회명이 분리돼 있지 않습니다.</p>
      ${confNews.map((n, i) => row(esc(n.date), esc(n.title_en), '', chip('NEWS', false), i === confNews.length - 1)).join('')}`, { pad: '64px' })}

${section('후보 B<br>Invited Talks', `${talks.length} ENTRIES`, `
      <p style="margin: 0 0 18px; font-size: 14px; color: ${MUT};">Leader_CV 의 <code style="font-family: ${MONO};">section=InvitedTalk</code> — 교수 개인의 <strong>초청강연</strong>이라 성격이 다르고, Team/Leader 에 이미 실려 있습니다.</p>
      ${talks.slice(0, 4).map((r, i) => row(esc(r.date), esc(r.title), esc(r.detail || ''), chip('TALK', false), i === 3)).join('')}
      ${gap('[SCHEMA] 제안 &mdash; Conferences 탭 신설:<br>publish, order, year, authors, title, conference, location, date, type(Oral/Poster), note<br>Publications 와 열 구조를 맞추면 템플릿을 재사용할 수 있습니다.')}`, { soft: true, pad: '64px' })}
${footer()}`;
  emit('Conferences', 1440, body);
}

/* ══════════ Achievements / Patents ══════════ */
{
  const body = `${header('Achievements')}
${titleBlock('ACHIEVEMENTS / PATENTS', 'Patents', `${Patents.length} registered US patents.`, '/achievements/patents')}
${section('Registered', `0${Patents.length}`, `
      ${Patents.map((p, i) => row(
        `${esc(p.country)} &middot; ${esc(p.year)}`,
        esc(p.title),
        p.inventors ? esc(p.inventors) : `<span style="color: ${FAINT};">[INVENTORS 미입력]</span>`,
        `<span style="font-family: ${MONO}; font-size: 12.5px; color: ${MUT};">${esc(p.patent_no)}</span>`,
        i === Patents.length - 1
      )).join('')}
      ${gap('[DATA] inventors 열이 2건 모두 비어 있습니다.')}`, { pad: '72px' })}
${footer()}`;
  emit('Patents', 1440, body);
}

/* ══════════ Teaching ══════════ */
{
  const lvl = (l) => Teach.filter((t) => t.level === l);
  const block = (l) => lvl(l).map((t, i, arr) => row(
    esc(t.course_code || '&mdash;'),
    esc(t.title_en),
    '',
    '',
    i === arr.length - 1
  )).join('');
  const body = `${header('Teaching')}
${titleBlock('TEACHING', 'Teaching', `${Teach.length} courses across undergraduate and graduate programs.`, '/teaching')}
${section('Under-<br>graduate', `0${lvl('Undergraduate').length} COURSES`, block('Undergraduate'), { pad: '68px' })}
${section('Graduate', `0${lvl('Graduate').length} COURSES`, block('Graduate'), { soft: true, pad: '68px' })}
${footer()}`;
  emit('Teaching', 1440, body);
}

/* ══════════ News ══════════ */
{
  const cats = [...new Set(News.map((n) => n.category))];
  const shown = News.slice(0, 8);
  const body = `${header('News')}
${titleBlock('NEWS', 'News', `${News.length} updates on papers, projects, conferences, and people.`, '/news')}
${section('All<br>Updates', `${News.length} ENTRIES`, `
      <div style="display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap;">
        <span style="padding: 8px 16px; border-radius: 99px; background: ${INK}; color: #FFFFFF; font-size: 12.5px; font-weight: 600;">All ${News.length}</span>
        ${cats.map((c) => `<span style="padding: 8px 16px; border-radius: 99px; border: 1px solid ${RULE}; color: ${MUT}; font-size: 12.5px; font-weight: 600;">${esc(c)} ${News.filter((n) => n.category === c).length}</span>`).join('\n        ')}
      </div>
      ${shown.map((n, i) => row(esc(n.date), esc(n.title_en), '', chip(n.category, n.category === 'Paper'), i === shown.length - 1)).join('')}
      <div style="margin-top: 24px;">${pill(`Show all ${News.length} &rarr;`, false)}</div>
      ${gap('[DECISION] 뉴스 상세 페이지를 둘지 미정입니다. image_url 이 16건 전부 비어 있어 지금은 목록만으로 충분해 보입니다.')}`, { pad: '68px' })}
${footer()}`;
  emit('News', 1440, body);
}

/* ══════════ Contact ══════════ */
{
  const line = (label, value, last) => `
      <div style="display: grid; grid-template-columns: 130px 1fr; gap: 24px; padding: 21px 0; border-top: 1px solid ${RULE};${last ? ` border-bottom: 1px solid ${RULE};` : ''}">
        <div style="font-family: ${MONO}; font-size: 11.5px; letter-spacing: 0.14em; color: ${A};">${label}</div>
        <div style="font-size: 15.5px; line-height: 1.6;">${value}</div>
      </div>`;
  const body = `${header('Contact')}
${titleBlock('CONTACT', 'Contact', 'Dept. of Mechanical, Robotics, and Energy Engineering, Dongguk University.', '/contact')}
${section('Reach<br>the Lab', '', `
      ${line('E-MAIL', esc(Config.email))}
      ${line('TEL', esc(Config.tel))}
      ${line('OFFICE', esc(Config.office_1))}
      ${line('LAB', esc(Config.office_2), true)}
      <div style="margin-top: 30px;">${pill(`${esc(Config.email)} &nearr;`, true)}</div>
      <div style="margin-top: 40px;">${dash(320, '[MAP]')}</div>`, { pad: '72px' })}
${footer()}`;
  emit('Contact', 1440, body);
}

/* ══════════ Topic detail (링크 목적지) ══════════ */
{
  const body = `${header('Research')}
  <div style="padding: 40px 110px 0; font-family: ${MONO}; font-size: 12.5px; color: ${MUT};">
    Research &nbsp;/&nbsp; Topics &nbsp;/&nbsp; <span style="color: ${INK};">Thermal management of electrified powertrain</span>
  </div>
${titleBlock('TOPIC 05', 'Thermal<br>management', '[DESCRIPTION — Research_Topics.description 미작성. 1~2문단 분량이 들어갈 자리입니다.]', '/research/topics/thermal-management')}
  <div style="padding: 0 110px 72px;">${dash(300, '[IMAGE &mdash; Research_Topics.image_url 미입력]')}</div>
${section('Related<br>Projects', '02', `
      ${row('26.02&ndash;26.12', 'Analysis model for vehicle thermal management under PE inefficiency control', 'Hyundai Motor Company', chip('PI', true), false)}
      ${row('26.04&ndash;27.04', 'PE system optimization for low-cost motors', 'Hyundai Motor Company', chip('PI', true), true)}
      ${gap('[SCHEMA] 연결 근거 없음 &mdash; Research_Projects 에 topic 참조 열이 필요합니다.')}`, { soft: true, pad: '64px' })}
${section('Related<br>Publications', '01', `
      ${row('2019', 'Design of Surface-mounted Permanent Magnet Synchronous Motor using Electromagnetic and Thermal Analysis', 'S. H. Park, J. C. Park, J. W. Chin, H. J. Park, S. O. Kwon, S. I. Kim, and M. S. Lim*', chip('Q4', false), true)}
      ${gap('[SCHEMA] 연결 근거 없음 &mdash; Publications 에 topic 참조 열이 필요합니다.')}`, { pad: '64px' })}
${footer()}`;
  emit('TopicDetail', 1440, body);
}

/* ══════════ Mobile (About) ══════════ */
{
  const areas = [1, 2, 3, 4].map((i) => Config[`research_area_${i}`]).filter(Boolean);
  const body = `
  <div style="display: flex; align-items: center; gap: 10px; height: 60px; padding: 0 20px; border-bottom: 1px solid ${RULE};">
    ${LOGO}
    <span style="font-size: 14px; font-weight: 700; letter-spacing: -0.02em; flex-grow: 1;">eP Lab</span>
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16"></path><path d="M4 12h16"></path><path d="M4 17h16"></path></svg>
  </div>

  <div style="padding: 52px 20px 40px;">
    <h1 style="margin: 0 0 20px; font-size: 40px; font-weight: 300; letter-spacing: -0.042em; line-height: 1.04; text-transform: uppercase;">Electrified<br>Propulsion<br>Systems</h1>
    <p style="margin: 0; font-size: 14.5px; line-height: 1.78; color: ${MUT};">Electric machine design, electromagnetic&ndash;thermal coupled analysis, and surrogate modeling at Dongguk University.</p>
  </div>

  <div style="height: 210px; background: linear-gradient(168deg, #F7F1EC, #FBF8F5 55%, #F4EFEA); border-top: 1px solid ${RULE}; border-bottom: 1px solid ${RULE}; display: flex; align-items: center; justify-content: center; color: ${FAINT}; font-family: ${MONO}; font-size: 11px; letter-spacing: 0.14em;">[HERO ILLUSTRATION]</div>

  <div style="padding: 40px 20px;">
    <h2 style="margin: 0 0 6px; font-size: 26px; font-weight: 300; letter-spacing: -0.03em;">Research Areas</h2>
    <div style="font-family: ${MONO}; font-size: 11.5px; letter-spacing: 0.14em; color: ${A}; margin-bottom: 18px;">0${areas.length} AREAS</div>
    ${areas.map((a, i) => `<div style="display: grid; grid-template-columns: 1fr auto; gap: 14px; align-items: center; padding: 18px 0; border-top: 1px solid ${RULE};${i === areas.length - 1 ? ` border-bottom: 1px solid ${RULE};` : ''}">
      <div>
        <div style="font-family: ${MONO}; font-size: 10.5px; letter-spacing: 0.18em; color: ${A}; margin-bottom: 5px;">AREA 0${i + 1}</div>
        <h3 style="margin: 0; font-size: 16px; font-weight: 700; line-height: 1.4; letter-spacing: -0.018em;">${esc(a)}</h3>
      </div>
      ${arrow}
    </div>`).join('\n    ')}
  </div>

  <div style="background: ${SOFT}; border-top: 1px solid ${RULE}; padding: 40px 20px;">
    <h2 style="margin: 0 0 6px; font-size: 26px; font-weight: 300; letter-spacing: -0.03em;">Recent News</h2>
    <div style="font-family: ${MONO}; font-size: 11.5px; letter-spacing: 0.14em; color: ${A}; margin-bottom: 18px;">${News.length} ENTRIES</div>
    ${News.slice(0, 3).map((n, i) => `<div style="padding: 16px 0; border-top: 1px solid ${RULE};${i === 2 ? ` border-bottom: 1px solid ${RULE};` : ''}">
      <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 6px;">
        <span style="font-family: ${MONO}; font-size: 12px; color: ${MUT};">${esc(n.date)}</span>
        ${chip(n.category, n.category === 'Paper')}
      </div>
      <h3 style="margin: 0; font-size: 14.5px; font-weight: 700; line-height: 1.45;">${esc(n.title_en.slice(0, 100))}</h3>
    </div>`).join('\n    ')}
  </div>

  <div style="background: ${INK}; color: #F6F3F1; padding: 44px 20px;">
    <h2 style="margin: 0 0 14px; font-size: 30px; font-weight: 300; letter-spacing: -0.032em; line-height: 1.12;">Join the Lab.</h2>
    <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.8; color: #B5ADA7;">${esc(Config.recruit_statement)}</p>
    <span style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 22px; border-radius: 99px; background: ${A}; color: #FFFFFF; font-size: 13.5px; font-weight: 700;">${esc(Config.email)} &nearr;</span>
  </div>

  <div style="padding: 28px 20px 34px; font-size: 11.5px; color: ${MUT}; line-height: 1.8;">
    Dept. of Mechanical, Robotics, and Energy Engineering<br>Dongguk University<br>&copy; 2025 electrified Propulsion Lab.
  </div>`;
  emit('Mobile', 390, body);
}

/* ══════════ 파일 쓰기 ══════════ */
for (const [name, html] of Object.entries(out)) {
  writeFileSync(join(HERE, `${name}.dc.html`), html, 'utf8');
}

const COL = 1580;
const board = (file, title, x, y, w, h, page) => ({ file: `${file}.dc.html`, title, x, y, w, h, page });

const canvas = {
  pages: [
    { id: 'page-1', name: 'Site tree' },
    { id: 'page-2', name: 'Detail & mobile' },
  ],
  artboards: [
    board('Main', 'About Us  /', 0, 0, 1440, 3500, 'page-1'),
    board('TeamLeader', 'Team › Leader  /team/leader', COL, 0, 1440, 4200, 'page-1'),
    board('TeamResearchers', 'Team › Researchers  /team/researchers', COL * 2, 0, 1440, 3200, 'page-1'),
    board('ResearchTopics', 'Research › Topics  /research/topics', 0, 4400, 1440, 1600, 'page-1'),
    board('ResearchProjects', 'Research › Projects  /research/projects', COL, 4400, 1440, 1700, 'page-1'),
    board('Publications', 'Achievements › Publications', COL * 2, 4400, 1440, 3200, 'page-1'),
    board('Conferences', 'Achievements › Conferences', 0, 7800, 1440, 2100, 'page-1'),
    board('Patents', 'Achievements › Patents', COL, 7800, 1440, 1100, 'page-1'),
    board('Teaching', 'Teaching  /teaching', COL * 2, 7800, 1440, 1500, 'page-1'),
    board('News', 'News  /news', 0, 10100, 1440, 1800, 'page-1'),
    board('Contact', 'Contact  /contact', COL, 10100, 1440, 1500, 'page-1'),

    board('TopicDetail', 'Topic detail — 링크 목적지', 0, 0, 1440, 2200, 'page-2'),
    board('Mobile', 'About — mobile 390', COL, 0, 390, 2100, 'page-2'),
  ],
  annotations: [
    {
      id: 'note-theme', page: 'page-1', x: 0, y: -330, w: 520,
      text: '테마 — 동국대 검정/주황\n\n검정 #14110F (주황 쪽으로 살짝 따뜻하게 기울인 근사 검정), 주황 #EA5514.\n\n주황은 가정값입니다. 각 아티보드 위 Theme 칩에서 accent 색을 바꾸면 강조색이 한 번에 따라갑니다 — 공식 CI 값을 확인하시면 그 값으로 맞추면 됩니다.\n\n레이아웃은 imweb 레퍼런스의 문법입니다: 좌측 대형 제목 + 우측 내용 2단, 하이라인 행 리스트, 알약 버튼, 다단 푸터.',
    },
    {
      id: 'note-conf', page: 'page-1', x: 0, y: 7470, w: 520,
      text: 'Conferences 가 이번 트리의 최대 쟁점입니다.\n\n시트에 학회 논문 데이터가 아예 없습니다. Publications 는 학술지 34편 전용, News 의 Conference 4건은 참가 소식, Leader_CV 의 InvitedTalk 24건은 초청강연입니다.\n\n→ Conferences 탭 신설이 필요합니다.',
    },
    {
      id: 'note-schema', page: 'page-1', x: COL * 2, y: -330, w: 520,
      text: '이 트리가 요구하는 스키마 변경\n\n1. Conferences 탭 신설 (데이터 자체가 없음)\n2. Research_Topics: slug · description · featured\n3. Research_Projects / Publications: topic 참조 열\n4. Members: photo_url · scholar_url (전원 미입력)\n5. Collaborators: 6행 전부 공란\n6. Patents: inventors 2건 공란\n\n시트를 아직 올리지 않으셨으니 지금 바꾸는 게 가장 쌉니다.',
    },
  ],
  launch: { view: 'canvas', page: 'page-1' },
};

writeFileSync(join(HERE, 'canvas.json'), JSON.stringify(canvas, null, 2) + '\n', 'utf8');
console.log(`아티보드 ${Object.keys(out).length}개 + canvas.json (보드 ${canvas.artboards.length}, 페이지 ${canvas.pages.length})`);
