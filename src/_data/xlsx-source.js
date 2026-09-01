/**
 * xlsx-source.js — 로컬 xlsx 원시 로더. **이 프로젝트의 유일한 xlsx 파서다.**
 *
 * 왜 한 곳에 모았는가:
 *   예전에는 빌드(cms.js, SheetJS)와 캐시 덤프(scripts/xlsx-to-json.js, fflate 자체 파싱)가
 *   같은 파일을 **서로 다른 파서로** 읽었다. 두 결과가 갈라지는 지점이 하필 폴백이라,
 *   평소 빌드는 멀쩡하고 Sheets API 가 죽은 날에만 다른 값이 배포되는 실패가 가능했다.
 *   (CLAUDE.md §11 에 기록했던 기술 부채 — 이 모듈로 해소)
 *
 * 반환 형태는 sheets-source.js 의 loadFromSheetsApi() 와 **일부러 동일**하다:
 *   { presentTabs: string[], data: { [tab]: { headers, rows } } }
 * 덕분에 cms.js 는 소스를 바꿔도 조립 로직을 건드리지 않는다.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const XLSX_PATH = join(ROOT, 'eplab_website_content.xlsx');

/**
 * 2차원 배열 → 헤더 **이름** 매핑 객체 배열. 열 순서에 의존하지 않는다.
 *
 * headers 를 rows 와 함께 돌려주는 이유: 조용히 사라진 열을 탐지하려면
 * "실제로 시트에 있던 헤더 목록"이 필요하다. rows 만 봐서는 알 수 없다.
 */
export function gridToObjects(grid) {
  if (!grid || grid.length === 0) return { headers: [], rows: [] };

  const headerRow = (grid[0] ?? []).map((h) => String(h ?? '').trim());
  const headers = headerRow.filter(Boolean);

  const rows = grid.slice(1).flatMap((row) => {
    const obj = {};
    let hasValue = false;
    headerRow.forEach((header, i) => {
      if (!header) return; // 헤더 없는 열은 무시
      const cell = String(row?.[i] ?? '').trim();
      obj[header] = cell;
      if (cell) hasValue = true;
    });
    return hasValue ? [obj] : []; // 완전히 빈 행은 버린다
  });

  return { headers, rows };
}

/**
 * xlsx 를 읽어 탭별 원시 행을 돌려준다. **throw 하지 않는다** — 파일이 없거나
 * 깨져도 빈 데이터를 돌려주고, 부르는 쪽이 빌드를 계속한다.
 *
 * @param {(msg: string) => void} warn 경고 출력 방법 (빌드/스크립트가 다르게 찍는다)
 * @returns {{ ok: boolean, presentTabs: string[], data: object }}
 */
export function loadFromXlsx(warn = console.warn) {
  if (!existsSync(XLSX_PATH)) {
    warn(`${XLSX_PATH} 없음 — 빈 데이터로 처리`);
    return { ok: false, presentTabs: [], data: {} };
  }

  try {
    // cellDates:false + raw:false → 모든 셀을 "화면에 보이는 그대로의 문자열"로 받는다.
    // 시트에서 오는 값과 형태를 맞춰야("2026.03" 이 날짜 시리얼로 뒤바뀌지 않도록)
    // 나중에 Sheets API 로 바꿔도 파싱 결과가 같다.
    const wb = XLSX.read(readFileSync(XLSX_PATH), { type: 'buffer', cellDates: false });
    const data = {};

    for (const name of wb.SheetNames) {
      const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], {
        header: 1, // 2차원 배열로 받아 헤더 매핑을 직접 한다
        raw: false,
        defval: '',
        blankrows: false,
      });
      data[name] = gridToObjects(grid);
    }

    return { ok: true, presentTabs: wb.SheetNames, data };
  } catch (err) {
    warn(`xlsx 읽기 실패: ${err.message} — 빈 데이터로 처리`);
    return { ok: false, presentTabs: [], data: {} };
  }
}
