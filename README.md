# eP Lab 홈페이지 관리 안내

동국대학교 전동화 추진시스템 연구실(eP Lab) 홈페이지입니다.

**https://eplab-dgu.github.io/**

홈페이지 내용은 **구글 시트 한 개**로 관리합니다. 코드를 몰라도 시트만 고치면 됩니다.
이 문서는 그 방법을 처음부터 끝까지 설명합니다.

---

## 한 장 요약

```
① 구글 시트에서 내용을 고친다
② GitHub 의 Actions 탭에서 "Run workflow" 를 누른다   ← 이 단계를 빠뜨리면 반영 안 됨
③ 1~2분 뒤 홈페이지에서 Ctrl+Shift+R 로 새로고침
```

**시트를 고쳤다고 홈페이지가 저절로 바뀌지 않습니다.** 30분마다 자동으로 반영되긴 하지만
늦어지거나 건너뛸 수 있으니, 확실히 하려면 ②를 직접 눌러주세요.

---

## 1. 시트에서 내용 고치기

### 게시 여부는 `publish` 체크박스로

모든 탭의 맨 왼쪽에 `publish` 체크박스가 있습니다.

- **체크됨** → 홈페이지에 나옵니다
- **체크 안 됨** → 홈페이지에 안 나옵니다 (시트에는 그대로 남습니다)

지우지 말고 체크만 풀면 됩니다. 나중에 다시 켜면 그대로 살아납니다.

### 순서는 `order` 숫자로

숫자가 **작을수록 위에** 옵니다. 10, 20, 30… 처럼 띄엄띄엄 쓰면 나중에 사이에 끼워 넣기 좋습니다.

### 절대 건드리면 안 되는 것

**1행(헤더)** 입니다. `publish`, `order`, `title` 같은 이름들이 적힌 줄입니다.
이 이름으로 홈페이지와 연결되기 때문에, 이름을 바꾸거나 열을 지우면 **그 내용이 통째로 사라집니다.**
보호를 걸어놨기 때문에 고치려 하면 경고창이 뜹니다. 경고가 뜨면 취소하세요.

> 열의 **순서**를 바꾸는 것은 괜찮습니다. 이름으로 찾기 때문입니다.

### 탭별 필수 항목

아래 항목이 비어 있으면 **그 줄 전체가 홈페이지에 안 나옵니다.**

| 탭 | 반드시 채워야 하는 칸 |
|---|---|
| Members | `category`, `name_en` |
| Leader_CV | `section`, `title` |
| Research_Topics | `title_en` |
| Research_Projects | `status`, `title_ko` |
| Publications | `year`, `authors`, `title` |
| Conferences | `year`, `title` |
| Patents | `title` |
| Invited_Talks | `date`, `title` |
| Teaching | `level`, `title_en` |
| News | `date` |
| Gallery | `date`, `title` |

### 정해진 값만 넣을 수 있는 칸

드롭다운으로 고르게 되어 있습니다. **직접 타이핑하지 말고 목록에서 고르세요.**
목록에 없는 값을 넣으면 그 줄이 안 나옵니다.

| 탭 · 칸 | 고를 수 있는 값 |
|---|---|
| Members · `category` | Faculty / Graduate / Undergraduate / Alumni |
| Leader_CV · `section` | ResearchInterest / Education / Experience / Award / Activity |
| Research_Projects · `status` | Ongoing / Completed |
| Research_Projects · `role` | PI / Co-I / Advisor |
| Patents · `status` | Registered / Filed / Pending |
| Teaching · `level` | Undergraduate / Graduate |
| News · `category` | Paper / Research / Conference / Event / People / Award |

### 사진 넣는 법 (구글 드라이브)

1. 사진을 구글 드라이브에 올립니다
2. 파일 우클릭 → **공유** → **링크가 있는 모든 사용자** → 권한 **뷰어**
3. **링크 복사**를 눌러 나온 주소를 시트의 `photo_url` / `image_url` 칸에 붙여넣습니다

주소 모양이 `https://drive.google.com/file/d/…/view?usp=…` 여도 괜찮습니다.
홈페이지를 만들 때 알아서 이미지 주소로 바꾸고, 사진을 홈페이지 안으로 복사해 옵니다.

> **"링크가 있는 모든 사용자"로 바꾸지 않으면 사진이 안 나옵니다.** 사진이 안 보이면 이것부터 확인하세요.
> 폴더 단위로 설정하면 그 안의 사진이 전부 적용됩니다.

### 글을 여러 줄로 나누고 싶을 때

셀 안에서 줄을 나누려면 **` | `** (앞뒤 공백 + 세로줄)를 넣습니다.

```
Advisor: Prof. Myung-Seop Lim | Dissertation: Design Process of IPMSM
```

→ 홈페이지에서 두 줄로 나옵니다.

시트에 `<br>` 같은 HTML 은 넣지 마세요. 글자 그대로 나옵니다.

---

## 2. 홈페이지에 반영하기

1. **https://github.com/eplab-dgu/eplab-dgu.github.io/actions/workflows/deploy.yml** 접속
2. 오른쪽 **Run workflow** 버튼 → 다시 **Run workflow**
3. 1~2분 기다립니다

### 결과 확인 — 초록불만 보면 안 됩니다

**빌드는 어떤 경우에도 성공(초록불)합니다.** 시트를 못 읽어도 옛날 내용으로 홈페이지를 만들고
성공으로 끝나도록 만들어져 있습니다(홈페이지가 통째로 죽는 것보다 낫기 때문입니다).

그래서 초록불을 확인한 뒤 **한 단계 더** 봐야 합니다:

실행을 클릭 → **build** → **Check which source the build used** 를 펼칩니다.

```
데이터 소스: sheets-api
시트에서 직접 읽었다 — 최신 내용이다.        ✅ 정상
```

이 문구가 아니면 시트 내용이 반영되지 **않은** 것입니다. 아래 3번을 보세요.

### 홈페이지에서 확인

**Ctrl + Shift + R** 로 새로고침하세요.

그냥 F5 를 누르면 브라우저가 저장해둔 옛 화면을 보여줍니다(최대 10분).
"분명 고쳤는데 안 바뀐다" 의 대부분이 이것입니다.

---

## 3. 문제가 생겼을 때

### 고친 내용이 홈페이지에 안 나온다

순서대로 확인하세요.

**① `publish` 체크박스를 켰나요?**
가장 흔한 원인입니다.

**② `Ctrl+Shift+R` 로 새로고침했나요?**
두 번째로 흔한 원인입니다.

**③ Actions 로그의 "데이터 소스"가 무엇인가요?**

| 표시 | 뜻 | 할 일 |
|---|---|---|
| `sheets-api` | 정상. 시트에서 읽었습니다 | — |
| `cache-fallback` | **시트를 못 읽었습니다.** 방금 고친 내용 반영 안 됨 | 교수님께 알리세요 (서비스 계정 키 만료·시트 공유 해제) |
| `xlsx` | 접속 정보가 없습니다 | 교수님께 알리세요 (GitHub Secrets 문제) |

**④ 경고 메시지가 있나요?**

같은 화면에 이런 줄이 보이면 그 줄이 홈페이지에서 빠진 것입니다.

```
News!20.date: 필수값 누락 — 행을 건너뜀
```

→ 시트 `News` 탭 **20행**의 `date` 칸이 비었다는 뜻입니다. 채우고 다시 실행하세요.

```
Members!7.category: 허용되지 않은 값 "박사과정" — 행을 건너뜀
```

→ 드롭다운에 없는 값을 넣었다는 뜻입니다. 목록에서 고르세요.

**⑤ 헤더(1행)를 건드리지 않았나요?**

```
Research_Topics: 코드가 모르는 헤더 "tags"
```

→ 열 이름이 바뀌었다는 뜻입니다. 원래 이름으로 되돌리세요.

### 사진이 안 나온다

드라이브 공유 설정이 **"링크가 있는 모든 사용자"** 인지 확인하세요.
비공개 파일은 오류 없이 조용히 안 나옵니다.

### Actions 에 빨간 X 가 하나 더 보인다

`pages build and deployment` 라는 이름이면 **무시해도 됩니다.** GitHub 이 자동으로 만드는
옛 방식(Jekyll) 빌드인데, 이 홈페이지는 그 방식을 쓰지 않습니다. 실제 배포는 `Deploy` 가 합니다.
`Deploy` 가 초록불이면 정상입니다.

### 실수로 시트를 망가뜨렸다

구글 시트는 **파일 → 버전 기록 → 버전 기록 보기** 에서 이전 상태로 되돌릴 수 있습니다.
당황하지 말고 되돌리세요. 홈페이지는 이전에 배포된 상태로 계속 살아 있습니다.

---

## 4. 자주 하는 작업

| 하고 싶은 것 | 방법 |
|---|---|
| 새 논문 추가 | `Publications` 탭에 행 추가 → `publish` 체크 → `order` 는 기존 최솟값보다 작게 |
| 새 구성원 추가 | `Members` 탭에 행 추가 → `category` 선택 → 사진은 드라이브 링크 |
| 졸업생으로 옮기기 | `category` 를 `Alumni` 로 바꾸고 `current_affiliation`(현 소속) 입력 |
| 과제를 완료 처리 | `Research_Projects` 의 `status` 를 `Completed` 로 |
| 소식 올리기 | `News` 탭에 행 추가 (`date` 필수) |
| 잠시 숨기기 | `publish` 체크 해제 |

> 졸업생 중 **석사·박사 학위 취득자**는 사진 카드로, **학부연구생**은 텍스트 줄로 나옵니다.
> `position` 칸에 "석사"/"박사"가 들어 있으면 카드가 됩니다.
> 학위 취득 시점은 `cohort_period` 의 **끝 날짜**를 씁니다 (예: `24.09 ~ 26.08` → 2026.08).

---

## 5. 개발자용 (코드를 고칠 때)

일반적인 내용 관리에는 필요 없습니다.

```bash
npm install          # 최초 1회
npm run serve        # http://localhost:8080 에서 미리보기
npm run build        # 홈페이지 파일 생성 (_site/)
npm run report       # 시트에서 아직 안 채운 항목 목록
```

`npm run serve` 는 **시트 변경을 감지하지 못합니다.** 로컬 파일만 감시합니다.
시트를 고쳤다면 다른 터미널에서 `npm run build` 를 한 번 실행해야 반영됩니다.

접속 정보는 `.env` 파일에 넣습니다(`.env.example` 참고). **이 파일은 절대 커밋하지 마세요.**

| 문서 | 내용 |
|---|---|
| `CLAUDE.md` | 프로젝트 전체 맥락, 설계 결정, 기술 부채 |
| `HOW_TO_BUILD.md` | 처음부터 다시 만드는 절차 |
| `design/DESIGN_SPEC.md` | 디자인 사양 |

### 구조

```
구글 시트 → (Sheets API) → Eleventy 빌드 → 정적 HTML → GitHub Pages
                  ↓ 실패하면
             data-cache/ → 그래도 없으면 → eplab_website_content.xlsx
```

시트를 못 읽어도 **빌드는 절대 실패하지 않습니다.** 옛 사본으로라도 홈페이지를 만듭니다.
대신 Actions 로그에 어느 것을 썼는지 남습니다(위 3번 ③).

---

## 도움이 필요하면

- 시트 사용법: 이 문서 1번
- 반영이 안 될 때: 이 문서 3번
- 그래도 안 되면 교수님(parksh@dgu.ac.kr)께 **Actions 로그 화면을 캡처해서** 문의하세요.
