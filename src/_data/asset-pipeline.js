/**
 * asset-pipeline.js — 시트에 적힌 **원격 이미지 URL을 빌드 시 내려받아 자체 호스팅**한다.
 * (DESIGN_SPEC §8 / HOW_TO_BUILD 7단계)
 *
 * 왜 필요한가: 지금까지는 시트의 URL을 그대로 `<img src>` 에 썼다. 그 URL은 대개
 * 구글 드라이브 직링크인데, 드라이브 핫링크는 **트래픽 제한**이 있어 방문자가 늘면
 * 사진이 간헐적으로 안 뜬다. 게다가 남의 서버에 사이트 표시를 의존하게 된다.
 *
 * 동작:
 *   1. 정규화된 데이터를 훑어 이미지 URL을 모은다 (아래 TARGETS).
 *   2. URL 해시로 파일명을 정해 `asset-cache/` 에 받아 둔다. 이미 있으면 다시 안 받는다.
 *   3. 캐시에서 출력 폴더로 복사하고, 데이터의 URL을 로컬 경로로 바꿔치기한다.
 *
 * 설계 원칙 (CLAUDE.md §8 — 빌드는 항상 성공한다):
 *   - 한 장이라도 실패하면 **그 항목만 원격 URL 그대로 둔다.** 예전처럼 핫링크로
 *     보이기라도 하고, 빌드는 계속된다. 사진 한 장 때문에 사이트가 죽지 않는다.
 *   - 네트워크가 아예 없어도(오프라인·CI 장애) 캐시에 있는 것은 그대로 쓴다.
 *
 * 출력 위치를 `_site/` 로 직접 잡은 이유: `src/assets/` 에 쓰면 `--serve` 가 그 폴더를
 * 감시하고 있어서 **빌드 → 파일 생성 → 재빌드** 무한 루프가 돈다. 감시 대상 바깥에 쓴다.
 */
import { createHash } from 'node:crypto';
import { driveDirect } from './cms-schema.js';
import { mkdir, writeFile, access, copyFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const CACHE_DIR = 'asset-cache';

/**
 * 어떤 탭의 어떤 필드가 이미지인가, 그리고 어디에 놓을 것인가.
 * `list: true` 는 문자열이 아니라 URL 배열인 필드(Gallery).
 * `dir` 은 출력 하위 폴더 — 파트너 로고는 DESIGN_SPEC §8 대로 partners/ 로 간다.
 *
 * partner_logo_url · Collaborators.logo_url 은 2026-09-02 현재 시트에 없다
 * (열/탭을 폐기했다). 되살아나면 자동으로 잡히도록 규칙만 남겨둔다 —
 * 없는 탭·필드는 그냥 건너뛴다.
 */
const TARGETS = [
  { tab: 'Members',           field: 'photo_url',        dir: 'media' },
  { tab: 'Research_Topics',   field: 'image_url',        dir: 'media' },
  { tab: 'News',              field: 'image_url',        dir: 'media' },
  { tab: 'Gallery',           field: 'image_urls',       dir: 'media', list: true },
  { tab: 'Research_Projects', field: 'partner_logo_url', dir: 'partners' },
  { tab: 'Collaborators',     field: 'logo_url',         dir: 'partners' },
];

/**
 * Site_Config 의 key 중 **값이 이미지 주소**인 것들.
 * 이름 규칙(_url 로 끝남)으로 잡으면 scholar_url 까지 내려받으므로 명시적으로 나열한다.
 * 새 이미지 설정을 추가하면 여기에도 키를 넣을 것.
 */
const CONFIG_IMAGE_KEYS = new Set(['map_url']);

/** content-type → 확장자. 드라이브 URL 에는 확장자가 없어서 응답 헤더로 정한다. */
const EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
};

const exists = (p) => access(p).then(() => true, () => false);

/** URL → 캐시 파일명. 확장자는 모르니 앞부분만 정하고, 실제 파일은 glob 으로 찾는다. */
const keyOf = (url) => createHash('sha1').update(url).digest('hex').slice(0, 16);

/**
 * 캐시에 있으면 그 파일명을, 없으면 받아서 저장하고 파일명을 돌려준다.
 * 실패하면 null — 호출부가 원격 URL 을 유지한다.
 */
async function fetchToCache(url, key, warn) {
  const cached = (await readdir(CACHE_DIR).catch(() => [])).find((f) => f.startsWith(key + '.'));
  if (cached) return cached;

  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) { warn(`${res.status} — ${url}`); return null; }

    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    const ext = EXT[type];
    // 드라이브 비공개 파일은 로그인 HTML 을 200 으로 돌려준다. 이미지가 아니면 안 받는다.
    if (!ext) { warn(`이미지가 아니라 건너뜀 (content-type: ${type || '없음'}) — ${url}`); return null; }

    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) { warn(`빈 응답 — ${url}`); return null; }

    const name = key + ext;
    await writeFile(join(CACHE_DIR, name), buf);
    return name;
  } catch (err) {
    warn(`받기 실패 (${String(err.message).split('\n')[0]}) — ${url}`);
    return null;
  }
}

/** 동시 요청 수를 제한한다. 드라이브에 한꺼번에 몰아치면 오히려 막힌다. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const n = i++;
        out[n] = await fn(items[n]);
      }
    })
  );
  return out;
}

/**
 * 이미지 URL을 전부 로컬 경로로 바꾼다. **result 를 제자리에서 수정한다.**
 *
 * @param {object} result   validateTab 을 거친 탭별 데이터
 * @param {object} opts
 * @param {string} opts.outDir  Eleventy 출력 폴더 (기본 '_site')
 * @param {(m:string)=>void} opts.warn
 * @returns {{ total:number, downloaded:number, cached:number, failed:number, skipped:boolean }}
 */
export async function localizeAssets(result, { outDir = '_site', warn = console.warn } = {}) {
  if (process.env.ASSETS === 'off') {
    warn('ASSETS=off — 이미지를 내려받지 않고 원격 URL 을 그대로 쓴다');
    return { total: 0, downloaded: 0, cached: 0, failed: 0, skipped: true };
  }

  // (url, 그 URL 을 되돌려 쓸 자리) 목록을 만든다. 같은 URL 이 여러 번 나와도 한 번만 받는다.
  const jobs = new Map(); // url → { dir, slots: [(localPath) => void] }
  const addJob = (url, dir, setter) => {
    if (!url || !/^https?:\/\//i.test(url)) return;
    if (!jobs.has(url)) jobs.set(url, { dir, slots: [] });
    jobs.get(url).slots.push(setter);
  };

  // Site_Config 는 key/value 표라 TARGETS(열 이름 기준)로는 잡을 수 없다.
  // 값이 이미지 주소인 **키만** 골라 따로 처리한다 — scholar_url 처럼 이미지가 아닌
  // URL 까지 내려받으면 안 되므로 이름 규칙이 아니라 명시적 목록을 쓴다.
  for (const row of result.Site_Config ?? []) {
    if (!CONFIG_IMAGE_KEYS.has(row.key)) continue;
    for (const field of ['value_ko', 'value_en']) {
      // Site_Config 값은 스키마상 그냥 문자열이라 'image' 타입 변환을 안 거친다.
      // 드라이브 공유 링크가 그대로 들어오므로 여기서 직접 정규화한다.
      const url = driveDirect(row[field]);
      if (!url) continue;
      row[field] = url;
      addJob(url, 'media', (local) => { row[field] = local; });
    }
  }

  for (const { tab, field, dir, list } of TARGETS) {
    for (const row of result[tab] ?? []) {
      if (list) {
        const urls = row[field];
        if (!Array.isArray(urls)) continue;
        urls.forEach((u, i) => addJob(u, dir, (local) => { urls[i] = local; }));
      } else {
        addJob(row[field], dir, (local) => { row[field] = local; });
      }
    }
  }

  if (!jobs.size) return { total: 0, downloaded: 0, cached: 0, failed: 0, skipped: false };

  await mkdir(CACHE_DIR, { recursive: true });
  const before = new Set(await readdir(CACHE_DIR).catch(() => []));

  const entries = [...jobs.entries()];
  let failed = 0;

  const results = await mapLimit(entries, 6, async ([url, job]) => {
    const name = await fetchToCache(url, keyOf(url), warn);
    if (!name) { failed++; return null; }

    const rel = `assets/${job.dir}/${name}`;
    const dest = join(outDir, rel);
    try {
      await mkdir(dirname(dest), { recursive: true });
      // 이미 같은 파일이 있으면 굳이 다시 복사하지 않는다 (증분 빌드에서 잦다).
      if (!(await exists(dest))) await copyFile(join(CACHE_DIR, name), dest);
    } catch (err) {
      warn(`출력 폴더로 복사 실패 (${String(err.message).split('\n')[0]}) — ${url}`);
      failed++;
      return null;
    }
    for (const set of job.slots) set('/' + rel);
    return name;
  });

  const downloaded = results.filter((n) => n && !before.has(n)).length;
  const ok = results.filter(Boolean).length;
  return { total: entries.length, downloaded, cached: ok - downloaded, failed, skipped: false };
}
