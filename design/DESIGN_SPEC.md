# eP Lab Website — Design Spec & Build Guide (for Claude Code)

> 확정 디자인 **`eP Lab Website.dc.html`** 을 Eleventy 정적 사이트로 구현하기 위한 지침서.
> 이 폴더(`design/`)에는 다음이 있다:
> - `eP Lab Website.dc.html` — 확정 디자인 원본(단일 파일 SPA). **디자인·레이아웃·콘텐츠의 소스 오브 트루스.**
> - `support.js` — Claude Design 런타임(참고용). **최종 사이트에는 사용하지 않음** (아래 "변환 규칙" 참조).
> - `tokens.css` — 원본 인라인 스타일에서 추출한 디자인 토큰/유틸리티. 전역 CSS의 기반으로 사용.
> - `thumbnail.webp` — 디자인 미리보기 썸네일.

---

## 0. 핵심 요약 (한 문단)

원본 `.dc.html`은 Claude Design 프레임워크(`DCLogic` 클래스 + `<sc-for>`/`<sc-if>`/`{{ }}` + `support.js`)로 만든 **해시 라우팅 SPA**이고, **모든 콘텐츠가 파일 안 `renderVals()`의 JS 배열에 하드코딩**되어 있다. 우리 목표는 이 디자인을 **픽셀·레이아웃 그대로 재현**하되, (1) 해시 SPA → **Eleventy 실제 페이지**로, (2) 하드코딩 데이터 → **Google Sheet에서 로드**로, (3) `support.js` 인터랙션 → **가벼운 바닐라 JS**로 바꾸는 것이다. 디자인은 이미 완성도가 높으니 **새로 디자인하지 말고 이식(port)** 한다.

---

> **언어 (2026-09-01 확정)**: 이 디자인 원본은 **한글 기준**으로 작성돼 있다.
> 코드도 한글 우선(`cms-schema.js`의 `preferred(ko, en)`)으로 맞췄다.
> 단 원본이 **영문만** 쓰는 자리가 셋 있다 — 헤더 브랜드 `DONGGUK UNIVERSITY`(L28),
> 히어로 eyebrow `DONGGUK UNIVERSITY · SINCE 2023`(L61), Leader 카드 소속(L144-146).
> 이 셋은 템플릿에서 `cms.configEn`을 쓴다. 원본을 고칠 때 이 구분을 유지할 것.

## 1. 디자인 시스템

`tokens.css` 참조 (색/폰트/간격/유틸리티가 모두 변수화되어 있음). 요점:

- **테마**: 다크 단일 테마. 배경 `#0B0B0C`, 텍스트 `#EDEDED`, **오렌지 액센트 `#FF6A1F`**.
- **폰트**: 모노스페이스 스택(`Consolas, Menlo, "DejaVu Sans Mono", "Malgun Gothic", "Apple SD Gothic Neo", monospace`). 이 모노스페이스 감성이 브랜드의 핵심이므로 유지.
- **레이아웃**: 콘텐츠 최대폭 `1240px`, 좌우 패딩 `28px`, 섹션 상하 `84px`, 내부 페이지 상단 `56px`.
- **시그니처 패턴**:
  - **Eyebrow 라벨**: 섹션마다 오렌지 대문자 소제목(`11px`, `letter-spacing:.2em`), 종종 번호 프리픽스(`01 / ABOUT US`, `T-01`).
  - **Hairline 카드 그리드**: 카드들을 `gap:1px; background:#212124`로 묶어 카드 사이가 1px 선으로만 갈리는 격자(`tokens.css`의 `.cardgrid`).
  - **이미지 placeholder**: 점선 테두리 + 대각선 줄무늬 배경(`.imgslot`). 실제 사진/도식으로 교체될 자리.
  - **칩(chip)**: 논문 지표(IF/Q/JCR), 연구 태그를 테두리 칩으로. **Q1 또는 JCR ≤ 10%면 오렌지 강조**(`.chip-hot`).

---

## 2. 사이트 구조 → Eleventy 페이지

원본은 해시 라우트(`#/home` 등)로 한 파일에서 분기한다(`renderVals()`의 `isHome`, `isLeader` …). **각 라우트를 독립된 Eleventy 페이지로 만든다** (SEO·정적화가 이 프로젝트의 목적).

| 원본 라우트 | Eleventy 출력 | 원본 분기 플래그 |
|---|---|---|
| `#/home` | `/` | isHome |
| `#/team/leader` | `/team/leader/` | isLeader |
| `#/team/researchers` | `/team/researchers/` | isResearchers |
| `#/research/topics` | `/research/topics/` | isTopics |
| `#/research/projects` | `/research/projects/` | isProjects |
| `#/achievements/publications` | `/achievements/publications/` | isPublications |
| `#/achievements/conferences` | `/achievements/conferences/` | isConferences (※ placeholder) |
| `#/achievements/patents` | `/achievements/patents/` | isPatents (※ placeholder) |
| `#/achievements/talks` | `/achievements/invited-talks/` | isTalks |
| `#/teaching` | `/teaching/` | isTeaching |
| `#/news` | `/news/` | isNews (+ Gallery 섹션) |
| `#/contact` | `/contact/` | isContact |

**공통 레이아웃(`base.njk`)**: 원본의 `<header>`(sticky, 로고+네비 드롭다운) + `<main>` + `<footer>`. 헤더/푸터는 모든 페이지 공통.
**네비 구조**(원본 `nav` 배열 그대로):
```
Home
Team          → Leader, Researchers
Research       → Research Topics, Research Projects
Achievements   → Publications, Conferences, Patents, Invited Talks
Teaching
News
Contact
```
- 현재 페이지의 상위 메뉴는 오렌지로 활성 표시(원본 `color:var(--accent)` + 하단 라인). Eleventy에서는 현재 URL로 판정.
- 드롭다운은 hover 시 노출(아래 인터랙션 참조).

---

## 3. 페이지별 컴포넌트 (원본 라인 참조)

각 페이지의 마크업/스타일은 `eP Lab Website.dc.html`의 해당 섹션을 그대로 옮긴다. 요약:

- **Home** (dc.html L50–126): ① Hero(배경 이미지 + 좌측 그라디언트 오버레이 + `electrified / Propulsion Lab.` 타이틀), ② About(2단 그리드 + 통계 타일 `11 RESEARCHERS · 30+ PUBLICATIONS · 13 INDUSTRY PROJECTS`), ③ Research Topics 카드 그리드(홈은 6개 요약), ④ Latest News(최근 N개, `homeNewsCount` 기본 5).
- **Team / Leader** (L136–210): 좌측 인물 카드(포트레이트 슬롯 + 이름/직함/연락/Scholar), 우측 Research Interests / Education / Professional Experience / Awards / Academic Activities. 데이터는 시트 `Leader_CV` (section별).
- **Team / Researchers** (L212–258): Graduate(카드 그리드, 사진+이름+역할+이메일), Undergraduate(카드 그리드), Alumni(행 리스트: 이름 · 재학기간/역할 · 진로).
- **Research / Topics** (L269–288): 6개 주제, 각 행 = 이미지 슬롯 + 번호 + 영문/국문 제목 + 설명 + 태그 칩. **원본에 설명·태그가 이미 작성됨**(§5 참조).
- **Research / Projects** (L290–305): 표(STATUS / PERIOD / PARTNER / PROJECT). ONGOING은 오렌지 배지, COMPLETED는 회색. **PARTNER 칸 = 로고 + 이름**: 시트 `partner_logo_url`이 있으면 40×40 로고 이미지, 없으면 원본의 점선 LOGO placeholder(dc.html L299) 대신 파트너명 텍스트로 폴백(§4-1 스니펫).
- **Achievements / Publications** (L316–340): 연도 헤더(오렌지) + 논문 리스트. 각 논문: 제목 → 저자(**"S. H. Park" 자동 오렌지 볼드 강조**) → 게재지 → 지표 칩(Q1/JCR≤10% 오렌지) + DOI 버튼.
- **Achievements / Conferences** (L342–358): **placeholder — 데이터 없음**. 연도별 리스트 레이아웃만 존재.
- **Achievements / Patents** (L360–376): **placeholder — 표 레이아웃만**(NO./STATUS/TITLE). 실제 특허 데이터는 시트 `Patents`(US 2건)로 채운다.
- **Achievements / Invited Talks** (L378–398): 2025+ 최근 리스트 + "이전 보기" 토글로 2024 이전 표시(흐리게).
- **Teaching** (L403–420): 강의 카드 그리드(LEVEL / 과목명 / 학기 / 설명). **원본은 과목명이 `[ 과목명 ]` placeholder** — 시트 `Teaching`(7과목)로 채운다.
- **News** (L423–474): 올해(`26.`) 리스트 + "지난 News 보기" 토글 + **Gallery**(4열 그리드, 각 항목 사진 캐러셀 + 날짜/제목/참석자, 페이지네이션).
- **Contact** (L477–507): 주소/이메일/전화 + 채용 문구 박스 + 지도 이미지 슬롯.
- **Footer** (L511–530): 로고/소속/연락/저작권.

---

## 4. 데이터 모델 → Google Sheet 매핑

원본 `renderVals()`(dc.html L588–875)의 JS 배열이 곧 **콘텐츠**다. 최종 사이트는 이를 **시트에서 로드**한다(동봉 `../eplab_website_content.xlsx` → Google Sheet). 배열 ↔ 탭 매핑:

| 원본 배열 | 필드 | 시트 탭 |
|---|---|---|
| `nav` | 고정 구조 | 코드에 유지(시트化 불필요) |
| `topics` | no, en, kr, desc, tags[] | **Research_Topics** (desc·tags 컬럼 추가 필요) |
| `grads` / `undergrads` / `alumni` | kr, en, role, email, next | **Members** (category로 구분) |
| Leader 블록(하드코딩) | interests/education/experience/awards/activities | **Leader_CV** (section별) |
| `projects` (rawProjects) | s(status), d(period), o(partner), **logo(partner_logo_url)**, t(title) | **Research_Projects** |
| `pubYears[].items` | t, a, v, m, doi | **Publications** (t=title, a=authors, v=venue+details, m=metrics) |
| `talks` | d, t, o | **Leader_CV(InvitedTalk)** 또는 별도 **Invited_Talks** 탭 |
| `news` | d, t | **News** |
| `galleryAll` | d, t, who, photos | **Gallery** 탭(신규 필요) |
| `courses` | level, name, term, desc | **Teaching** |
| `confPlaceholders` / `patentPlaceholders` | (placeholder) | **Conferences**(신규), **Patents** |

### 4-1. 원본 데이터 파싱 규칙(코드에 구현)
- **저자 강조**: 저자 문자열에서 `/S\.\s*H\.\s*Park\**/g` 매칭을 오렌지 볼드로(원본 `decoratePub`, L566–586). 시트에는 순수 문자열만 넣고, 강조는 빌드 시 처리.
- **지표 칩**: `m` 문자열을 `·`로 분리 → 각 토큰 칩. `Q1` 또는 `JCR ≤ 10%`면 `.chip-hot`.
- **프로젝트 배지**: `ONGOING`이면 오렌지 테두리/글자, 그 외 회색.
- **프로젝트 파트너 로고**: 시트 `Research_Projects.partner_logo_url`(Drive/에셋 URL)이 있으면 로고 이미지, 없으면 파트너명 텍스트로 폴백. 빌드 시 로컬 `/assets/partners/`로 받아 자체 호스팅(핫링크 회피).
- **News/Talks 분기**: 올해(`26.`)=현재, 나머지=지난(토글). Talks는 `>=2025`=최근, 나머지=이전.

**프로젝트 행 렌더링 예시 (Nunjucks)** — 원본 dc.html L296–302의 PARTNER 셀(점선 LOGO placeholder)을 아래처럼 대체:
```njk
{% for p in projects %}
<div class="proj-row">
  <span class="badge {{ 'badge-on' if p.status == 'Ongoing' else 'badge-off' }}">{{ p.status | upper }}</span>
  <span class="period">{{ p.period_start }} – {{ p.period_end }}</span>

  {# PARTNER: 로고 있으면 이미지, 없으면 이름 텍스트 #}
  <span class="partner">
    {% if p.partner_logo_url %}
      <img src="{{ p.partner_logo_url }}" alt="{{ p.partner }}" width="40" height="40" loading="lazy"
           style="width:40px;height:40px;object-fit:contain">
    {% else %}
      <span class="partner-name">{{ p.partner }}</span>
    {% endif %}
  </span>

  <span class="proj-title">{{ p.title_ko }}</span>
</div>
{% endfor %}
```
로고를 쓰더라도 접근성/폴백을 위해 `alt`에 파트너명을 넣고, 좁은 화면에서는 이름 텍스트를 함께 노출하는 것을 권장.

---

## 5. ⚠️ 콘텐츠 변경점 — 현재 시트(xlsx)보다 디자인이 최신

디자인 원본이 이전에 만든 `eplab_website_content.xlsx`보다 갱신되어 있다. **시트를 디자인 기준으로 업데이트해야 한다**(다음 작업 후보):

1. **연구주제 설명·태그**: 이전엔 미작성 → 디자인에 6개 모두 desc + tags 3개씩 완성됨(L612–631). → `Research_Topics`에 `description`, `tags` 채우기.
2. **유나경 영문명 확정**: `Na-Kyung Yoo` (이전 미확정) (L646). → `Members` 반영.
3. **프로젝트 13건**(진행 6 + 완료 7): 이전 xlsx는 9건(진행만). 완료 과제 7건이 추가됨(L686–700). → `Research_Projects` 확장 + status 반영. 파트너에 효성전기/현대트랜시스/WESPION/현대자동차/한국생산기술연구원 등.
4. **뉴스 35건**: 이전 16건 → 35건으로 대폭 확장(L760–795), 입사/진학/합류/과제 소식 포함. → `News` 교체.
5. **초청강연 24건**: 디자인은 Achievements 하위 독립 페이지(`Invited Talks`). 시트는 현재 `Leader_CV(InvitedTalk)`에 있음 — 유지하되 페이지는 별도.
6. **신규 섹션**: `Conferences`(데이터 미정, placeholder), `Gallery`(9개 항목, 사진 수 포함) → 시트에 **탭 신설** 필요.
7. **주소 불일치 확인**: 디자인 Contact=**원흥관 E142**, 우편번호 04620 (L485–486). 원본 사이트/이전 시트는 F621·F142/143. → 정확한 주소 교수 확인 필요.
8. 통계 타일 수치(`11 / 30+ / 13`)는 자동 집계 권장(구성원/논문/프로젝트 count).

---

## 6. 인터랙션 (support.js 대신 바닐라 JS로 재구현)

원본의 동작을 정적 페이지 위 작은 스크립트로 이식:
- **네비 드롭다운**: 상위 메뉴 hover 시 하위 패널 노출(원본은 onMouseEnter/Leave). CSS `:hover`만으로도 가능.
- **활성 메뉴 표시**: 현재 페이지의 상위 메뉴 오렌지. Eleventy에서 현재 URL로 클래스 부여(빌드 타임, JS 불필요).
- **News/Talks 토글**: "지난 News/이전 Talks 보기" 접기/펼치기.
- **Gallery**: 항목별 사진 캐러셀(‹ ›) + 페이지 단위 이동(PREV/NEXT). 8개/페이지.
- **Accent 교체**(선택): 원본은 accent 색을 prop로 교체 가능. 필수는 아님.

---

## 7. 변환 규칙 (Claude Design 문법 → Eleventy/Nunjucks)

| 원본 | Eleventy(Nunjucks) |
|---|---|
| `<sc-for list="{{ items }}" as="p">…</sc-for>` | `{% for p in items %}…{% endfor %}` |
| `<sc-if value="{{ isX }}">…</sc-if>` | 페이지 분리로 대체(각 라우트=각 템플릿). 페이지 내 조건은 `{% if %}` |
| `{{ item.field }}` | `{{ item.field }}` (동일) |
| `style="..."`(인라인) | `tokens.css` 유틸리티 클래스 + 페이지 CSS로 이전 |
| `style-hover="..."` | CSS `:hover` 규칙 |
| `onClick/onMouseEnter="{{ fn }}"` | 바닐라 JS 이벤트 |
| `<x-dc>`, `<helmet>`, `support.js`, `DCLogic` | **제거** (런타임 불필요) |
| `renderVals()`의 데이터 배열 | Eleventy `_data/*.js`가 Google Sheet에서 로드 |

---

## 8. 에셋
- **Hero 이미지**: 별도 확정("eP Lab 히어로 배경" 아티팩트) **채용**. 원본 Hero 슬롯(L54–56 `[ HERO IMAGE ]`)에 배치. `/assets/`에 저장.
- **인물 사진/갤러리/파트너 로고/지도**: 현재 모두 placeholder. 시트로 채운다 — 구성원 `Members.photo_url`, 프로젝트 파트너 `Research_Projects.partner_logo_url`, 협력기관 `Collaborators.logo_url`, 갤러리 `Gallery.image_urls`, News `News.image_url`. 빌드 시 로컬 `/assets`(파트너 로고는 `/assets/partners/`)로 받아 자체 호스팅(Phase 3, 핫링크 회피).

---

## 9. 착수 순서 (권장)
1. `tokens.css`를 전역 CSS로 넣고 `base.njk`(header/footer/nav) 구성.
2. **Publications** 페이지를 원본 그대로 이식 + 시트 데이터 연결 → end-to-end 검증(가장 데이터 밀도 높음).
3. 나머지 페이지 순차 이식(Home → Team → Research → News → Contact → Teaching → Talks).
4. 인터랙션(드롭다운/토글/갤러리) 바닐라 JS.
5. §5의 콘텐츠 변경점을 시트에 반영(또는 교수 검수 후).
6. 에셋 파이프라인 + 반응형 QA.

*이 스펙의 소스 오브 트루스는 `eP Lab Website.dc.html` 자체다. 애매하면 원본 라인을 열어 확인할 것.*
