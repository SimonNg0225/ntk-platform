import { Sparkles } from 'lucide-react'

// ============================================================
//  QuickAddButton — 桌面右上角「快速加入」浮動觸發掣
//  ------------------------------------------------------------
//  純觸發（受控）：modal 開關由 App 統一持有（quickAddOpen），等
//  桌面浮掣 / 手機頂欄 / 指令面板 / 鍵盤捷徑 共用同一個 QuickAddModal
//  實例。色用 --accent（工作=teal / 學習=indigo），深色 OK。
//  喺 App 主內容區用 absolute 定位喺右上角，唔擋「← 返回概覽」同標題
//  （見 App.tsx 接線）。
// ============================================================

export interface QuickAddButtonProps {
  onClick: () => void
  className?: string
}

export function QuickAddButton({ onClick, className }: QuickAddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="快速加入（自然語言 → 待辦／提醒／行事曆）"
      className={
        'group inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft/80 px-3.5 py-2 text-sm font-semibold text-accent-strong shadow-sm backdrop-blur transition hover:bg-accent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98] dark:border-accent/30 dark:bg-accent/15 dark:text-accent dark:hover:bg-accent dark:hover:text-white dark:focus-visible:ring-offset-slate-900' +
        (className ? ` ${className}` : '')
      }
    >
      <Sparkles size={16} className="shrink-0" />
      <span>快速加入</span>
    </button>
  )
}

export default QuickAddButton
