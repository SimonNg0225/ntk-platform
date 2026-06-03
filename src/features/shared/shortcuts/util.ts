// ============================================================
//  鍵盤快捷鍵速查表 — 純資料 + 純篩選邏輯
//  ------------------------------------------------------------
//  成個 app 散落咗好多鍵盤快捷（⌘K 指令面板、全域搜尋、Inbox、資源庫、
//  Flashcards / Focus / Quiz 評分鍵…）。呢度集中成「靜態真相」嘅資料表，
//  俾全域速查 Modal（按 ? 彈出）顯示。UI 唔放呢度（保持純函式可測）。
//
//  每個快捷以 keys[]（一條一條 <Kbd>）+ desc（繁中說明）表示；
//  keys 之間嘅顯示分隔（例如 "或" / 連寫）交俾 UI，呢度淨係資料。
// ============================================================

export interface Shortcut {
  /** 逐粒按鍵 token（會逐粒砌成 <Kbd>），例如 ['⌘', 'K'] 或 ['?'] */
  keys: string[]
  /** 繁中說明（廣東話語感） */
  desc: string
}

export interface ShortcutSection {
  /** 區域標題 */
  title: string
  /** 適用範圍提示（可選），例如「喺對應頁面」 */
  scope?: string
  items: Shortcut[]
}

// ── 全部快捷（按區域分組）──────────────────────────────────
// 來源：實際 code 內嘅 keydown 處理（App.tsx / GlobalSearch / Inbox /
// flashcards.ReviewScreen / focus.TimerView / quiz.Runner）。
export const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: '全域',
    items: [
      { keys: ['⌘', 'K'], desc: '開／關指令面板（Windows 用 Ctrl + K）' },
      { keys: ['⌘', 'J'], desc: '開／關快速加入（自然語言 → 待辦／提醒／行事曆）' },
      { keys: ['?'], desc: '彈出呢個快捷鍵速查（Shift + /）' },
      { keys: ['Esc'], desc: '關閉彈窗 / 面板' },
    ],
  },
  {
    title: '全域搜尋',
    scope: '喺搜尋框聚焦時',
    items: [
      { keys: ['↑'], desc: '上一個結果' },
      { keys: ['↓'], desc: '下一個結果' },
      { keys: ['↵'], desc: '開啟選中結果' },
      { keys: ['⌘', '↵'], desc: '次要動作（例如喺新分頁開）' },
      { keys: ['⌘', '1–9'], desc: '快速跳去第 N 個結果' },
      { keys: ['Tab'], desc: '切換結果類別（Shift + Tab 倒返轉）' },
      { keys: ['Esc'], desc: '清空搜尋字 / 重設類別' },
    ],
  },
  {
    title: '收件匣 Inbox',
    scope: '喺列表（非輸入中）',
    items: [
      { keys: ['/'], desc: '聚焦搜尋框' },
      { keys: ['c'], desc: '聚焦快速擷取框' },
      { keys: ['j'], desc: '下一項（亦可用 ↓）' },
      { keys: ['k'], desc: '上一項（亦可用 ↑）' },
      { keys: ['1–6'], desc: '分類並轉換成對應類型' },
      { keys: ['e'], desc: '歸檔（亦可用 Backspace）' },
      { keys: ['p'], desc: '置頂 / 取消置頂' },
      { keys: ['x'], desc: '多選' },
      { keys: ['u'], desc: '還原已歸檔項目' },
    ],
  },
  {
    title: '知識卡 Flashcards',
    scope: '喺複習畫面',
    items: [
      { keys: ['Space'], desc: '翻面 / 顯示答案' },
      { keys: ['1'], desc: '評分：唔記得' },
      { keys: ['2'], desc: '評分：有啲難' },
      { keys: ['3'], desc: '評分：記得' },
      { keys: ['4'], desc: '評分：好易' },
      { keys: ['F'], desc: '標記呢張卡' },
      { keys: ['S'], desc: '暫停呢張卡' },
      { keys: ['Z'], desc: '撤銷上一次評分' },
    ],
  },
  {
    title: '專注計時 Focus',
    scope: '喺計時畫面',
    items: [
      { keys: ['Space'], desc: '開始 / 暫停' },
      { keys: ['R'], desc: '重設' },
      { keys: ['S'], desc: '跳過呢個階段' },
    ],
  },
  {
    title: '測驗 Quiz',
    scope: '喺答題畫面',
    items: [
      { keys: ['←'], desc: '上一題' },
      { keys: ['→'], desc: '下一題' },
      { keys: ['A–Z'], desc: '揀選擇題對應選項' },
      { keys: ['1–9'], desc: '揀第 N 個選項' },
      { keys: ['↵'], desc: '提交 / 落一題' },
      { keys: ['F'], desc: '標記呢題' },
    ],
  },
]

/** 一條快捷可供搜尋嘅文字（說明 + 全部按鍵），統一細楷 */
function haystack(s: Shortcut): string {
  return (s.desc + ' ' + s.keys.join(' ')).toLowerCase()
}

/**
 * 按查詢字篩選快捷區段：保留「標題 / scope 命中」嘅整個區段，
 * 否則只保留命中嘅 item；篩走變空嘅區段。
 * - 空白查詢：原樣回傳（包括區段同 item 次序）。
 * - 大細楷不敏感、頭尾空白略過。
 * - 純函式：唔 mutate 入參、同樣輸入永遠同樣輸出。
 */
export function filterShortcuts(
  sections: ShortcutSection[],
  query: string,
): ShortcutSection[] {
  const q = query.trim().toLowerCase()
  if (!q) return sections
  const out: ShortcutSection[] = []
  for (const sec of sections) {
    const titleHit =
      sec.title.toLowerCase().includes(q) ||
      (sec.scope ? sec.scope.toLowerCase().includes(q) : false)
    if (titleHit) {
      // 區段標題命中 → 保留全部 item
      out.push({ ...sec, items: [...sec.items] })
      continue
    }
    const items = sec.items.filter((it) => haystack(it).includes(q))
    if (items.length > 0) out.push({ ...sec, items })
  }
  return out
}

/** 速查表內快捷總數（俾 UI 顯示「共 N 個快捷」） */
export function countShortcuts(sections: ShortcutSection[]): number {
  return sections.reduce((n, s) => n + s.items.length, 0)
}
