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
| **Site_Config** | key, value_en, value_ko, notes | 전역 설정(랩명, 배너, 연구영역4, 연락처, 채용문구, 푸터) |
| **Members** | publish, order, category*, name_en, name_ko, position, email, cohort_period, current_affiliation, photo_url, scholar_url, notes | Team (Leader/Researchers) |
| **Leader_CV** | publish, section**, order, date, title, detail | Team > Leader (교수 이력) |
| **Research_Topics** | publish, order, title, description, image_url | Research > Topics |
| **Research_Projects** | publish, order, status(Ongoing/Completed), title_en, title_ko, funder_en, funder_ko, period_start, period_end, role_en, role_ko, notes | Research > Projects |
| **Publications** | publish, order, year, authors, title, venue, details, metrics, doi, featured, raw_citation | Achievements > Publications |
| **Patents** | publish, order, country, title, year, patent_no, inventors, notes | Achievements > Patents |
| **Teaching** | publish, order, level(Undergraduate/Graduate), title_en, title_ko, course_code, notes | Teaching |
| **News** | publish, order, date, category***, title_en, source_ko, image_url | News |
| **Collaborators** | publish, order, name, logo_url, url, notes | About > Collaborator |

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

**디자인 성격**: 다크 단일 테마 + 오렌지 액센트(`#FF6A1F`) + 모노스페이스. 해시 라우팅 SPA이며 콘텐츠가 파일 내 JS 배열에 하드코딩됨.
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

### 남아 있는 것
- **폴백 캐시는 수동 갱신**: `data-cache/` 는 `npm run cache:refresh` 로만 갱신된다. 갱신을 빠뜨리면 API 장애일 때 옛 내용이 조용히 배포된다. 8단계에서 CI 에 넣을 것.
- **에셋 자체 호스팅 미구현**: 시트의 이미지 URL을 빌드 시 내려받아 `/assets/`에 두는 파이프라인이 없다. 지금은 시트 URL을 그대로 `<img src>`에 쓴다 — Drive 직링크가 들어오면 throttling에 걸린다. (HOW_TO_BUILD 7단계)
- **`Collaborators` 탭이 어떤 페이지에도 안 쓰인다**: 확정 디자인에 협력기관 섹션이 없다. 섹션 부활 vs 탭 폐기 결정 필요.
- **Home About 제목만 템플릿 하드코딩**: `Site_Config`에 대응 키가 없어서다. 키를 추가하면 시트로 뺄 수 있다.

---

*최종 업데이트: 2026-09-01. Phase 2·3 완료 + Google Sheets API 연결 완료. 언어 한글 우선으로 전환. 다음: 에셋 파이프라인(7단계), GitHub Actions 배포(8단계).*
