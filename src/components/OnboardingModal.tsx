import {
  Sparkles,
  Database,
  ClipboardList,
  FileText,
  PenLine,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { Modal, Button } from '../ui'
import { BRAND_NAME } from '../lib/brand'

// ============================================================
//  首次使用導覽（onboarding）—— 教師導向功能教學 + 一鍵載入示範資料。
//  以「工作模式」教學流程行先（商業化對象＝全港老師），個人模式作輔。
//  純 UI；載入示範資料嘅實際動作由 onLoadDemo（接 seedAllDemo）傳入。
// ============================================================

const TRUST_POINTS: { icon: typeof Sparkles; title: string; desc: string }[] = [
  {
    icon: UserRound,
    title: '個人先用',
    desc: '不用先開學校或科組帳戶，一位老師都可以即刻開始。',
  },
  {
    icon: ShieldCheck,
    title: '私隱先行',
    desc: '先處理課題、教案、教材；避免輸入可識別學生資料。',
  },
  {
    icon: PenLine,
    title: '教師覆核',
    desc: 'AI 幫你出初稿，教學判斷同最後版本仍然由老師決定。',
  },
]

const START_STEPS: { icon: typeof Sparkles; title: string; desc: string }[] = [
  {
    icon: ClipboardList,
    title: '輸入下一堂課題',
    desc: '例如「市場營銷」或「成本概念」，不用先設定全個學期。',
  },
  {
    icon: FileText,
    title: '揀一個任務包',
    desc: '教案、小測、簡報或課後回饋，先做最急嗰一件。',
  },
  {
    icon: PenLine,
    title: '用 AI 初稿起步',
    desc: '結果會接到對應工具，之後再整理到 Inbox 或功能庫。',
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
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-100">
              先由下一堂課開始
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              不用先理解全部功能；輸入一個課題，揀一個任務包，再逐步把備課、
              出題、簡報同回饋收回同一個工作台。
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button icon={ClipboardList} onClick={onClose}>
                開始準備下一堂
              </Button>
              <Button variant="secondary" icon={Database} onClick={onLoadDemo}>
                載入試用資料
              </Button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              試用資料日後可在設定清除。
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
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

        <div className="grid gap-2 sm:grid-cols-3">
          {TRUST_POINTS.map((h) => {
            const I = h.icon
            return (
              <div
                key={h.title}
                className="rounded-xl border border-[color:var(--border)] p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                    <I size={16} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {h.title}
                  </p>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {h.desc}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
