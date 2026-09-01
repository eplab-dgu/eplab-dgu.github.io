/**
 * Eleventy 설정.
 *
 * 필터는 "표현" 로직만 담는다 — 데이터 정규화는 src/_data/cms-schema.js 의 몫이다.
 * (예: metrics 문자열을 배열로 쪼개는 건 정규화, 어느 칩을 오렌지로 칠할지는 표현)
 */
export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy('src/assets');

  /** 리스트를 key 값으로 묶어 [{ key, items }] 로. 연도별/카테고리별 그룹핑에 쓴다. */
  eleventyConfig.addFilter('groupBy', (list, key) => {
    const groups = new Map();
    for (const item of list ?? []) {
      const k = item?.[key];
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(item);
    }
    return [...groups].map(([k, items]) => ({ key: k, items }));
  });

  /** 그룹 배열을 key 기준 정렬. dir='desc' 로 최신 연도부터. */
  eleventyConfig.addFilter('sortGroups', (groups, dir = 'asc') => {
    const sorted = [...(groups ?? [])].sort((a, b) => (a.key > b.key ? 1 : a.key < b.key ? -1 : 0));
    return dir === 'desc' ? sorted.reverse() : sorted;
  });

  /** 특정 필드 값으로 거르기: {{ cms.Members | where("category", "Graduate") }} */
  eleventyConfig.addFilter('where', (list, key, value) =>
    (list ?? []).filter((item) => item?.[key] === value)
  );

  /** 조건에 맞는 항목 수. 토글 라벨의 "(24)" 같은 개수 표기에 쓴다. */
  eleventyConfig.addFilter('countWhere', (list, key, value) =>
    (list ?? []).filter((item) => item?.[key] === value).length
  );

  /** year 필드가 기준 이상/미만인 항목만. Talks 의 "최근 vs 이전" 분기용. */
  eleventyConfig.addFilter('yearFrom', (list, from) =>
    (list ?? []).filter((item) => (item?.year ?? 0) >= from)
  );
  eleventyConfig.addFilter('yearBefore', (list, before) =>
    (list ?? []).filter((item) => (item?.year ?? 0) < before)
  );

  const escapeHtml = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  /**
   * 저자 문자열에서 "S. H. Park"(뒤따르는 * / ** 포함)을 <mark> 로 감싼다.
   * 원본 decoratePub(dc.html L566–586)의 정규식을 그대로 쓴다.
   * 시트에는 순수 문자열만 들어가고 강조는 빌드 시에만 일어난다.
   *
   * 출력이 HTML 이므로 **먼저 이스케이프한 뒤** 태그를 넣는다. 시트 내용은
   * 학생이 입력하는 값이라 신뢰할 수 없다.
   */
  eleventyConfig.addFilter('highlightAuthor', (authors) =>
    escapeHtml(authors).replace(/S\.\s*H\.\s*Park\**/g, (m) => `<mark>${m}</mark>`)
  );

  /**
   * 지표 칩 강조 여부 — Q1 이거나 JCR 백분율이 10% 이하면 오렌지.
   * (DESIGN_SPEC §4-1 / 원본 decoratePub 와 동일한 규칙)
   */
  eleventyConfig.addFilter('isHotMetric', (text) => {
    const t = String(text ?? '').trim();
    if (t === 'Q1') return true;
    const jcr = t.match(/JCR\s*([\d.]+)\s*%/);
    return !!jcr && parseFloat(jcr[1]) <= 10;
  });

  /**
   * 셀 하나를 여러 줄로 나눈다. 시트에 HTML 을 넣게 하면 학생 입력이 그대로 마크업이
   * 되므로, 줄바꿈은 구분자('|')로 표현하고 렌더링은 템플릿이 한다.
   * Site_Config.about_title, Leader_CV.detail 이 같은 규칙을 쓴다.
   */
  eleventyConfig.addFilter('lines', (text, sep = '|') =>
    String(text ?? '').split(sep).map((s) => s.trim()).filter(Boolean)
  );

  /** 리스트를 n개씩 끊어 페이지 배열로. Gallery 페이지네이션(8개/페이지)에 쓴다. */
  eleventyConfig.addFilter('chunk', (list, size) => {
    const out = [];
    for (let i = 0; i < (list ?? []).length; i += size) out.push(list.slice(i, i + size));
    return out.length ? out : [[]];
  });

  return {
    dir: {
      input: 'src',
      output: '_site',
      includes: '_includes',
      data: '_data',
    },
    templateFormats: ['njk', 'md', 'html'],
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
  };
}
