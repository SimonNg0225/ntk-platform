import { Sparkles, Command, Cloud, BookOpen, Briefcase, Database } from 'lucide-react'
import { Modal, Button } from '../ui'

// ============================================================
//  首次使用導覽（onboarding）—— 簡短介紹平台 + 一鍵載入示範資料。
//  純 UI；載入示範資料嘅實際動作由 onLoadDemo（接 seedAllDemo）傳入。
// ============================================================

const HIGHLIGHTS: { icon: typeof Sparkles; title: string; desc: string }[] = [
  { icon: BookOpen, title: '個人模式', desc: '筆記、目標、習慣、日誌、閱讀、健康、健身 —— 打理生活同成長。' },
  { icon: Briefcase, title: '工作模式', desc: '備課、題庫、成績、點名、家長溝通、會議、收支 —— 教學效能。' },
  { icon: Command, title: '⌘K 指令面板', desc: '隨時撳 ⌘K（或 Ctrl+K）快速跳去任何功能、切換模式。' },
  { icon: Cloud, title: '雲端 + AI', desc: '登入後資料同步到你自己嘅 Supabase；AI 助手接 Gemini。' },
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
    <Modal open={open} onClose={onClose} title="歡迎用 NTK Platform" size="lg">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white shadow-sm">
            N
          </span>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            一個平台，兩個模式 —— <strong className="font-semibold text-slate-800 dark:text-slate-100">個人</strong> 同{' '}
            <strong className="font-semibold text-slate-800 dark:text-slate-100">工作</strong>。
            左上角一撳切換，主題同功能會跟住變。資料存喺你部機，登入先會雲端同步。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {HIGHLIGHTS.map((h) => {
            const I = h.icon
            return (
              <div
                key={h.title}
                className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                  <I size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{h.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {h.desc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/50">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            想即刻睇下個 app 點運作？載入一份示範資料（隨時可喺設定清除）。
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
