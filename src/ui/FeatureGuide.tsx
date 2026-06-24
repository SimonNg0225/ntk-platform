import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Lightbulb, X } from 'lucide-react'

// ============================================================
//  FeatureGuide — 統一「功能頁教學引導」
//  顯示某功能「點用」嘅 2–4 步精簡引導（序號 chip + 標題 + 一句說明）。
//  可摺疊、可「知道喇」dismiss；dismiss 狀態記 localStorage（每功能一個 key）。
//  視覺跟 dashboard 設計系統：accent chip、slate 字色、rounded-2xl 半透明邊框卡。
// ============================================================

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

const DISMISS_PREFIX = 'featureGuide.dismissed.'
const REOPEN_EVENT = 'featureGuide:reopen'

/** 清返某功能嘅 dismissed flag + 即時喺畫面重新展開該教學引導（畀 hero「點用？」掣用）。 */
export function reopenFeatureGuide(storageKey: string) {
  try {
    localStorage.removeItem(DISMISS_PREFIX + storageKey)
  } catch {
    /* localStorage 不可用就算 */
  }
  try {
    window.dispatchEvent(new CustomEvent(REOPEN_EVENT, { detail: storageKey }))
  } catch {
    /* 環境冇 window 就算 */
  }
}

export type FeatureGuideStep = {
  /** 步驟標題（一句短語） */
  title: string
  /** 一句說明，講呢步具體做咩 */
  desc: string
}

export function FeatureGuide({
  title,
  steps,
  storageKey,
}: {
  /** 卡片標題；唔傳就用預設「點用？」 */
  title?: string
  /** 2–4 步引導 */
  steps: FeatureGuideStep[]
  /** localStorage 用嘅唯一 key（每功能一個，避免互撞） */
  storageKey: string
}) {
  const { t } = useTranslation()
  const lsKey = DISMISS_PREFIX + storageKey

  // dismissed：永久收起（記 localStorage）。collapsed：暫時摺疊（唔記）。
  const [dismissed, setDismissed] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // 初次掛載先讀 localStorage（避免 SSR / 首屏不一致）。
  useEffect(() => {
    try {
      if (localStorage.getItem(lsKey) === '1') setDismissed(true)
    } catch {
      /* localStorage 不可用就照顯示 */
    }
  }, [lsKey])

  // 畀外部（如 hero 嘅「點用？」掣）叫返出嚟：清 dismissed + 展開。
  // 放喺 early-return 之前，dismissed 時組件雖然 render null，但呢個 listener 照樣生效。
  useEffect(() => {
    const onReopen = (e: Event) => {
      if ((e as CustomEvent).detail === storageKey) {
        setDismissed(false)
        setCollapsed(false)
      }
    }
    window.addEventListener(REOPEN_EVENT, onReopen)
    return () => window.removeEventListener(REOPEN_EVENT, onReopen)
  }, [storageKey])

  if (dismissed || steps.length === 0) return null

  const heading = title ?? t('featureGuide.title', { defaultValue: '點用？' })

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(lsKey, '1')
    } catch {
      /* 寫唔到就算，至少今次 session 收起咗 */
    }
  }

  return (
    <section
      aria-label={heading}
      className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          className="group flex min-w-0 flex-1 items-center gap-1.5 rounded-lg text-left text-xs font-semibold text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-300"
        >
          <Lightbulb size={13} className="shrink-0 text-accent" />
          <span className="truncate">{heading}</span>
          <ChevronDown
            size={14}
            className={cx(
              'shrink-0 text-slate-400 transition-transform duration-200',
              collapsed && '-rotate-90',
            )}
          />
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex shrink-0 items-center rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] dark:text-slate-500 dark:hover:bg-slate-800/60 dark:hover:text-slate-300"
        >
          {t('featureGuide.dismiss', { defaultValue: '知道喇' })}
          <X size={13} className="ml-1" />
        </button>
      </div>

      {!collapsed && (
        <ol className="mt-3 space-y-2.5">
          {steps.slice(0, 4).map((step, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-xs font-semibold tabular-nums text-accent-strong dark:bg-accent/15 dark:text-accent">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {step.title}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {step.desc}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/** Hero「點用？」掣：擺落 PageHero 嘅 actions，畀用戶隨時重新展開該功能嘅教學引導。 */
export function GuideHelpButton({
  storageKey,
  label,
}: {
  storageKey: string
  label?: string
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={() => reopenFeatureGuide(storageKey)}
      title={t('featureGuide.reopenHint', { defaultValue: '重新顯示功能教學' })}
      className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur-sm transition hover:bg-white/25 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
    >
      <Lightbulb size={15} />
      {label ?? t('featureGuide.reopen', { defaultValue: '點用？' })}
    </button>
  )
}
