/**
 * hero-illustration — 랜딩페이지 히어로 배경 일러스트(아이소메트릭 플랫 벡터)를 SVG 로 생성한다.
 *
 * 왜 코드로 그리는가: 시트에 쓸 수 있는 사진이 한 장도 없다(News 0/16, Research_Topics 0/6).
 * 히어로를 사진에 의존하지 않으려면 그림 자체를 만들어야 하고, 코드로 만들면 색·배치·요소를
 * 나중에 값만 바꿔 다시 뽑을 수 있다.
 *
 * 표현 대상 — 전동화 추진시스템이 실리는 여섯 가지 부하:
 *   해수면 → 지상 → 공중 → 우주 로 고도가 올라가는 순서로 배치한다.
 *   1) 전기추진선박  2) 전기자동차  3) AI 데이터센터 HVAC
 *   4) 초고압변압기  5) 전기추진항공기  6) 전기추진 우주선
 * 이들을 잇는 것은 좌하단의 전동기 단면 — 연구실의 실제 주제다.
 *
 * 히어로 "배경"이므로 좌상단(제목이 앉는 자리)은 비워 둔다.
 *
 *   npm run hero
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src', 'assets');

/**
 * 레이아웃 — 같은 도형을 두 가지 구도로 배치한다.
 *
 * 가로 배너 하나를 모바일에서 잘라 쓰면, 폭이 좁아질수록 그림이 오히려 확대되고
 * 여섯 대상 중 두엇만 남는다. 그래서 세로 구도를 따로 뽑아 미디어 쿼리로 바꿔 끼운다.
 *   [x, y, scale] · lineTo: 변압기 가공선이 데이터센터로 향하는 로컬 오프셋
 */
const LAYOUTS = {
  hero: {
    file: 'hero.svg', W: 1600, H: 760,
    motor: [160, 656, 2.6], ship: [452, 470, 2.3], ev: [700, 672, 2.2],
    datacenter: [898, 368, 2.15], transformer: [1118, 614, 2.0],
    aircraft: [1262, 282, 1.9], spacecraft: [1450, 114, 1.85],
    idp: '', lineTo: [-104, -60],
    haze: [0.6, 0.36],
    flow:
      'M 158 700 C 244 626, 346 502, 448 488 ' +
      'S 618 638, 698 686 S 840 430, 894 384 ' +
      'S 1050 582, 1116 626 S 1216 352, 1260 296 S 1398 168, 1446 130',
    nodes: [[448, 488], [698, 686], [894, 384], [1116, 626], [1260, 296], [1446, 130]],
  },
  'hero-portrait': {
    file: 'hero-portrait.svg', W: 860, H: 980,
    motor: [138, 890, 2.0], ship: [452, 812, 2.05], ev: [212, 688, 1.95],
    transformer: [586, 596, 1.85], datacenter: [246, 470, 1.9],
    aircraft: [566, 332, 1.7], spacecraft: [300, 146, 1.68],
    idp: 'p-', lineTo: [-176, -53],
    haze: [0.5, 0.3],
    flow:
      'M 132 918 C 232 962, 320 890, 400 852 ' +
      'S 300 782, 232 742 S 460 690, 540 640 ' +
      'S 300 566, 246 520 S 520 430, 566 380 S 380 220, 306 178',
    nodes: [[400, 852], [232, 742], [540, 640], [246, 520], [566, 380], [306, 178]],
  },
};

/** 현재 그리는 중인 레이아웃. 아래 렌더 루프가 세팅한다. */
let L = LAYOUTS.hero;
/** 레이아웃별 id 접두사. 한 HTML 문서에 두 SVG 를 인라인해도 defs 가 섞이지 않는다. */
const ID = (n) => `${L.idp}${n}`;

/* ── 팔레트 ──────────────────────────────────────────────── */
const C = {
  navy: '#173E60',
  navyD: '#102B44',
  steel: '#8FA6B8',
  teal: '#1E8FA3',
  tealL: '#4FBCCB',
  blue: '#2E6FD4',
  blueL: '#6098E6',
  green: '#3BA47C',
  greenL: '#6FC8A2',
  amber: '#EFA33B',
  amberL: '#F6C67E',
  paper: '#E6EFF6',
  paper2: '#CFDFEA',
  paperD: '#B7CBDA',
  sea: '#B6DCE7',
  ink: '#0E2A44',
  copper: '#B0703C',
  copperL: '#D2924F',
  insul: '#EFE9DE',
  alu: '#C4CACF',
  lam: '#94A0AA',
};

/* ── 색 보정 ─────────────────────────────────────────────── */
const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
function rgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
/** amt > 0 이면 흰색 쪽으로, < 0 이면 검정 쪽으로 */
function shade(hex, amt) {
  const [r, g, b] = rgb(hex);
  const t = Math.abs(amt);
  const to = amt > 0 ? 255 : 0;
  return `#${[r, g, b].map((v) => clamp(v + (to - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/* ── 아이소메트릭 투영 ───────────────────────────────────── */
const K = Math.cos(Math.PI / 6); // 0.8660
const iso = (x, y, z) => [(x - y) * K, (x + y) * 0.5 - z];
const f = (n) => (Math.round(n * 100) / 100).toString();

function poly(pts, fill, extra = '') {
  return `<polygon points="${pts.map(([a, b]) => `${f(a)},${f(b)}`).join(' ')}" fill="${fill}"${extra}/>`;
}

/** 아이소메트릭 직육면체. 보이는 3면(윗면 / 좌면=y+d / 우면=x+w)만 그린다. */
function box(x, y, z, w, d, h, color, o = {}) {
  const { top = 0.20, left = -0.28, right = -0.07, extra = '' } = o;
  const P = iso;
  const fTop = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)];
  const fLeft = [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)];
  const fRight = [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)];
  return (
    poly(fRight, shade(color, right), extra) +
    poly(fLeft, shade(color, left), extra) +
    poly(fTop, shade(color, top), extra)
  );
}

/** z 평면에 놓인 원 → 아이소메트릭 타원 (rx:ry = 1 : 0.577) */
function disc(cx, cy, cz, r, fill, extra = '') {
  const [sx, sy] = iso(cx, cy, cz);
  return `<ellipse cx="${f(sx)}" cy="${f(sy)}" rx="${f(r * K * Math.SQRT2)}" ry="${f(r * 0.5 * Math.SQRT2)}" fill="${fill}"${extra}/>`;
}

/** 면에 붙는 얇은 띠 (창문 밴드 등). side: 'left' | 'right' */
function bandLeft(x, y, z, w, d, h, color) {
  return box(x, y + d - 0.35, z, w, 0.35, h, color, { top: 0, left: 0, right: 0 });
}
function bandRight(x, y, z, w, d, h, color) {
  return box(x + w, y, z, 0.35, d, h, color, { top: 0, left: 0, right: 0 });
}

/** 진행방향(+x)을 향하는 수직 원판. 프로펠러처럼 xy 평면이 아닌 원을 정확히 투영한다. */
function discYZ(cx, cy, cz, r, fill, extra = '') {
  const pts = [];
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2;
    pts.push(iso(cx, cy + Math.cos(a) * r, cz + Math.sin(a) * r));
  }
  return poly(pts, fill, extra);
}
/** 원판 중심에서 테두리로 뻗는 블레이드 */
function bladeYZ(cx, cy, cz, r, ang, stroke, w) {
  const [x0, y0] = iso(cx, cy, cz);
  const [x1, y1] = iso(cx, cy + Math.cos(ang) * r, cz + Math.sin(ang) * r);
  return `<line x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`;
}

/**
 * 평면형(planform) 판재. 임의의 xy 다각형을 두께 h 만큼 압출한 것처럼 보이게 한다.
 * 아랫면을 먼저 깔고 윗면을 h 만큼 위에 얹으면, 가려지지 않은 아래쪽 가장자리가
 * 그대로 두께로 읽힌다. 날개처럼 박스로 조립할 수 없는 형태에 쓴다.
 */
function plate(ptsXY, z, h, color) {
  const lo = ptsXY.map(([x, y]) => iso(x, y, z));
  const hi = ptsXY.map(([x, y]) => iso(x, y, z + h));
  return poly(lo, shade(color, -0.34)) + poly(hi, shade(color, 0.14));
}

const g = (sx, sy, s, body) => `<g transform="translate(${f(sx)},${f(sy)}) scale(${s})">${body}</g>`;
const shadow = (r = 30, ry = 0.4) =>
  `<ellipse cx="0" cy="0" rx="${r}" ry="${r * ry}" fill="${C.ink}" opacity="0.045"/>`;

/* ══════════════════════════════════════════════════════════
   1. 전동기 단면 — 여섯 부하를 잇는 출발점
   ══════════════════════════════════════════════════════════ */
function motor() {
  /* 참고 사진의 헤어핀 권선 고정자 구조를 따른다.
     바깥에서 안으로: 알루미늄 하우징 → 규소강판 적층 철심 → 구리 버스바 링 →
     헤어핀 엔드와인딩 2겹(구리 바 + 흰 절연 캡) → 공극 → 8극 영구자석 회전자. */
  const R = 26;      // 하우징 외경
  const RC = 23.6;   // 철심 외경
  const RB = 21.4;   // 버스바 링
  const RI = 12.4;   // 회전자 외경
  const HH = 11;     // 적층 높이
  const rx = R * K * Math.SQRT2, ry = R * 0.5 * Math.SQRT2;

  let s = '';

  // ── 하우징 배럴 + 적층 줄무늬
  const [tx, ty] = iso(0, 0, HH);
  const [bx, by] = iso(0, 0, 0);
  s += `<path d="M ${f(tx - rx)} ${f(ty)} A ${f(rx)} ${f(ry)} 0 0 0 ${f(tx + rx)} ${f(ty)} L ${f(bx + rx)} ${f(by)} A ${f(rx)} ${f(ry)} 0 0 1 ${f(bx - rx)} ${f(by)} Z" fill="${shade(C.alu, -0.34)}"/>`;
  for (let i = 1; i < 30; i++) {
    const dx = -rx + (i / 30) * rx * 2;
    const yTop = ty + ry * Math.sqrt(Math.max(0, 1 - (dx / rx) * (dx / rx)));
    s += `<line x1="${f(tx + dx)}" y1="${f(yTop)}" x2="${f(tx + dx)}" y2="${f(yTop + HH)}" stroke="${shade(C.alu, -0.46)}" stroke-width="0.4" opacity="0.5"/>`;
  }

  // ── 상면: 하우징 링 → 적층 철심 → 슬롯 티스
  s += disc(0, 0, HH, R, C.alu);
  s += disc(0, 0, HH + 0.15, RC, C.lam);
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    const [x0, y0] = iso(Math.cos(a) * (RI + 1.2), Math.sin(a) * (RI + 1.2), HH + 0.25);
    const [x1, y1] = iso(Math.cos(a) * (RC - 0.6), Math.sin(a) * (RC - 0.6), HH + 0.25);
    s += `<line x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}" stroke="${shade(C.lam, -0.26)}" stroke-width="0.34" opacity="0.75"/>`;
  }

  // ── 구리 버스바 링 (큰 원판 위에 작은 원판을 덮어 링을 만든다)
  s += disc(0, 0, HH + 0.35, RB, C.copper);
  s += disc(0, 0, HH + 0.4, RB - 1.6, shade(C.lam, -0.1));

  // ── 공극 + 회전자 + 8극 영구자석
  s += disc(0, 0, HH + 0.5, RI + 1, C.paper);
  s += disc(0, 0, HH + 0.6, RI, C.navy);
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * Math.PI * 2 + 0.13, a1 = a0 + Math.PI / 7.4;
    const r0 = RI * 0.56, r1 = RI * 0.93;
    s += poly([
      iso(Math.cos(a0) * r0, Math.sin(a0) * r0, HH + 0.8),
      iso(Math.cos(a1) * r0, Math.sin(a1) * r0, HH + 0.8),
      iso(Math.cos(a1) * r1, Math.sin(a1) * r1, HH + 0.8),
      iso(Math.cos(a0) * r1, Math.sin(a0) * r1, HH + 0.8),
    ], k % 2 ? C.blue : C.amber);
  }
  s += disc(0, 0, HH + 1, 4.6, C.steel);
  s += disc(0, 0, HH + 1.1, 2.4, shade(C.steel, -0.35));

  /* ── 헤어핀 엔드와인딩 2겹.
     구리 바가 축 방향으로 솟고 끝단에 흰 절연 캡이 덮인다. 화면 앞쪽(x+y 가 큰 것)이
     뒤쪽을 가려야 하므로 (x+y) 오름차순으로 정렬해 그린다. */
  const pins = [];
  for (const [rr, n, off] of [[15.6, 44, 0], [19.2, 44, Math.PI / 44]]) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + off;
      pins.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
  }
  pins.sort((u, v) => u[0] + u[1] - (v[0] + v[1]));
  for (const [px, py] of pins) {
    s += box(px - 0.58, py - 0.58, HH + 0.4, 1.16, 1.16, 2.1, C.copper, { top: 0.3, left: -0.28, right: -0.08 });
    s += disc(px, py, HH + 2.5, 1.32, C.insul);
    s += disc(px, py, HH + 2.66, 0.78, shade(C.insul, -0.13));
  }

  // ── 3상 단자 — 버스바 링 위에 올라앉은 구리 단자대
  for (const a of [Math.PI * 0.66, Math.PI * 0.82, Math.PI * 0.98]) {
    const px = Math.cos(a) * RB, py = Math.sin(a) * RB;
    s += box(px - 1.5, py - 1.5, HH + 0.5, 3, 3, 3.4, C.copperL, { top: 0.3, left: -0.26 });
    s += box(px - 0.9, py - 0.9, HH + 3.9, 1.8, 1.8, 1.2, shade(C.navyD, 0.1));
  }

  /* ── 8극 자계 ────────────────────────────────────────────
     영구자석 8개를 극성이 교대하는 자하로 두고 B = Σ q(r-rᵢ)/|r-rᵢ|³ 를
     RK2 로 적분해 자력선을 얻는다. N극에서 나와 공극을 건너 고정자 요크를
     지나 이웃 S극으로 되돌아가는 경로 — 8극기의 실제 자속 경로다. */
  const POLES = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.13 + Math.PI / 14.8;
    POLES.push({ x: Math.cos(a) * RI * 0.9, y: Math.sin(a) * RI * 0.9, q: k % 2 ? -1 : 1 });
  }
  const B = (x, y) => {
    let ax = 0, ay = 0;
    for (const q of POLES) {
      const dx = x - q.x, dy = y - q.y;
      const r2 = Math.max(dx * dx + dy * dy, 0.7);
      const r3 = r2 * Math.sqrt(r2);
      ax += (q.q * dx) / r3;
      ay += (q.q * dy) / r3;
    }
    return [ax, ay];
  };

  for (const n of POLES.filter((q) => q.q > 0)) {
    const aOut = Math.atan2(n.y, n.x);
    for (let i = 0; i < 6; i++) {
      let x = n.x + Math.cos(aOut + (i / 5 - 0.5) * 2.0) * 1.1;
      let y = n.y + Math.sin(aOut + (i / 5 - 0.5) * 2.0) * 1.1;
      const pts = [[x, y]];
      let closed = false;
      for (let step = 0; step < 520; step++) {
        const [fx, fy] = B(x, y);
        const m = Math.hypot(fx, fy);
        if (!m || !isFinite(m)) break;
        const h = 0.28;
        const [gx, gy] = B(x + (fx / m) * h * 0.5, y + (fy / m) * h * 0.5);
        const m2 = Math.hypot(gx, gy) || 1;
        x += (gx / m2) * h;
        y += (gy / m2) * h;
        const rr = Math.hypot(x, y);
        if (rr > RI + 3.6 || rr < RI * 0.44) break;
        pts.push([x, y]);
        if (POLES.some((q) => q.q < 0 && Math.hypot(x - q.x, y - q.y) < 1.2)) { closed = true; break; }
      }
      // S극까지 닫히지 못한 선은 버린다. 남기면 바깥으로 삐져나온 직선처럼 보인다.
      if (!closed || pts.length < 10) continue;
      const d = pts
        .map(([px, py], j) => {
          const [sx, sy] = iso(px, py, HH + 3.4);
          return `${j ? 'L' : 'M'} ${f(sx)} ${f(sy)}`;
        })
        .join(' ');
      // 흰 헤일로 + 청록 심지 — 어두운 회전자와 밝은 권선 양쪽에서 보이게 한다
      s += `<path d="${d}" fill="none" stroke="#FFFFFF" stroke-width="1.05" opacity="0.5" stroke-linecap="round"/>`;
      s += `<path d="${d}" fill="none" stroke="${C.teal}" stroke-width="0.42" opacity="0.95" stroke-linecap="round"/>`;
    }
  }

  return g(...L.motor, s);
}

/* ══════════════════════════════════════════════════════════
   2. 전기추진선박
   ══════════════════════════════════════════════════════════ */
function ship() {
  let s = '';
  // 해수면
  s += poly(
    [iso(-16, -12, 0), iso(78, -12, 0), iso(78, 32, 0), iso(-16, 32, 0)],
    C.sea
  );
  s += poly(
    [iso(-6, -4, 0.1), iso(64, -4, 0.1), iso(64, 24, 0.1), iso(-6, 24, 0.1)],
    shade(C.sea, 0.35)
  );

  // 선체 + 계단식 선수
  s += box(0, 0, 1.5, 50, 18, 8, C.navy);
  s += box(50, 3.5, 1.5, 9, 11, 8, C.navy);
  s += box(0, 0, 9.5, 50, 18, 1.2, shade(C.steel, 0.3)); // 갑판
  s += box(50, 3.5, 9.5, 9, 11, 1.2, shade(C.steel, 0.3));
  // 흘수선
  s += bandLeft(0, 0, 2.4, 50, 18, 1.6, C.amber);

  // 컨테이너
  const cargo = [C.teal, C.amber, C.green, C.blue, C.tealL, C.greenL];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      const hgt = 5 + ((i + j) % 2) * 1.5;
      s += box(15 + i * 9, 3 + j * 7, 10.7, 7.5, 5.5, hgt, cargo[(i * 2 + j) % cargo.length]);
    }
  }
  // 선교
  s += box(2, 3, 10.7, 11, 12, 15, C.paper);
  s += bandLeft(2, 3, 16, 11, 12, 3, C.navy);
  s += bandRight(2, 3, 16, 11, 12, 3, shade(C.navy, -0.1));
  s += box(4.5, 5.5, 25.7, 6, 7, 5, C.paper2);
  // 전기 추진 포드
  s += box(-5, 6, -1.5, 6, 6, 4, C.teal);
  s += disc(-5.5, 9, 0.5, 3.4, shade(C.teal, 0.3));
  return g(...L.ship, s);
}

/* ══════════════════════════════════════════════════════════
   3. 전기자동차 + 충전기
   ══════════════════════════════════════════════════════════ */
function ev() {
  let s = '';
  s += `<g transform="translate(16,20)">${shadow(44, 0.3)}</g>`;
  s += box(-8, -8, -3.5, 62, 34, 3.5, C.paper2, { top: 0.28, left: -0.14 });
  s += box(-2, -2, 0, 50, 22, 0.6, shade(C.steel, 0.42)); // 노면
  for (let i = 0; i < 4; i++) s += box(4 + i * 11, 9, 0.7, 5, 1.6, 0.3, C.paper); // 차선

  // 바퀴
  s += box(7, 1, 0.7, 5.5, 18, 4.2, C.navyD, { top: -0.1, left: -0.25 });
  s += box(26, 1, 0.7, 5.5, 18, 4.2, C.navyD, { top: -0.1, left: -0.25 });
  // 차체
  s += box(3, 2, 3.4, 33, 16, 6.5, C.blue);
  s += bandLeft(3, 2, 4.2, 33, 16, 1.6, shade(C.blue, -0.3));
  // 캐빈 + 유리
  s += box(10, 3, 9.9, 17, 14, 6.8, shade(C.blue, 0.18));
  s += bandLeft(10, 3, 11, 17, 14, 4.6, C.tealL);
  s += bandRight(10, 3, 11, 17, 14, 4.6, shade(C.tealL, -0.14));
  // 헤드램프
  s += box(36, 3.5, 5.5, 0.8, 3.5, 2, C.amberL, { top: 0, left: 0, right: 0 });

  // 충전기 + 케이블
  s += box(45, 7, 0.7, 5, 5, 17, C.green);
  s += box(44.4, 6.4, 15, 6.2, 6.2, 4, shade(C.green, 0.25));
  s += box(46.4, 8.4, 19, 2.2, 2.2, 1.6, C.amber);
  const a = iso(45, 9.5, 12);
  const b = iso(36.5, 9.5, 6.5);
  s += `<path d="M ${f(a[0])} ${f(a[1])} C ${f(a[0] - 6)} ${f(a[1] + 9)}, ${f(b[0] + 5)} ${f(b[1] + 8)}, ${f(b[0])} ${f(b[1])}" fill="none" stroke="${C.navyD}" stroke-width="1.5" stroke-linecap="round"/>`;
  return g(...L.ev, s);
}

/* ══════════════════════════════════════════════════════════
   4. AI 데이터센터 HVAC
   ══════════════════════════════════════════════════════════ */
function datacenter() {
  let s = '';
  s += `<g transform="translate(0,30)">${shadow(42, 0.3)}</g>`;
  s += box(-7, -7, -3.5, 50, 44, 3.5, C.paper2, { top: 0.28, left: -0.14 });

  // 본체
  s += box(0, 0, 0, 36, 30, 24, C.paper);
  for (let k = 0; k < 3; k++) {
    s += bandLeft(1.5, 0, 4 + k * 6.4, 33, 30, 3, C.navy);
    s += bandRight(0, 1.5, 4 + k * 6.4, 36, 27, 3, shade(C.navy, -0.12));
  }
  // 가동 표시 LED
  for (let k = 0; k < 6; k++) {
    s += box(3 + k * 5.4, 0, 21.4, 2, 0.35, 0.9, k % 3 === 0 ? C.amber : C.greenL, { top: 0, left: 0, right: 0 });
  }

  // 옥상 냉동기 3대 + 팬
  for (let i = 0; i < 3; i++) {
    const bx = 3 + i * 11;
    s += box(bx, 9, 24, 9, 11, 6, C.steel);
    s += box(bx + 0.8, 9.8, 30, 7.4, 9.4, 0.8, shade(C.steel, -0.16));
    const [cx, cy] = iso(bx + 4.5, 14.5, 31);
    s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="4.6" fill="${shade(C.teal, 0.55)}" opacity="0.9"/>`;
    for (let b = 0; b < 4; b++) {
      const ang = (b / 4) * Math.PI * 2 + 0.4;
      s += `<line x1="${f(cx)}" y1="${f(cy)}" x2="${f(cx + Math.cos(ang) * 4.4)}" y2="${f(cy + Math.sin(ang) * 2.6)}" stroke="${C.teal}" stroke-width="1.3" stroke-linecap="round"/>`;
    }
    s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="1.3" fill="${C.navy}"/>`;
  }
  // 냉각 배관
  s += box(1, 2, 24, 34, 3, 2.6, C.tealL);
  s += box(1, 2, 24, 3, 3, 7, C.tealL);
  s += box(32, 2, 24, 3, 3, 7, C.tealL);
  return g(...L.datacenter, s);
}

/* ══════════════════════════════════════════════════════════
   5. 초고압변압기 + 송전철탑
   ══════════════════════════════════════════════════════════ */
function transformer() {
  let s = '';
  s += `<g transform="translate(3,26)">${shadow(40, 0.3)}</g>`;
  s += box(-7, -7, -3.5, 48, 38, 3.5, C.paper2, { top: 0.28, left: -0.14 });

  // 철탑
  s += box(30, 4, 0, 2.2, 2.2, 46, C.steel, { top: 0.1, left: -0.3 });
  s += box(30, 20, 0, 2.2, 2.2, 46, C.steel, { top: 0.1, left: -0.3 });
  s += box(29, 3, 40, 4.2, 21, 1.8, shade(C.steel, -0.1));
  s += box(29, 3, 31, 4.2, 21, 1.8, shade(C.steel, -0.1));
  // 가공선
  // 변압기 → 데이터센터. 여섯 대상 중 둘을 실제로 이어 주는 선이라 허공에서 끊기지 않는다.
  for (const [zz, yy] of [[41.8, 4], [41.8, 22]]) {
    const p0 = iso(29, yy, zz);
    const [dx, dy] = L.lineTo;
    s += `<path d="M ${f(p0[0])} ${f(p0[1])} C ${f(p0[0] + dx * 0.28)} ${f(p0[1] + dy * 0.22)}, ${f(p0[0] + dx * 0.63)} ${f(p0[1] + dy * 0.56)}, ${f(p0[0] + dx)} ${f(p0[1] + dy)}" fill="none" stroke="${C.steel}" stroke-width="1.3" opacity="0.6"/>`;
  }

  // 본체 탱크
  s += box(0, 0, 0, 24, 18, 16, C.steel);
  // 방열기
  for (let i = 0; i < 7; i++) s += box(-3.4, 1.6 + i * 2.3, 2.5, 3.4, 1.5, 12, shade(C.steel, -0.12));
  // 콘서베이터
  s += box(2, 1.5, 16, 18, 4.5, 4.5, shade(C.steel, 0.2));
  s += disc(2, 3.75, 20.5, 2.2, shade(C.steel, 0.34));
  // 부싱 3기
  for (let i = 0; i < 3; i++) {
    const bx = 5.5 + i * 6.5, by = 10.5;
    s += box(bx - 1, by - 1, 16, 2, 2, 3, shade(C.steel, -0.2));
    for (let k = 0; k < 5; k++) s += disc(bx, by, 19 + k * 2.4, 2.6 - k * 0.28, k % 2 ? C.amberL : C.amber);
    s += box(bx - 0.5, by - 0.5, 30, 1, 1, 3.5, C.navy);
    s += disc(bx, by, 33.5, 1.5, C.navy);
  }
  return g(...L.transformer, s);
}

/* ══════════════════════════════════════════════════════════
   6. 전기추진항공기 (분산전기추진, 프로펠러 6기)
   ══════════════════════════════════════════════════════════ */
function aircraft() {
  // 동체 평면형 — 꼬리(x=0) 에서 기수(x=62) 로, 앞쪽이 좁아진다
  const FUSE = [[2, -4], [44, -5.5], [55, -4.6], [62, -1.6], [62, 1.6], [55, 4.6], [44, 5.5], [2, 4], [0, 2], [0, -2]];
  const mir = (pts) => pts.map(([x, y]) => [x, -y]);
  const WING = [[34, 5], [26, 36], [22, 37], [20, 5]];      // 후퇴익
  const TAIL = [[10, 3.6], [5, 16], [2, 16], [1, 3.6]];
  /** 날개 앞전의 x 좌표 (스팬 위치에 따라 뒤로 밀린다) */
  const le = (y) => 34 - 8 * (Math.abs(y) - 5) / 31;

  /** 파일런 + 나셀 + 전방을 향한 프로펠러 */
  const nacelle = (yy, i) => {
    const ax = le(yy);
    let n = '';
    n += box(ax - 3.5, yy - 2.5, 5.2, 3.5, 5, 3, shade(C.steel, -0.18));
    n += box(ax - 13, yy - 2.9, 5.0, 12, 5.8, 5.8, C.blue);
    const cz = 7.9, r = 10.4;
    n += discYZ(ax - 13.6, yy, cz, r, C.tealL, ' opacity="0.24"');
    n += discYZ(ax - 13.6, yy, cz, r, 'none', ` stroke="${C.teal}" stroke-width="1" opacity="0.6"`);
    for (let b = 0; b < 3; b++) n += bladeYZ(ax - 14, yy, cz, r * 0.93, (b / 3) * Math.PI * 2 + i * 0.8, C.teal, 2.1);
    n += discYZ(ax - 14.4, yy, cz, 2, C.navy);
    return n;
  };

  let s = '';
  // ── 뒤쪽(먼) 절반: y 가 음수인 쪽
  s += plate(mir(TAIL), 9, 1.4, C.paper2);
  s += plate(mir(WING), 6.5, 1.7, C.paper2);
  s += nacelle(-27, 0);
  s += nacelle(-15, 1);

  // ── 동체: 짙은 벨리 + 밝은 상부
  s += plate(FUSE, 0, 3, C.navy);
  s += plate(FUSE, 3, 10, C.paper);
  s += `<g opacity="0.9">${plate([[6, -5.2], [46, -5.2], [46, -3.4], [6, -3.4]], 9.4, 1.6, C.blue)}</g>`;
  s += plate([[54, -4.2], [61, -1.6], [61, 1.6], [54, 4.2]], 10.2, 1.6, C.navyD); // 조종석

  // 수직미익
  s += box(2, -1.9, 13, 11, 3.8, 17, C.blue);
  s += box(2, -1.9, 27.5, 11, 3.8, 2.4, shade(C.blue, 0.34));

  // ── 앞쪽(가까운) 절반: y 가 양수인 쪽
  s += plate(TAIL, 9, 1.4, C.paper2);
  s += plate(WING, 6.5, 1.7, C.paper2);
  s += nacelle(15, 2);
  s += nacelle(27, 3);

  return g(...L.aircraft, s);
}

/* ══════════════════════════════════════════════════════════
   7. 전기추진 우주선 (이온 추진)
   ══════════════════════════════════════════════════════════ */
function spacecraft() {
  let s = '';
  // 태양전지판
  for (const yy of [-30, 16]) {
    s += box(1, yy, 5, 14, 26, 1.1, C.navy);
    for (let k = 0; k < 5; k++) s += box(2, yy + 1.5 + k * 4.8, 6.1, 12, 3.4, 0.25, shade(C.blue, -0.24));
  }
  // 본체
  s += box(0, 0, 0, 17, 15, 13, C.paper);
  s += bandLeft(1, 0, 3, 15, 15, 4, C.navy);
  s += box(3, 3, 13, 11, 9, 2.4, shade(C.steel, 0.2));
  // 통신 안테나
  const [ax, ay] = iso(8.5, 7.5, 18);
  s += `<line x1="${f(ax)}" y1="${f(ay + 9)}" x2="${f(ax)}" y2="${f(ay)}" stroke="${C.steel}" stroke-width="1.4"/>`;
  s += `<ellipse cx="${f(ax)}" cy="${f(ay)}" rx="8" ry="4.4" fill="${shade(C.paper, -0.04)}" stroke="${C.steel}" stroke-width="1"/>`;
  s += `<circle cx="${f(ax)}" cy="${f(ay)}" r="1.5" fill="${C.navy}"/>`;

  // 이온 스러스터 + 플룸
  s += box(-4.5, 5, 4, 4.5, 5, 5, shade(C.steel, -0.1));
  const [nx, ny] = iso(-4.5, 7.5, 6.5);
  s += `<path d="M ${f(nx)} ${f(ny - 5)} L ${f(nx - 74)} ${f(ny - 26)} L ${f(nx - 74)} ${f(ny + 22)} L ${f(nx)} ${f(ny + 5)} Z" fill="url(#${ID('plume')})"/>`;
  return g(...L.spacecraft, s);
}

/* ══════════════════════════════════════════════════════════
   에너지 흐름선 — 전동기에서 출발해 여섯 부하를 잇는다
   ══════════════════════════════════════════════════════════ */
function flow() {
  return (
    `<path d="${L.flow}" fill="none" stroke="url(#${ID('flowGrad')})" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="9 7" opacity="0.55"/>` +
    L.nodes.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.2" fill="${C.tealL}" opacity="0.6"/>`).join('')
  );
}

/* ══════════════════════════════════════════════════════════
   연구실 심볼 — 8극 회전자 단면을 평면화한 마크.
   히어로 일러스트의 전동기와 같은 기하라 둘이 한 벌로 읽힌다.
   내비게이션에서 28~34px 로 쓰이므로 디테일을 극단적으로 줄였다.
   ══════════════════════════════════════════════════════════ */
function logo() {
  const S = 64, c = S / 2;
  const R_RING = 24, R1 = 19.6, R0 = 9.8;
  let g = '';

  // 고정자 요크
  // 슬롯 눈금은 넣지 않는다 — 34px 내비에서 잡음으로만 뭉친다.
  g += `<circle cx="${c}" cy="${c}" r="${R_RING}" fill="none" stroke="${C.navy}" stroke-width="5.4"/>`;

  // 8극 영구자석 — N/S 교대
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * Math.PI * 2 + 0.08, a1 = a0 + Math.PI / 4.9;
    const pt = (a, r) => `${f(c + Math.cos(a) * r)},${f(c + Math.sin(a) * r)}`;
    g += `<polygon points="${pt(a0, R0)} ${pt(a1, R0)} ${pt(a1, R1)} ${pt(a0, R1)}" fill="${k % 2 ? C.teal : C.navy}"/>`;
  }

  // 축
  g += `<circle cx="${c}" cy="${c}" r="6.6" fill="${C.navy}"/>`;
  g += `<circle cx="${c}" cy="${c}" r="2.5" fill="#FFFFFF"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="electrified Propulsion Lab.">
<title>electrified Propulsion Lab.</title>
${g}
</svg>
`;
}

/* ══════════════════════════════════════════════════════════ */
function render() {
  const { W, H, haze } = L;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="${ID('heroTitle')}">
<title id="${ID('heroTitle')}">Electrified propulsion across sea, road, air, and space — ships, vehicles, AI data-center cooling, ultra-high-voltage transformers, aircraft, and spacecraft, all driven by electric machines.</title>
<defs>
  <linearGradient id="${ID('plume')}" x1="1" y1="0" x2="0" y2="0">
    <stop offset="0" stop-color="${C.tealL}" stop-opacity="0.85"/>
    <stop offset="0.45" stop-color="${C.blueL}" stop-opacity="0.35"/>
    <stop offset="1" stop-color="${C.blueL}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="${ID('flowGrad')}" x1="0" y1="1" x2="1" y2="0">
    <stop offset="0" stop-color="${C.amber}"/>
    <stop offset="0.45" stop-color="${C.teal}"/>
    <stop offset="1" stop-color="${C.blue}"/>
  </linearGradient>
  <radialGradient id="${ID('haze')}" cx="${haze[0]}" cy="${haze[1]}" r="0.62">
    <stop offset="0" stop-color="${C.tealL}" stop-opacity="0.16"/>
    <stop offset="1" stop-color="${C.tealL}" stop-opacity="0"/>
  </radialGradient>
</defs>

<rect width="${W}" height="${H}" fill="url(#${ID('haze')})"/>
${flow()}
${motor()}
${ship()}
${ev()}
${datacenter()}
${transformer()}
${aircraft()}
${spacecraft()}
</svg>
`;
}

mkdirSync(OUT_DIR, { recursive: true });
{
  const mark = logo();
  writeFileSync(join(OUT_DIR, 'logo.svg'), mark, 'utf8');
  console.log(`  ${'logo.svg'.padEnd(20)} ${(mark.length / 1024).toFixed(1).padStart(6)} KB   64×64`);
}
for (const [name, layout] of Object.entries(LAYOUTS)) {
  L = layout;
  const out = render();
  writeFileSync(join(OUT_DIR, layout.file), out, 'utf8');
  console.log(`  ${layout.file.padEnd(20)} ${(out.length / 1024).toFixed(1).padStart(6)} KB   ${layout.W}×${layout.H}`);
}
console.log('히어로 일러스트 생성 완료 → src/assets/');
