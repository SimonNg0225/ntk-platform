import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'

// ============================================================
//  確認對話框系統（取代瀏覽器 confirm，統一美觀體驗）
//  用法：
//    const confirm = useConfirm()
//    if (await confirm({ title: '刪除？', tone: 'danger' })) { ... }
// ============================================================

interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  tone?: 'danger' | 'default'
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const cancelBtnRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  const confirm = useCallback<ConfirmFn>((options) => {
    // 若有未決對話框，先以 false 結算舊嗰個，避免前一個 Promise 永久 pending（孤兒）
    resolver.current?.(false)
    setOpts(options)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (result: boolean) => {
    resolver.current?.(result)
    resolver.current = null
    setOpts(null)
  }

  // 開啟時：初始焦點落「取消」、Esc 取消、Tab focus-trap；關閉還原焦點（無障礙對話框標準）
  useEffect(() => {
    if (!opts) return
    const prevActive = document.activeElement as HTMLElement | null
    cancelBtnRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close(false)
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const nodes = panel.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
      )
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      prevActive?.focus?.()
    }
    // 只跟 opts 是否存在；close 喺 render 內穩定引用，唔加入 deps 以免重跑搶焦點
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => close(false)}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="relative z-10 w-full max-w-sm rounded-t-3xl bg-white p-6 shadow-2xl focus:outline-none dark:bg-slate-800 sm:rounded-3xl"
          >
            <h3
              id={titleId}
              className="text-base font-bold text-slate-800 dark:text-slate-100"
            >
              {opts.title}
            </h3>
            {opts.message && (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {opts.message}
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <button
                ref={cancelBtnRef}
                onClick={() => close(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {opts.cancelText ?? '取消'}
              </button>
              <button
                onClick={() => close(true)}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  opts.tone === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-accent hover:bg-accent-strong'
                }`}
              >
                {opts.confirmText ?? '確定'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm 必須喺 <ConfirmProvider> 入面用')
  return ctx
}
