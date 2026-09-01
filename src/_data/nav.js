/**
 * 사이트 내비게이션 구조.
 *
 * 시트가 아니라 **코드에 둔다** (DESIGN_SPEC §4: "nav — 고정 구조, 시트化 불필요").
 * 메뉴 하나가 늘면 템플릿 파일도 하나 늘어야 하므로, 학생이 시트에서 바꿀 수 있게
 * 하면 링크만 있고 페이지는 없는 상태가 만들어진다.
 *
 * 원본 dc.html 의 `nav` 배열(L594–606)을 해시 라우트 → 실제 경로로 옮긴 것.
 *   match: 현재 URL 이 이 접두사로 시작하면 상위 메뉴를 오렌지로 활성 표시.
 *          (빌드 타임 판정 — 런타임 JS 불필요)
 */
export default [
  { label: 'Home', href: '/', match: '/', exact: true, children: [] },
  {
    label: 'Team', href: '/team/leader/', match: '/team/',
    children: [
      { label: 'Leader', href: '/team/leader/' },
      { label: 'Researchers', href: '/team/researchers/' },
    ],
  },
  {
    label: 'Research', href: '/research/topics/', match: '/research/',
    children: [
      { label: 'Research Topics', href: '/research/topics/' },
      { label: 'Research Projects', href: '/research/projects/' },
    ],
  },
  {
    label: 'Achievements', href: '/achievements/publications/', match: '/achievements/',
    children: [
      { label: 'Publications', href: '/achievements/publications/' },
      { label: 'Conferences', href: '/achievements/conferences/' },
      { label: 'Patents', href: '/achievements/patents/' },
      { label: 'Invited Talks', href: '/achievements/invited-talks/' },
    ],
  },
  { label: 'Teaching', href: '/teaching/', match: '/teaching/', children: [] },
  { label: 'News', href: '/news/', match: '/news/', children: [] },
  { label: 'Contact', href: '/contact/', match: '/contact/', children: [] },
];
