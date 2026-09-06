# Claude Code 작업 절차 — eP Lab 홈페이지 빌드

> 이 폴더(`D:\claude\eplab+homepage`)의 준비물로 **Claude Code에서 사이트를 만드는 순서**입니다.
> 각 단계의 **프롬프트 블록을 그대로 복사해 Claude Code에 붙여넣으세요.** 한 단계씩 끝내고 확인 후 다음으로.

---

## 0. 시작 전

**폴더에 이미 있는 것** (Claude Code가 참고할 소스):
- `CLAUDE.md` — 프로젝트 컨텍스트·결정·로드맵 (Claude Code가 자동으로 읽음)
- `design/DESIGN_SPEC.md` — **빌드 가이드**(디자인→코드 변환 규칙, 페이지·데이터 매핑)
- `design/eP Lab Website.dc.html` — 확정 디자인 원본(소스 오브 트루스)
- `design/tokens.css` — 디자인 토큰
- `eplab_website_content.xlsx` — 콘텐츠(14개 탭)

**시작 방법**: Claude Code를 이 폴더에서 연다 → `CLAUDE.md`가 자동 로드됨.

**데이터 소스 2단계 전략** (중요):
- **MVP(지금)**: `eplab_website_content.xlsx`를 **로컬 목업 데이터**로 사용. → Google 계정·인증 없이 바로 개발 가능. 엑셀을 고치면 사이트가 갱신되어, 최종 "Google Sheet 관리" 경험을 미리 재현.
- **나중**: 같은 데이터 구조를 유지한 채 로더만 **Google Sheets API**로 교체. (아래 6단계)

**나중에 필요한 준비물** (교수 액션, MVP엔 불필요):
- Google Cloud 서비스 계정 JSON 키 + 공유된 Google Sheet의 `SHEET_ID` (라이브 시트 연결용)
- GitHub 저장소 (배포용)
- 학교 IT에 `eplab.dgu.ac.kr` DNS 변경 문의 (도메인 연결, 가장 먼저 문의 시작)

---

## 1단계 — 스캐폴딩 + 로컬 데이터 레이어

```text
CLAUDE.md와 design/DESIGN_SPEC.md를 먼저 읽어라. 그다음:
1) Eleventy(11ty) 프로젝트를 스캐폴딩해라: npm init, @11ty/eleventy 설치,
   .eleventy.js, src/(페이지·레이아웃·에셋), src/_data/ 구성.
2) 데이터 레이어를 추상화해라: src/_data/cms.js 를 만들어
   루트의 eplab_website_content.xlsx 를 읽어(예: SheetJS/xlsx 패키지)
   각 탭을 정규화된 JSON으로 반환해라.
   - publish 열이 TRUE 인 행만 통과, order 오름차순 정렬.
   - 헤더 이름으로 매핑(열 순서에 의존 금지).
   - 나중에 이 파일만 Google Sheets API 버전으로 교체할 수 있도록,
     반환 구조(스키마)를 탭별로 명확히 문서화해라.
3) 나쁜 행(필수값 누락 등)은 콘솔 경고 후 건너뛰고 빌드는 항상 성공하게 해라.
아직 페이지 템플릿은 만들지 말고, `npx @11ty/eleventy` 빌드가 통과하고
cms.js가 각 탭을 올바르게 로드하는지 콘솔로 확인해라.
```
**확인**: 빌드 성공, cms.js가 논문 34·프로젝트 13·구성원 17 등 정확한 개수를 로드.

> 파일명 주의: Eleventy 3 은 `content` 를 예약어(레이아웃 안의 렌더된 본문)로 쓴다.
> 그래서 글로벌 데이터 파일은 `content.js` 가 아니라 **`src/_data/cms.js`**, 템플릿에서는 `{{ cms.Publications }}`.

---

## 2단계 — 디자인 토큰 + 공용 레이아웃(헤더·푸터·네비)

```text
design/tokens.css 를 전역 CSS로 넣고, design/eP Lab Website.dc.html 의
<header>·<footer>·<nav>(L24–46, L511–530)를 그대로 이식해
공용 레이아웃 base.njk 를 만들어라.
- 다크테마 + 오렌지(#FF6A1F) + 모노스페이스 유지.
- 네비 구조는 DESIGN_SPEC.md §2 표를 따르고, 현재 URL 기준으로
  활성 상위 메뉴를 오렌지로 표시(빌드 타임, JS 최소화).
- 드롭다운(Team/Research/Achievements)은 CSS :hover 로.
빈 페이지 하나(홈 자리)에 레이아웃을 적용해 헤더/푸터/네비가
디자인과 동일하게 보이는지 확인해라.
```
**확인**: 헤더·네비·드롭다운·푸터가 원본 디자인과 시각적으로 일치. ✅ 완료 (2026-09-01)

---

## 3단계 — Publications 페이지 (end-to-end 개념검증)

```text
design/eP Lab Website.dc.html 의 Publications 섹션(L316–340)을 이식해
/achievements/publications/ 페이지를 만들어라.
- 데이터는 cms.js의 Publications 탭에서.
- 연도별 그룹핑, 각 논문: 제목 → 저자 → 게재지 → 지표 칩 + DOI 버튼.
- 저자 문자열에서 "S. H. Park"(뒤 * / ** 포함)을 오렌지 볼드로 강조
  (DESIGN_SPEC.md §4-1의 decoratePub 규칙).
- metrics 문자열을 "·"로 분리해 칩으로, Q1 또는 JCR ≤ 10%면 오렌지 강조.
인라인 스타일은 tokens.css 유틸리티/페이지 CSS로 정리하고,
`--serve`로 띄워 34편이 연도별로 정확히 렌더되는지 확인해라.
```
**확인**: 34편이 2026→2019 순, 저자 강조·지표 칩·DOI 링크 정상. ✅ 완료 (2026-09-01)

---

## 4단계 — 나머지 페이지 이식

```text
DESIGN_SPEC.md §2·§3의 매핑에 따라 나머지 페이지를 원본 디자인 그대로 이식하고
cms.js 데이터에 연결해라. 각 라우트를 독립된 Eleventy 페이지로:
- / (Home: 히어로 + About + 통계타일 + Research Topics 6 + Latest News)
- /team/leader/, /team/researchers/
- /research/topics/ (설명·태그 포함), /research/projects/ (파트너 로고 포함, §4-1 스니펫)
- /achievements/conferences/ (placeholder), /achievements/patents/, /achievements/invited-talks/
- /teaching/, /news/ (+ Gallery), /contact/
sc-for→{% for %}, sc-if→페이지 분리, 인라인 스타일→CSS 로 변환.
페이지별로 --serve 확인하며 진행해라.
```
**확인**: 각 페이지가 디자인과 일치하고 시트 데이터로 채워짐. ✅ 완료 (2026-09-01) — `partner_logo_url` 은 시트가 아직 비어 있어 LOGO placeholder 폴백이 동작 중.

---

## 5단계 — 인터랙션 (바닐라 JS)

```text
support.js 없이, 다음 인터랙션을 가벼운 바닐라 JS로 재구현해라
(DESIGN_SPEC.md §6):
- News "지난 News 보기" / Invited Talks "이전 보기" 토글
- News Gallery: 항목별 사진 캐러셀(‹ ›) + 페이지네이션(PREV/NEXT)
- (네비 드롭다운은 2단계에서 CSS로 처리했으면 재확인만)
```
**확인**: 토글·갤러리 동작 정상, JS 없이도 콘텐츠는 보이게(점진적 향상). ✅ 완료 (2026-09-01)

---

## 6단계 — Google Sheets API 연결 (목업 → 라이브)

> 교수님이 서비스 계정 키와 SHEET_ID를 준비한 뒤 진행.

```text
src/_data/cms.js 의 데이터 소스를 로컬 xlsx에서 Google Sheets API(읽기 전용,
서비스 계정)로 교체해라. 반환 스키마는 1단계와 동일하게 유지해
나머지 코드는 바뀌지 않게 해라.
- 서비스 계정 JSON 키는 환경변수 GOOGLE_SERVICE_ACCOUNT_JSON, 시트는 SHEET_ID 로 주입.
  .env 사용, .gitignore에 추가, 절대 커밋 금지.
- 로컬 xlsx 로더는 오프라인/개발용 폴백으로 남겨두고 환경변수로 전환 가능하게.
- 인증 실패/네트워크 오류 시 직전 성공 데이터 또는 명확한 에러로 빌드가
  통째로 깨지지 않게 처리.
```
**확인**: 시트에서 실데이터 로드, `publish` 체크박스 토글이 다음 빌드에 반영. ✅ 완료 (2026-09-01)

> 소스 우선순위: ① Sheets API(키 있을 때) → ② `data-cache/`(API 실패 시 폴백) → ③ 로컬 xlsx(키 없음/오프라인).
> `CMS_SOURCE=xlsx` 로 시트를 건너뛸 수 있다. 넷 중 어느 경로에서도 빌드는 exit 0.
> **⚠️ 2026-09-06 변경**: `data-cache/` 와 로컬 xlsx 를 **저장소에서 내렸다**(코드·경로는 유지, 파일만 gitignore).
> 공개 저장소라 미게시 행까지 노출됐고, 사본이 있으면 시트를 못 읽은 빌드가 옛 내용으로 조용히 배포됐기 때문이다.
> 이제 CI 는 `source=sheets-api` 가 아니면 **배포를 중단**하고, GitHub Pages 가 직전 배포본을 계속 서빙한다.
> 로컬 오프라인 작업이 필요하면 `npm run cache:refresh` 로 사본을 만들 수 있다(커밋되지 않음).

---

## 7단계 — 에셋 처리 (이미지·로고·PDF)  ✅ 완료 (2026-09-02)

```text
DESIGN_SPEC.md §8에 따라 에셋 파이프라인을 추가해라:
- 시트의 photo_url / partner_logo_url / logo_url / image_urls / image_url 을
  빌드 시 다운로드해 /assets/(파트너 로고는 /assets/partners/)에 자체 호스팅.
- 히어로 배경 이미지("eP Lab 히어로 배경" 아티팩트)를 Home 히어로 슬롯에 배치.
- 반응형: 이미지 max-width, 좁은 화면 레이아웃 점검.
```
**확인**: 이미지가 로컬에서 서빙(핫링크 X), 히어로·인물·파트너 로고 표시.

**결과**
- `src/_data/asset-pipeline.js` — 빌드 때 이미지 URL을 받아 `_site/assets/media/`
  (파트너 로고는 `.../partners/`)에 자체 호스팅하고, 데이터의 URL을 로컬 경로로 바꾼다.
  캐시는 `asset-cache/`(커밋 안 함, `npm run assets:clean` 으로 비움).
- `partner_logo_url` · `Collaborators.logo_url` 은 **시트에서 이미 폐기**된 열·탭이라
  실제로 받을 것이 없다. 되살아나면 자동으로 잡히도록 규칙만 남겨뒀다.
- 히어로는 이전 단계에서 이미 배치돼 있었다(`/assets/hero.svg`). 이번에 좁은 화면용
  세로판(`hero-portrait.svg`)을 `<picture>` 로 연결했다.
- 실측: 출력 HTML에 **원격 이미지 참조 0건**, 7개 폭 × 12개 페이지에서 **가로 넘침 0px**.
- 한 장이 실패해도 그 항목만 원격 URL로 남고 빌드는 성공한다(`ASSETS=off` 로 전체 끄기 가능).

---

## 8단계 — 빌드 자동화 + 배포

> GitHub 저장소 준비 후.

```text
GitHub Actions 워크플로를 만들어 Eleventy 빌드 → GitHub Pages 배포를 자동화해라.
- 게시 트리거(MVP): 예약 빌드(예: 15~30분 cron) + 수동 실행(workflow_dispatch).
  (이후 Apps Script onEdit → repository_dispatch 로 "체크박스 게시" 반자동화)
- 서비스 계정 키·SHEET_ID는 GitHub Actions Secrets 로.
- 스테이징 URL로 먼저 검수, 이후 커스텀 도메인(eplab.dgu.ac.kr, 학교 IT DNS) 연결.
```
**확인**: 스테이징에서 전체 사이트 검수 → 이상 없으면 도메인 전환. 기존 Google Site는 백업 유지.

---

## 시트 수정이 반영됐는지 확인하는 법 (운영 런북)

> **중요**: 이 사이트는 **빌드 시점에** 시트를 읽는다. 시트를 고쳐도 사이트가 저절로 바뀌지 않는다.
> 반드시 **빌드를 한 번 돌려야** 반영된다. (CLAUDE.md 맹점 #1)

### 방법 A — 화면으로 확인 (권장)

터미널 두 개를 쓴다.

```
[터미널 1] npm run serve      # http://localhost:8080 에서 사이트가 뜬다. 계속 켜둔다.
[터미널 2] npm run build      # 시트를 고칠 때마다 이걸 실행
```

시트를 고친 뒤 **터미널 2에서 `npm run build`** 를 돌리고 브라우저를 새로고침하면 반영된다.

- ❌ `npm run serve` 는 **시트 변경을 자동으로 감지하지 못한다.** 로컬 파일만 감시하기 때문이다.
  시트만 고치고 기다리면 아무 일도 일어나지 않는다. (실측 확인)
- 💡 `src/` 안의 파일을 아무거나 저장해도 재빌드되면서 시트를 다시 읽는다. 편집기가 열려 있다면 이게 더 빠르다.

### 방법 B — 데이터만 빠르게 확인 (브라우저 없이)

```
npm run report
```

시트에서 지금 무엇이 읽히는지 탭별로 보여준다. "행이 게시됐는가"만 확인할 때 가장 빠르다.

```
탭                게시  미게시   미입력 필드
Members             18      0   photo_url 18/18
Conferences          0      3   없음  ← 게시된 행이 없다
```

### 반영이 안 될 때 확인 순서

1. **`publish` 체크박스를 켰는가** — 꺼진 행은 `미게시`로 집계되고 사이트에 나오지 않는다.
2. **빌드 로그의 경고를 읽었는가** — 행이 스킵되면 시트 행 번호와 함께 이유가 찍힌다.
   예: `Members!7.category: 허용되지 않은 값 "박사과정"`
3. **`source=` 를 확인했는가** — 로그 마지막 줄이다.
   - `source=sheets-api` → 시트에서 읽었다. 정상.
   - `source=cache-fallback` → **시트를 못 읽어 옛 캐시로 빌드했다.** 방금 고친 내용은 반영되지 않았다.
   - `source=xlsx` → `.env` 의 키가 없거나 `CMS_SOURCE=xlsx` 가 걸려 있다.
4. **헤더를 바꾸지 않았는가** — 헤더 이름이 바뀌면 그 열이 통째로 사라지고 드리프트 경고가 뜬다.
   (헤더 행은 보호돼 있어 고치려면 경고를 넘겨야 한다)

---

## 진행·검수 팁
- **한 단계씩**: 각 단계 확인(`--serve`) 후 다음으로. 3단계(Publications)를 반드시 먼저 통과.
- **디자인 애매하면 원본을 열어라**: `design/eP Lab Website.dc.html`이 최종 기준. Claude Code에 "원본 L316–340과 비교해 차이를 고쳐라"처럼 라인 참조로 지시하면 정확.
- **콘텐츠 수정은 시트에서**: 코드가 아니라 Google Sheet를 고쳐라. 그게 이 프로젝트의 목적.
- **언어는 한글 우선**(2026-09-01 확정): `*_ko`가 게시 텍스트, 비면 `*_en`으로 폴백. 언어를 고르는 코드는 `cms-schema.js`의 `preferred(ko, en)` 하나뿐이니 거기만 보면 된다.
- **빌드는 항상 성공**: 나쁜 행은 스킵·로그. 학생이 시트를 깨도 사이트가 안 죽게.
- **검수 남은 항목**(시트 README): 프로젝트 영어 초안, Conferences 실데이터, 사진·로고·Scholar 링크, 강의 학기/설명.

---
*빠른 시작: 0단계 확인 → 1~3단계로 개념검증 → 4·5단계로 전체 완성(목업) → 준비되면 6·7·8단계로 라이브·배포.*
