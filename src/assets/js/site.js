/**
 * eP Lab — 인터랙션 (support.js / DCLogic 대체).
 *
 * 원본 SPA 의 동작 중 정적 페이지에 필요한 것만 옮겼다 (DESIGN_SPEC §6):
 *   1. News "지난 News" · Talks "이전 Talks" 토글
 *   2. Gallery 페이지네이션(8개/페이지) + 항목별 사진 캐러셀
 *
 * 네비 드롭다운은 CSS :hover 로 처리하므로 여기 없다.
 *
 * 원칙(점진적 향상): JS 가 없거나 실패해도 콘텐츠는 전부 DOM 에 있고 읽을 수 있다.
 * 그래서 '접기'는 서버 마크업이 아니라 이 스크립트가 시작할 때 수행한다.
 */
(() => {
  'use strict';

  // ── 1. 토글 (지난 News / 이전 Talks) ───────────────────────────────────
  document.querySelectorAll('[data-toggle]').forEach((btn) => {
    const panel = document.getElementById(btn.dataset.toggle);
    if (!panel) return;

    // JS 가 있을 때만 접는다. 없으면 펼쳐진 채로 남아 내용이 보인다.
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', panel.id);
    btn.textContent = btn.dataset.labelShow;

    btn.addEventListener('click', () => {
      const open = panel.hidden;
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? btn.dataset.labelHide : btn.dataset.labelShow;
    });
  });

  // ── 2. Gallery ─────────────────────────────────────────────────────────
  document.querySelectorAll('[data-gallery]').forEach((gallery) => {
    const pages = [...gallery.querySelectorAll('[data-gallery-page]')];
    const label = gallery.querySelector('[data-gallery-label]');
    let page = 0;

    const showPage = (n) => {
      page = (n + pages.length) % pages.length; // 원본과 같이 양끝에서 순환
      pages.forEach((p, i) => { p.hidden = i !== page; });
      if (label) label.textContent = `${page + 1} / ${pages.length}`;
    };

    gallery.querySelector('[data-gallery-prev]')?.addEventListener('click', () => showPage(page - 1));
    gallery.querySelector('[data-gallery-next]')?.addEventListener('click', () => showPage(page + 1));
    // 서버 마크업은 모든 페이지를 펼쳐 보낸다. 첫 페이지만 남기는 건 여기서 한다.
    showPage(0);

    // 항목별 사진 캐러셀. 사진 URL 이 아직 없으면 "[ PHOTO n / N ]" 라벨만 돈다.
    gallery.querySelectorAll('.gal').forEach((item) => {
      const shots = Number(item.dataset.shots) || 1;
      if (shots < 2) return;

      const imgs = [...item.querySelectorAll('[data-shot]')];
      const shotLabel = item.querySelector('[data-shot-label]');
      let idx = 0;

      const show = (n) => {
        idx = (n + shots) % shots;
        imgs.forEach((img, i) => { img.hidden = i !== idx; });
        if (shotLabel) shotLabel.textContent = `[ PHOTO ${idx + 1} / ${shots} ]`;
      };

      item.querySelector('[data-shot-prev]')?.addEventListener('click', () => show(idx - 1));
      item.querySelector('[data-shot-next]')?.addEventListener('click', () => show(idx + 1));
    });
  });
})();
