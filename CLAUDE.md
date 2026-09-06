# eP Lab Website — Project Context (CLAUDE.md)

> 이 파일은 Claude Code가 프로젝트를 이어받기 위한 **단일 컨텍스트 문서**입니다.
> 동국대학교 전동화 추진시스템 연구실(eP Lab) 홈페이지를, **Google Sheet를 CMS(admin)로 쓰는 정적 사이트**로 재개발합니다.
> 세션이 바뀌어도 이 문서만 읽으면 현재 상태·결정·다음 작업을 알 수 있습니다.

---

## 1. 프로젝트 개요

- **목표**: 기존 Google Sites 홈페이지(`https://eplab.dgu.ac.kr`)를 대체하는 새 사이트를 개발한다.
- **핵심 컨셉**: 모든 콘텐츠를 하나의 **Google Sheet**에 입력하고, 각 행의 `publish` 체크박스로 게시 여부를 제어한다. 즉 **Google Sheet가 관리자 페이지** 역할을 한다. 학생에게 시트 공유 권한만 주면 홈페이지를 관리할 수 있게 하는 것이 목적.
- **운영 주체**: 콘텐츠는 학생/연구원이 시트로 관리, 코드·빌드 파이프라인은 교수(Prof. Soo-Hwan Park, parksh@dgu.ac.kr)가 소유.

## 2. 확정된 결정 (Decisions)

| 항목 | 결정 | 비고 |
|---|---|---|
| 렌더링 방식 | **빌드 시 정적 생성** (build-time static generation) | runtime fetch 아님. 시트를 읽어 정적 HTML을 미리 생성 |
| 언어 | **한글 우선** (2026-09-01 변경) | `*_ko`가 게시 텍스트, 비면 `*_en`으로 폴백. 확정 디자인이 한글 기준이라 영문 우선은 디자인과 어긋났다. 구현은 `cms-schema.js`의 `preferred(ko, en)` **한 함수**만 거친다 |
| 정적 사이트 생성기 | **Eleventy(11ty)** 권장 | 대안: Astro |
| 호스팅 | **미정** → GitHub Pages + GitHub Actions 권장 | 대안: Vercel. `eplab.dgu.ac.kr` DNS는 학교 IT 협조 필요 (장기 과제) |
| 시트 접근 | **서비스 계정 + Sheets API (읽기 전용)** 권장 | "웹에 게시(CSV)" 방식은 미게시 행까지 노출되므로 지양 |
| 이미지/PDF | 시트엔 URL만, 실제 파일은 Google Drive 또는 저장소 | 빌드 시 다운로드해 자체 호스팅 권장 (Drive 핫링크 throttling 회피) |

## 3. 시스템 아키텍처

```
[Admin]   Google Sheet 1개, 탭별 콘텐츠 유형
             └ 각 탭 공통 컬럼: publish(체크박스) · order(정렬) + 콘텐츠 필드 + 에셋 URL
[Asset]   Google Drive 폴더(사진·PDF) → 빌드 시 사이트로 다운로드해 자체 호스팅
[Build]   Node 정적 사이트 생성기(Eleventy)
             └ 서비스 계정으로 Sheets API 읽기 → publish=TRUE 필터 → 스키마 검증 → 템플릿 렌더 → 정적 HTML
[Trigger] MVP: 예약 빌드(15~30분) + 수동 실행 / 이후: Apps Script onEdit → GitHub repository_dispatch
[Deploy]  GitHub Actions → GitHub Pages, 커스텀 도메인 eplab.dgu.ac.kr (학교 IT DNS 필요)
```

### 계획의 알려진 맹점 (설계 시 반드시 반영)
1. **"체크박스 즉시 게시"는 환상** — 빌드 방식이므로 게시 트리거(예약/수동/dispatch)가 반드시 필요. "실시간"이 아님.
2. **이미지·PDF는 시트에 못 넣음** — 별도 에셋 저장소 + URL 참조 필요.
3. **학생이 시트를 깨뜨릴 수 있음** — 빌드 시 스키마 검증, 문제 행은 건너뛰고 **직전 정상 빌드 유지**(fail-safe). 시트 쪽은 헤더 보호 + 데이터 유효성 검사.
4. **시트 읽기 보안** — 서비스 계정(비공개, 안전) vs 웹게시 CSV(미게시 행 노출). 서비스 계정 사용.
5. **리치 텍스트 부적합** — About/연구주제 설명/뉴스 본문은 셀 안 Markdown 규칙 필요. 어떤 섹션이 시트 기반/수기 작성인지 구분.
6. **관계형 데이터 취약** — 논문↔저자, 프로젝트↔주제 관계는 평면 시트에서 깨지기 쉬움. ID 참조 최소화.
7. **도메인 병목** — `eplab.dgu.ac.kr`은 학교 IT 관리 서브도메인. DNS 변경은 로드맵 최우선 착수, 그동안 기존 Google Site 유지.
8. **버스 팩터** — 토큰/서비스계정 키 만료 시 학생은 못 고침. 런북·갱신 절차 문서화 필수.

## 4. 데이터 소스 & 현재 산출물

- **원본**: `https://eplab.dgu.ac.kr` (Google Sites), 2026-08-29 크롤링 완료.
- **추출 결과물**: `eplab_website_content.xlsx` (이 폴더에 위치). Google Sheet CMS 스키마 + 실제 콘텐츠 전량.
  - 이 xlsx를 Google Sheets로 **가져오기(Import)** → `publish` 열에 [삽입 > 체크박스] 적용하면 admin 시트 완성.
- 추출 규모: **논문 34편**(2019–2026), 진행 프로젝트 9건, 구성원 17명, 초청강연 24건, US 특허 2건, 강의 7개, 뉴스 16건.

## 5. Google Sheet 스키마 (탭 = 웹 섹션)

모든 데이터 탭은 `publish`(TRUE/FALSE) + `order`(정수, 작을수록 위) 공통.

| 탭 | 컬럼 | 대응 페이지 |
|---|---|---|
| **README** | (사용 안내) | — |
| **Site_Config** | key, value_en, value_ko, notes | 전역 설정(랩명, 배너, 연구영역4, 연락처, 채용문구, 푸터, `map_url`) |
| **Members** | publish, order, category*, name_en, name_ko, position, email, cohort_period, current_affiliation, photo_url, scholar_url, notes | Team (Leader/Researchers) |
| **Leader_CV** | publish, section**, order, date, title, detail | Team > Leader (교수 이력) |
| **Research_Topics** | publish, order, no, title_en, title_ko, description, image_url | Research > Topics |
| **Research_Projects** | publish, order, status(Ongoing/Completed), role(PI/Co-I/Advisor), title_ko, partner, period_start, period_end, notes | Research > Projects |
| **Publications** | publish, order, year, authors, title, venue, metrics, doi | Achievements > Publications |
| **Patents** | publish, order, country, status(Registered/Filed/Pending), title, year, patent_no, inventors, notes | Achievements > Patents |
| **Teaching** | publish, order, level(Undergraduate/Graduate), title_en, title_ko, course_code, term, description, notes | Teaching |
| **News** | publish, order, date, category***, text_ko, text_en, image_url | News |
| **Conferences** | publish, order, year, authors, title, venue, location, date, notes | Achievements > Conferences |
| **Invited_Talks** | publish, order, date, title, host | Achievements > Invited Talks |
| **Gallery** | publish, order, date, title, participants, photo_count, image_urls, notes | News > Gallery |
| ~~Collaborators~~ | (2026-09-01 탭 삭제 — 확정 디자인에 협력기관 섹션이 없다) | — |

> 이 표는 **2026-09-04 기준 실제 시트 헤더와 대조해 맞춘 것**이다. 시트를 고치면 여기도 같이 고칠 것 —
> 어긋나면 빌드가 "구조 드리프트" 경고로 알려준다.

- `*` category: Faculty / Graduate / Undergraduate / Alumni
- `**` section: ResearchInterest / Education / Experience / Award / Activity / InvitedTalk
- `***` News category: Paper / Research / Conference / Event / People / Award

### 사이트 내비게이션 구조 (기존과 동일하게 유지)
```
About Us (/)
Team            → Leader (/team/leader), Researchers (/team/researchers)
Research        → Research Topics, Research Projects
Achievements    → Publications (Journal), Patents
Teaching
News
Contact
```

## 6. 검수 필요 항목 (미확정 데이터)
- 학부연구생 **'유나경' 영문명** — 원본에 'Seo-Hyun Hong'로 중복 표기된 오류. 정확한 로마자 확인 필요.
- **`*_ko`가 비어 `*_en`으로 폴백되는 행** — 한글 원문이 빠진 것이므로 채울 것. 빌드 로그가 개수를 보고한다.
- 영문 병기가 필요한 자리는 시트의 `*_en`에 채운다(디자인이 영문을 쓰는 세 곳: 헤더 브랜드·히어로 eyebrow·Leader 카드 소속. 템플릿에서 `cms.configEn`을 쓴다).
- **연구주제(Research_Topics) description** — 미작성.
- **Collaborators** 기관명·로고 URL — 원본 로고에 alt 텍스트 없어 식별 불가.
- 구성원 **사진(photo_url), Google Scholar 링크** — 미입력.
- KEIT 기관 정식명칭 확인(한국산업기술기획평가원).

## 7. 로드맵 & 현재 위치

- [x] **Phase 0 (일부)**: 방향·아키텍처 결정, 맹점 분석.
- [x] **Phase 1**: 기존 사이트 콘텐츠 추출 + Google Sheet 스키마 설계 → `eplab_website_content.xlsx` 산출. **(완료)**
- [ ] **Phase 0 (잔여)**: 학교 IT에 `eplab.dgu.ac.kr` DNS 변경 문의(교수 액션), GitHub repo·Google Cloud 서비스 계정 생성.
- [x] **Phase 2**: 빌드 파이프라인 MVP. `src/_data/cms.js`(소스 어댑터) + `cms-schema.js`(13개 탭 검증). xlsx → 정규화 JSON, publish/order 처리, 나쁜 행 스킵. **(완료)**
- [x] **Phase 3**: 디자인 이식 — `src/assets/css/site.css`(tokens+컴포넌트), `base.njk`(헤더/네비/푸터), 12개 페이지 전부, 인터랙션 바닐라 JS(`src/assets/js/site.js`). **(완료)**
  - 남은 것: 실제 이미지 에셋(인물 사진·파트너 로고·갤러리·지도)은 여전히 placeholder — 시트에 URL이 들어오면 자동 표시된다. 빌드 시 로컬 다운로드 파이프라인은 미구현.
- [x] **Phase 4 (일부)**: Google Sheets API 연결 완료 — 빌드가 시트를 직접 읽는다. 소스 우선순위 ①API ②data-cache 폴백 ③로컬 xlsx, `CMS_SOURCE=xlsx` 로 강제 전환. **(완료)**
- [ ] **Phase 4 (잔여)**: GitHub Actions 빌드·배포, 게시 트리거(예약+수동→Apps Script dispatch), 스테이징 URL.
- [ ] **Phase 5**: 검증 강화, 학생용 관리 런북 작성, 스테이징 검수, DNS 전환(cutover), 기존 Google Site는 백업 유지.
- [ ] **Phase 6**: 모니터링, 토큰·키 갱신 절차, 백업.

## 8. 다음 작업 지시 (Phase 2 — Claude Code가 여기서 시작)

**목표: 이 시트를 읽어 정적 HTML을 생성하는 Eleventy 프로토타입을 만든다.**

권장 순서:
1. `npm init` + `npm i @11ty/eleventy googleapis dotenv` 로 프로젝트 스캐폴딩. `.eleventy.js`, `src/`, `_data/` 구성.
2. **Sheets 데이터 로더**: `_data/site.js` 등에서 `googleapis`로 Google Sheets API(읽기 전용, 서비스 계정)를 호출해 각 탭을 JSON으로 로드.
   - 서비스 계정 JSON 키는 env로 주입(`GOOGLE_SERVICE_ACCOUNT_JSON`), 코드/repo에 커밋 금지.
   - `SHEET_ID`도 env.
   - 개발 단계에서는 시트 접근 전, 동봉된 `eplab_website_content.xlsx`를 CSV/JSON으로 덤프해 목업 데이터로 먼저 작업 가능.
3. **스키마 검증 레이어**: 각 탭의 필수 컬럼·타입 확인. `publish===TRUE` 행만 통과. 문제 행은 콘솔 경고 후 스킵(빌드 실패 금지).
4. **정규화**: `publish` 문자열 "TRUE"/"FALSE" → boolean. `order` 숫자 정렬. `date`/`period` 파싱.
5. **템플릿**: Nunjucks로 페이지별 템플릿 작성 — 위 6절 내비게이션 구조를 따른다. 우선 **Publications 페이지**를 연도별 그룹핑으로 end-to-end 렌더해 개념 검증.
6. `npx @11ty/eleventy --serve` 로 로컬 확인.

**설계 원칙(맹점 반영)**:
- 빌드는 **항상 성공**해야 한다. 나쁜 행은 스킵하고 로그.
- 이미지 URL은 빌드 시 로컬로 받아 `/assets`에 두는 단계를 Phase 3에 추가.
- 시트 헤더/컬럼 순서에 의존하지 말고 **헤더 이름으로 매핑**(학생이 열을 옮겨도 안전).

## 9. 디자인 핸드오프 (Design Handoff) — Phase 3 입력  ✅ 폴더에 반영됨

**확정 디자인이 `design/` 폴더에 들어있다. 빌드 전 반드시 `design/DESIGN_SPEC.md`를 먼저 읽어라.**

- `design/eP Lab Website.dc.html` — 확정 디자인 원본(단일 파일 SPA). **디자인·레이아웃·콘텐츠의 소스 오브 트루스.**
  - (원본 공유 URL: `https://claude.ai/design/p/d3042968-4f77-44c9-aac6-482878a547d0`)
- `design/DESIGN_SPEC.md` — **빌드 가이드**: 디자인 시스템, 라우트→Eleventy 페이지 매핑, 페이지별 컴포넌트, 데이터배열→시트 매핑, 인터랙션, Claude Design 문법→Nunjucks 변환 규칙, 콘텐츠 변경점.
- `design/tokens.css` — 원본 인라인 스타일에서 추출한 디자인 토큰/유틸리티. 전역 CSS의 기반.
- `design/support.js` — Claude Design 런타임(참고용, **최종 사이트엔 미사용**). `design/thumbnail.webp` — 미리보기.

**디자인 성격**: 원본은 다크 단일 테마 + 오렌지 액센트(`#FF6A1F`) + 모노스페이스. 해시 라우팅 SPA이며 콘텐츠가 파일 내 JS 배열에 하드코딩됨.
**테마는 원본대로 다크다.** 2026-09-02에 라이트로 갔다가 같은 날 되돌렸다. 그 왕복 덕분에 색이 전부 `site.css`의 `:root` 토큰으로 모였고, 이제 테마 전환은 그 블록 하나만 고치면 된다(§11 참고).
**목표**: 픽셀·레이아웃 **그대로 이식(port)** 하되 — ① 해시 SPA → Eleventy 실제 페이지, ② 하드코딩 데이터 → Google Sheet 로드, ③ support.js 인터랙션 → 바닐라 JS. **새로 디자인하지 말 것.**

**히어로 배경 이미지**: 기존 아티팩트 **재사용(채용)** — "eP Lab 히어로 배경" (`https://claude.ai/code/artifact/ef739503-f5ed-47e3-b8c9-936537e02c31`). Hero 슬롯에 배치, `/assets/`에 저장.

**⚠️ 디자인이 현재 xlsx보다 최신 (시트 업데이트 필요 — DESIGN_SPEC.md §5)**:
연구주제 desc·tags 완성 / 유나경="Na-Kyung Yoo" 확정 / 프로젝트 13건(진행6+완료7, 기존 9건) / 뉴스 35건(기존 16) / **신규 탭 필요: Conferences, Gallery** / 초청강연은 Achievements 하위 독립 페이지 / 주소 불일치(디자인 원흥관 E142 vs 기존 F621) 확인 필요.

## 10. 프로필 / 컨텍스트
- Prof. Soo-Hwan Park (박수환), Assistant Professor, Dept. of Mechanical, Robotics, and Energy Engineering, Dongguk University.
- 연구: 전동기 설계(IPMSM/AFPM/SPMSM), 전자기-열 연성해석, surrogate/multi-fidelity 모델링, 파워일렉트로닉스.
- 로컬 작업 폴더: `D:\claude\eplab+homepage`.

## 11. 알려진 기술 부채 (Known Debt)

### ~~xlsx 파서가 두 개다~~ → **해소됨 (2026-09-01)**
- 문제였던 것: 빌드(`cms.js`, SheetJS)와 캐시 덤프(`scripts/xlsx-to-json.js`, fflate 자체 XML 파싱)가 같은 파일을 **서로 다른 파서로** 읽었다. 서식이 붙은 셀에서 갈라질 수 있었고(SheetJS는 보이는 문자열 `"13.0%"`, 자체 파서는 원시값 `0.13`), 하필 갈라지는 지점이 **폴백**이라 평소 빌드는 멀쩡하고 API가 죽은 날에만 다른 값이 배포되는 실패가 가능했다.
- 해소 방법: 파서를 **`src/_data/xlsx-source.js` 하나로 통합**했다. `cms.js`(빌드)와 `scripts/xlsx-to-json.js`(캐시 덤프)가 같은 `loadFromXlsx()`를 부르고, `sheets-source.js`도 같은 `gridToObjects()`를 재사용한다. `fflate` 의존성 제거.
- 검증: 통합 후 덤프 결과가 구 파서의 커밋본과 **13개 탭 전부 바이트 단위로 동일**(`_manifest` 타임스탬프만 차이).
- **유지 규칙: xlsx 파서를 다시 늘리지 말 것.** 새로 xlsx를 읽어야 하면 `xlsx-source.js`를 임포트한다.

### 언어 규칙 (2026-09-01 확정)
- **한글 우선.** `preferred(ko, en)` = `ko || en`. `cms.config`(Site_Config 맵)와 `Members.name`·`Research_Topics.title`·`Research_Projects.title`·`Teaching.title`·`News.text` 파생 필드가 모두 이 함수를 거친다.
- **언어를 고르는 곳은 이 함수 하나뿐이다.** 템플릿이나 다른 모듈에서 `a || b`로 언어를 고르지 말 것 — 규칙이 조용히 갈라진다.
- **예외 두 종류**:
  1. 디자인이 두 언어를 **동시에** 보여주는 자리(연구주제 카드의 영문 제목+국문 부제, 구성원 카드의 한글 이름+영문 이름)는 템플릿이 `title_en`/`title_ko`를 각각 직접 쓴다.
  2. 디자인이 **영문만** 쓰는 자리(헤더 브랜드 `DONGGUK UNIVERSITY`, 히어로 eyebrow, Leader 카드 소속 — 원본 L28·L61·L144-146)는 `cms.configEn`을 쓴다.

### 테마 (다크 유지 — 2026-09-02 라이트 왕복)
- 사이트는 **다크 테마**다(원본 그대로). 그날 라이트로 뒤집었다가 되돌렸는데, 되돌리는 데 `:root` 블록 하나만 고치면 됐다.
  바꿀 수 있는 것은 `site.css` 맨 위 `:root` 의 **토큰 값뿐**이고, 컴포넌트 규칙은 한 줄도 안 건드린다.
  토큰 **이름이 뜻하는 위계**(`--text` 가 가장 진하고 `--text-ghost` 가 가장 옅다, `--line-soft` 가 `--line` 보다 흐리다)를
  그대로 유지했기 때문이다. 나중에 테마를 또 바꾸려면 **`:root` 한 블록만** 고친다.
- 규칙 안에 박혀 있던 색은 전부 토큰으로 뺐다: `--stripe-1/2`(placeholder 줄무늬), `--header-bg`, `--shadow-panel`, `--fade`(갤러리 화살표).
  **새 색을 규칙에 직접 쓰지 말 것** — 그 순간 테마 전환이 다시 깨진다.
- **`.hero` 블록은 지우지 말 것.** 히어로는 테마와 무관하게 항상 어둡다 — `hero.svg` 가 어두운 일러스트라 밝게 뒤집으면 그림이 망가진다.
  지금은 `:root` 와 값이 같아 아무 일도 안 하지만, 라이트로 뒤집는 순간 히어로 글자를 지켜주는 게 이 블록이다.
  **`color: var(--text)` 를 같이 지정해야 한다** — 토큰만 바꾸면 `body` 에서 이미 계산돼 상속된 `color` 는 그대로여서 제목이 안 보인다(실제로 겪었다).
- `.cardgrid` 의 hairline 을 컨테이너 배경 → **카드 자신의 `outline`** 으로 바꿨다. 예전 방식은 마지막 줄의
  **빈 칸까지 선 색으로 칠해** 덩어리가 생겼다 — 다크에선 안 보였지만 라이트로 뒤집으니 드러났다. 되돌리지 않았다(다크에서도 이쪽이 맞다).

### 이미지 URL — 구글 드라이브 (2026-09-02)
- 시트의 이미지 열(`photo_url`·`image_url`·`Gallery.image_urls`)은 `type:'image'` 로, `cms-schema.js` 의
  **`driveDirect()`** 를 거친다. 학생이 드라이브 "링크 복사"로 붙여넣는
  `…/file/d/<ID>/view?usp=…` 는 **이미지가 아니라 뷰어 웹페이지**라 `<img src>` 에서 안 보인다.
  파일 ID만 뽑아 `drive.google.com/thumbnail?id=<ID>&sz=w1000` 로 정규화한다. 드라이브 링크가 아니면 그대로 통과.
- **주소를 고쳐도 공유 설정이 비공개면 소용없다.** 비공개면 어떤 형태를 써도 구글 로그인 HTML 이 200 으로
  돌아온다(4xx 가 아니라서 조용히 실패한다). 사진이 안 나오면 **공유 설정을 먼저 확인**할 것 —
  드라이브 폴더를 "링크가 있는 모든 사용자 · 뷰어"로.
- 진단법: `curl -sL "<URL>" -o /dev/null -w "%{content_type}"` → `image/*` 면 정상, `text/html` 이면 로그인 페이지다.
- `.has-img` 에서 `background:none` 을 뺐다. 링크가 깨지면 빈 상자 대신 줄무늬 placeholder 가 보여서
  실패가 눈에 띈다. 정상일 때는 이미지가 덮으므로 차이가 없다.
- 근본 해결은 **빌드 시 내려받아 자체 호스팅**(HOW_TO_BUILD 7단계). 드라이브 핫링크는 트래픽 제한이 있다.
- 2026-09-02 공유 설정 전환 후 구성원 사진 10장 전부 `image/*` 로 정상 로드 확인.

### 이미지 슬롯 크기 (2026-09-02, 진짜 사진이 들어오며 드러난 버그)
- `.imgslot` 에 **`min-height:0` · `overflow:hidden`** 이 반드시 있어야 한다. 슬롯은 `aspect-ratio` 로
  크기를 정하는데, flex 아이템의 `min-height:auto` 때문에 **안에 들어온 이미지의 실제 높이**가
  최소 높이가 되어 슬롯이 늘어난다. placeholder 만 있을 땐 멀쩡하다가 사진이 들어오는 순간
  카드 높이가 제각각이 된다. 지우지 말 것.
- 사진은 대부분 세로형 증명사진(약 2:3)이다. `object-position: center 20%` 로 위쪽을 잡아 머리가 안 잘리게 한다.
- `.leader__portrait` 는 원본의 가로형 4/3 → **3/4 세로형**으로 바꿨다(4/3 에 증명사진을 넣으면 턱이 잘린다).

### 졸업생 표시 (2026-09-02)
- `Members` 의 `category=Alumni` 를 둘로 나눠 보여준다. 판정은 `cms-schema.js` 의 `isDegreeAlumni`
  (position 에 석사/박사/Master/PhD 가 있으면 학위 취득자).
  - **학위 취득자** → 재학생과 같은 사진 카드. 이름 · 학위(취득년월) · 현 소속.
  - **학부연구생** → 사진 없이 텍스트 줄.
  - 못 알아본 position 은 텍스트 줄로 떨어진다(사진 없는 빈 카드보다 낫다).
- **학위 취득년월은 `cohort_period` 의 끝에서 뽑는다**(`endOfPeriod()`). 전용 열이 없어서다 —
  "연구실을 떠난 시점 = 학위 취득 시점"이라는 전제이므로, 안 맞는 사람이 생기면 전용 열을 만들 것.
- 학부생 카드 크기를 대학원생과 같게 맞추면서 `.team-grid-ug` · `.person--ug` 규칙을 걷어냈다.

### 에셋 파이프라인 (2026-09-02, DESIGN_SPEC §8 / HOW_TO_BUILD 7단계)
- `src/_data/asset-pipeline.js` 가 빌드 때 시트의 이미지 URL을 **내려받아 자체 호스팅**한다.
  대상은 `TARGETS` 표 하나에 모여 있다: `Members.photo_url` · `Research_Topics.image_url` ·
  `News.image_url` · `Gallery.image_urls` → `/assets/media/`,
  `Research_Projects.partner_logo_url` · `Collaborators.logo_url` → `/assets/partners/`.
  뒤의 둘은 지금 시트에 없지만(열·탭 폐기) 되살아나면 자동으로 잡히도록 규칙만 남겼다.
- **캐시는 `asset-cache/`** (URL sha1 앞 16자 + 확장자). 커밋하지 않는다(.gitignore).
  비우려면 `npm run assets:clean`. 확장자는 URL이 아니라 **응답 content-type**으로 정한다 —
  드라이브 URL엔 확장자가 없다.
- **출력은 `_site/` 로 직접 쓴다.** `src/assets/` 에 쓰면 `--serve` 가 그 폴더를 감시해
  빌드→파일생성→재빌드 **무한 루프**가 돈다. 감시 대상 밖에 써야 한다.
- **실패는 빌드를 죽이지 않는다.** 한 장이 실패하면 그 항목만 원격 URL로 남아 예전처럼
  핫링크로라도 보인다(실측: 4건 실패 시 나머지 1건만 로컬화, 종료코드 0).
  이미지가 아닌 응답(드라이브 비공개 → 로그인 HTML 200)은 content-type 으로 걸러낸다.
- `ASSETS=off` 로 파이프라인을 끄면 예전처럼 원격 URL을 쓴다(디버깅용).
- **캐시 키는 URL 해시다 — 이건 의도된 것이다(2026-09-06 확인).** 드라이브에서 같은 파일을
  새 사진으로 덮어쓰면 URL 이 그대로라 옛 사진이 계속 나간다. 주기적 만료를 넣을 수도 있었지만,
  "사진을 바꿀 땐 새 파일로 올리고 새 링크를 붙여넣는다"를 README 에 규칙으로 적는 쪽을 택했다.
  드라이브 요청을 늘리지 않는 편이 낫다는 판단이다. **버그로 보고 고치지 말 것.**
- ⚠️ **`asset-cache/` 를 커밋하지 않기로 한 대가**: CI 는 매번 새로 받는다. 드라이브가
  비공개로 바뀌거나 죽은 날에는 새 빌드가 핫링크로 되돌아간다(사진이 깨질 수 있다).
  완전한 재현성이 필요해지면 캐시를 커밋하는 쪽으로 바꿀 것.

### 반응형 (2026-09-02 점검)
- 전역 안전장치 `img, svg, video { max-width: 100% }`. 시트 사진은 크기가 제각각이라
  (353px ~ 1500px) 규칙이 빠지면 좁은 화면에서 가로 스크롤이 생긴다.
- 히어로는 `<picture>` 로 640px 이하에서 **세로형**(`hero-portrait.svg` 860×980)으로 바뀐다.
  가로 아트를 폰 폭에 cover 로 자르면 구도가 무너진다. `<picture>` 는 인라인이라
  `.hero__media picture { display:block; height:100% }` 가 없으면 안쪽 img 높이가 풀리지 않는다.
- 점검 결과: **7개 폭(360·390·640·768·860·1024·1440) × 12개 페이지에서 가로 넘침 0px,
  칸을 넘는 이미지 0개.**

### 이미지 우클릭 차단 · site.js 로딩 (2026-09-03)
- 이미지 **우클릭·드래그를 막는다**(`site.js`). 문서에 리스너 하나만 걸어 위임 처리하므로
  나중에 늘어나는 이미지에도 자동으로 적용된다. CSS 쪽에도 `-webkit-user-drag:none` 을 둬서
  JS 가 꺼져도 드래그는 막힌다.
- ⚠️ **저작권 보호가 아니다.** 개발자도구·소스보기·JS 끄기·화면 캡처로는 그대로 가져갈 수 있고
  이미지 URL 자체가 공개돼 있다. "무심코 저장"을 줄이는 정도로만 기대할 것. 요청에 따른 조치다.
- **`hasScript` 프론트매터를 없앴다.** `site.js` 를 모든 페이지에 싣는다. 그 플래그를
  빠뜨리면 토글이 조용히 죽는 함정이었다(Publications·Conferences 에 접기를 붙일 때 실제로 겪었다).
  스크립트는 전부 `querySelectorAll` 기반이라 해당 요소가 없는 페이지에선 아무 일도 안 한다.
- 외부 링크(Google Scholar 3종: 푸터 · Leader 카드 · Publications/Conferences)는
  모두 `target="_blank" rel="noopener"` 로 새 탭에서 연다.

### 시트 사본을 저장소에 두지 않는다 (2026-09-06 결정)
- `data-cache/` 와 `eplab_website_content.xlsx` 를 **저장소에서 내렸다**(파일은 gitignore, 코드는 유지).
  두 가지 이유다:
  1. **공개 저장소라 `publish` 를 끈 행까지 누구나 볼 수 있었다.** 체크박스를 끄는 것은
     "홈페이지에 안 보이게" 하는 것이지 "감추는" 것이 아니었다.
  2. 사본이 있으면 시트를 못 읽은 빌드가 **옛 내용으로 조용히 배포**됐다. 실제로 시크릿을
     잘못 넣었을 때 초록불로 옛 사이트가 나갔다.
- 대신 **`deploy.yml` 이 배포를 막는다.** `source=sheets-api` 가 아니면 실패시켜 아티팩트를
  올리지 않는다. 그러면 GitHub Pages 가 **직전 배포본을 계속 서빙**한다 —
  설계 문서(§3)가 말한 "직전 정상 빌드 유지"에 사본을 커밋하는 것보다 정확히 들어맞는다.
- 빈 내용이 배포되는 것도 막는다: 구성원 카드가 0개면 실패시킨다(시트는 읽었는데 권한이
  바뀌어 빈 응답이 온 경우 등).
- ⚠️ **빌드(eleventy)는 여전히 절대 실패하지 않는다.** 실패시키는 것은 **CI 의 배포 판정**뿐이다.
  이 분리를 유지할 것 — 로컬 작업이 데이터 문제로 멈추면 안 된다.
- `cache-refresh.yml` 워크플로는 함께 삭제했다. 그대로 두면 매주 `data-cache/` 를 다시 만들어
  커밋해 방금 내린 것을 되돌린다.
- 로컬 오프라인 작업용 사본은 `npm run cache:refresh` 로 만들 수 있다(커밋되지 않음).

### 남아 있는 것
- ~~폴백 캐시는 수동 갱신~~ → **폐기 (2026-09-06)**. 아래 참고.
- ~~에셋 자체 호스팅 미구현~~ → **해소됨 (2026-09-02)**. `src/_data/asset-pipeline.js` 참고(아래).
- **`Collaborators` 탭이 어떤 페이지에도 안 쓰인다**: 확정 디자인에 협력기관 섹션이 없다. 섹션 부활 vs 탭 폐기 결정 필요.
- **Home About 제목만 템플릿 하드코딩**: `Site_Config`에 대응 키가 없어서다. 키를 추가하면 시트로 뺄 수 있다.

---

*최종 업데이트: 2026-09-01. Phase 2·3 완료 + Google Sheets API 연결 완료. 언어 한글 우선으로 전환. 다음: 에셋 파이프라인(7단계), GitHub Actions 배포(8단계).*
