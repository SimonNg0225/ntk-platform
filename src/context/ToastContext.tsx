import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

// ============================================================
//  Toast 通知系統（商用必備）
//  用法：const toast = useToast(); toast.success('已儲存')
// ============================================================

type ToastType = 'success' | 'error' | 'info'

/** 可選行動按鈕（例如「檢視」），撳咗會執行 onClick 並關閉該 toast */
export interface ToastAction {
  label: string
  onClick: () => void
}

interface Toast {
  id: number
  type: ToastType
  message: string
  action?: ToastAction
}

interface ToastApi {
  success: (msg: string, action?: ToastAction) => void
  error: (msg: string, action?: ToastAction) => void
  info: (msg: string, action?: ToastAction) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const ICON: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
}
const STYLE: Record<ToastType, string> = {
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  error:
    'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
  info: 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100',
}
const ICON_BG: Record<ToastType, string> = {
  success: 'bg-emerald-500',
  error: 'bg-rose-500',
  info: 'bg-accent',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback(
    (type: ToastType, message: string, action?: ToastAction) => {
      const id = Date.now() + Math.random()
      setToasts((t) => [...t, { id, type, message, action }])
      setTimeout(
        () => {
          setToasts((t) => t.filter((x) => x.id !== id))
        },
        // 有行動掣時畀耐少少時間畀用戶撳
        action ? 6000 : 3000,
      )
    },
    [],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, a) => push('success', m, a),
      error: (m, a) => push('error', m, a),
      info: (m, a) => push('info', m, a),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg ${STYLE[t.type]}`}
            style={{ animation: 'toastIn 0.2s ease-out' }}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${ICON_BG[t.type]}`}
            >
              {ICON[t.type]}
            </span>
            <span className="text-sm font-medium">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick()
                  setToasts((x) => x.filter((y) => y.id !== t.id))
                }}
                className="ml-auto shrink-0 rounded-md px-2 py-1 text-xs font-semibold underline underline-offset-2 transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast 必須喺 <ToastProvider> 入面用')
  return ctx
}
