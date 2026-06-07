import {
  Sparkles,
  Command,
  Cloud,
  Database,
  ClipboardList,
  FileText,
  TrendingUp,
  MessagesSquare,
} from 'lucide-react'
import { Modal, Button } from '../ui'

// ============================================================
//  首次使用導覽（onboarding）—— 教師導向功能教學 + 一鍵載入示範資料。
//  以「工作模式」教學流程行先（商業化對象＝全港老師），個人模式作輔。
//  純 UI；載入示範資料嘅實際動作由 onLoadDemo（接 seedAllDemo）傳入。
// ============================================================

const HIGHLIGHTS: { icon: typeof Sparkles; title: string; desc: string }[] = [
  {
    icon: ClipboardList,
    title: '備課 · 教案 · 課程進度',
    desc: '撰寫教案、對住課程大綱追蹤每班進度，唔使再揭 Excel。',
  },
  {
    icon: FileText,
    title: '題庫 · AI 出題 · 試卷',
    desc: '輸入課題，AI 即出 MC／短答／長題，一鍵入題庫、砌成試卷。',
  },
  {
    icon: TrendingUp,
    title: '成績 · 點名 · 弱項分析',
    desc: '記分自動計平均、標出弱項；逐堂點名統計出席率。',
  },
  {
    icon: MessagesSquare,
    title: '家長溝通 · 會議 · 行政文件',
    desc: '聯絡記錄＋範本、會議筆記，Word 範本逐欄填好即印。',
  },
  {
    icon: Command,
    title: '⌘K 指令面板',
    desc: '隨時撳 ⌘K（或 Ctrl+K）秒速跳去任何功能、切換模式。',
  },
  {
    icon: Cloud,
    title: '雲端同步 · AI 助手',
    desc: '登入後多裝置同步；教學 AI 接 Gemini，未登入照用（本機）。',
  },
]

export function OnboardingModal({
  open,
  onClose,
  onLoadDemo,
}: {
  open: boolean
  onClose: () => void
  onLoadDemo: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title="歡迎使用 教學易 EziTeach" size="lg">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white shadow-sm">
            E
          </span>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            為香港老師而設嘅
            <strong className="font-semibold text-slate-800 dark:text-slate-100">
              一站式工作台
            </strong>
            —— 備課、出題、批改、成績、點名、家長溝通，全部收喺一個地方。
            下面係幾個核心功能；左上角仲可以切去
            <strong className="font-semibold text-slate-800 dark:text-slate-100">
              個人模式
            </strong>
            打理自己嘅成長。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {HIGHLIGHTS.map((h) => {
            const I = h.icon
            return (
              <div
                key={h.title}
                className="flex items-start gap-3 rounded-xl border border-[color:var(--border)] p-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                  <I size={16} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {h.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {h.desc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="rounded-xl bg-[color:var(--surface-2)] p-3 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            想即刻睇下實際運作？載入一份示範資料（隨時可喺設定清除）。
          </p>
          <div className="mt-3 flex flex-col justify-center gap-2 sm:flex-row">
            <Button icon={Database} onClick={onLoadDemo}>
              載入示範資料
            </Button>
            <Button variant="ghost" icon={Sparkles} onClick={onClose}>
              我自己由零開始
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
