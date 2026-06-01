// ============================================================
//  Work 區共用 CSV 工具
//  ------------------------------------------------------------
//  同一份 CSV 轉義 + Blob 下載邏輯原本喺多個 work 模組逐字重複
//  （gradebook / budget / curriculum / attendance）。呢度抽一份，
//  行為與原實作完全一致：
//    - csvEscape：含 " , \n 先加引號，引號 double（RFC-ish）
//    - downloadCsv：BOM（令 Excel 正確讀中文）、\r\n 行尾、
//      text/csv;charset=utf-8; mime、URL.createObjectURL 觸發下載
// ============================================================

/** CSV 欄位轉義：含 `"` `,` `\n` 先加引號；內部引號 double。 */
export function csvEscape(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** 將二維陣列轉成 CSV 並觸發瀏覽器下載（含 BOM，純前端零依賴）。 */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n')
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
