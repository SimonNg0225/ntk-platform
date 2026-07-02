import {
  Sparkles,
  Cloud,
  Database,
  ClipboardList,
  FileText,
  TrendingUp,
  Presentation,
  PenLine,
} from 'lucide-react'
import { Modal, Button } from '../ui'
import { BRAND_NAME } from '../lib/brand'

// ============================================================
//  首次使用導覽（onboarding）—— 教師導向功能教學 + 一鍵載入示範資料。
//  以「工作模式」教學流程行先（商業化對象＝全港老師），個人模式作輔。
//  純 UI；載入示範資料嘅實際動作由 onLoadDemo（接 seedAllDemo）傳入。
// ============================================================

const HIGHLIGHTS: { icon: typeof Sparkles; title: string; desc: string }[] = [
  {
    icon: ClipboardList,
    title: '備課流程',
    desc: '由課題開始，整理教案、教學指引、課堂活動同評估方向。',
  },
  {
    icon: FileText,
    title: '教材與題目',
    desc: 'AI 出 MC／短答／長題、工作紙同評分準則，再收返入題庫。',
  },
  {
    icon: PenLine,
    title: '批改與回饋',
    desc: 'AI 先做初稿：分數、病句、評語同弱項；最後由老師覆核。',
  },
  {
    icon: Cloud,
    title: '個人先用',
    desc: '不用先開學校帳戶；資料本機優先，登入後再跨裝置同步。',
  },
]

const START_STEPS: { icon: typeof Sparkles; title: string; desc: string }[] = [
  {
    icon: ClipboardList,
    title: '揀一個課題',
    desc: '先做下一堂，不用一次設定全個學期。',
  },
  {
    icon: Presentation,
    title: '生成教材',
    desc: '教案、題目、簡報和工作紙逐步接上。',
  },
  {
    icon: TrendingUp,
    title: '課後補強',
    desc: '把弱項、評語、待辦收回工作台。',
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
    <Modal open={open} onClose={onClose} title={`歡迎使用 ${BRAND_NAME}`} size="lg">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white shadow-sm">
            E
          </span>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            為香港老師而設嘅
            <strong className="font-semibold text-slate-800 dark:text-slate-100">
              AI 工作台
            </strong>
            —— 先由一位老師自己用起，備課、出題、批改、行政慢慢收返埋一個地方。
            左上角仲可以切去
            <strong className="font-semibold text-slate-800 dark:text-slate-100">
              個人模式
            </strong>
            打理自己嘅成長。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {START_STEPS.map((h, index) => {
            const I = h.icon
            return (
              <div
                key={h.title}
                className="rounded-xl border border-accent/20 bg-accent-soft/40 p-3 dark:border-accent/25 dark:bg-accent/10"
              >
                <div className="flex items-center gap-2">
                  <span className="nums rounded-md bg-white px-1.5 py-0.5 text-[11px] font-semibold text-accent-strong dark:bg-slate-800 dark:text-accent">
                    {index + 1}
                  </span>
                  <I size={16} strokeWidth={1.75} className="text-accent" aria-hidden="true" />
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {h.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {h.desc}
                </p>
              </div>
            )
          })}
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
