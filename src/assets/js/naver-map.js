/**
 * Contact 페이지의 네이버 지도.
 *
 * 왜 iframe 이 아닌가: map.naver.com 은 `x-frame-options: DENY` 를 보낸다(2026-09-06 확인).
 * 구글 지도처럼 iframe 으로 끼워 넣을 수 없고, JavaScript API v3 를 써야 한다.
 * 그래서 **Client ID 가 있어야만** 지도가 뜬다 (NAVER Cloud Platform > Maps 에서 발급).
 *
 * 설정은 전부 컨테이너의 data-* 로 넘어온다 — 값의 출처는 구글 시트(Site_Config)이고,
 * 이 파일은 시트를 모른다. 좌표를 바꾸려고 코드를 고칠 일이 없게 하려는 것이다.
 *
 * 키가 없거나 API 로드가 실패하면 **아무것도 하지 않는다.** 컨테이너 안에 미리 넣어둔
 * 안내 문구(네이버 지도로 가는 링크)가 그대로 남는다 — 지도가 없다고 페이지가 깨지지 않는다.
 */
(() => {
  'use strict';

  const el = document.getElementById('naver-map');
  if (!el) return;

  // 스크립트 태그는 있는데 키가 잘못되면 window.naver 가 안 생긴다. 그때는 안내 문구를 남긴다.
  if (!window.naver || !window.naver.maps) return;

  const num = (name, fallback) => {
    const v = parseFloat(el.dataset[name]);
    return Number.isFinite(v) ? v : fallback;
  };

  // 기본값은 동국대 서울캠퍼스 중심. 정확한 건물 지점은 시트에서 map_lat/map_lng 로 맞춘다.
  const center = new naver.maps.LatLng(num('lat', 37.5582), num('lng', 127.0001));

  const map = new naver.maps.Map(el, {
    center,
    zoom: num('zoom', 17),
    // 요청 사항: 마우스 휠로 확대·축소.  (API 기본값이지만 의도를 남기려고 명시한다)
    scrollWheel: true,
    zoomControl: true,
    zoomControlOptions: { position: naver.maps.Position.TOP_RIGHT },
    mapDataControl: false,
  });

  const marker = new naver.maps.Marker({ position: center, map, title: el.dataset.label || '' });

  if (el.dataset.label) {
    const info = new naver.maps.InfoWindow({
      content:
        '<div style="padding:8px 12px;font-family:Consolas,Menlo,\'Malgun Gothic\',monospace;' +
        'font-size:13px;line-height:1.5;white-space:nowrap">' +
        el.dataset.label.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) +
        '</div>',
      borderWidth: 0,
      disableAnchor: false,
      backgroundColor: '#fff',
    });
    info.open(map, marker);
    naver.maps.Event.addListener(marker, 'click', () => {
      if (info.getMap()) info.close(); else info.open(map, marker);
    });
  }

  // 컨테이너가 늦게 크기를 잡는 경우(폰트 로드 등) 타일이 어긋나는 것을 막는다.
  window.addEventListener('load', () => naver.maps.Event.trigger(map, 'resize'), { once: true });
})();
