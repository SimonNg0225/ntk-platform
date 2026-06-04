import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { RefreshCw, X } from 'lucide-react'

// ──────────────────────────────────────────────────────────────
//  PWA 更新提示
//  - 自己 registerSW（vite.config injectRegister:false）。
//  - 定期 + 重新聚焦時 r.update()：Safari 唔會主動頻密檢查新 SW，
//    加上 vercel.json 將 sw.js 設 no-cache，先至偵測到新部署。
//  - 偵測到新版 → onNeedRefresh → 彈 banner，用戶撳「更新」先 reload，
//    避免打字途中突然 reload 丟資料。
// ──────────────────────────────────────────────────────────────
export default function PwaUpdater() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const updateRef = useRef<((reload?: boolean) => Promise<void>) | null>(null)
  const started = useRef(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (started.current) return // StrictMode dev 會行兩次，擋住重覆 register
    started.current = true

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true)
      },
      onRegisteredSW(_swUrl, r) {
        if (!r) return
        const check = () => {
          r.update().catch(() => {})
        }
        // 每 60 秒 + 每次 tab 重新可見時檢查新版
        const id = window.setInterval(check, 60_000)
        const onVis = () => {
          if (!document.hidden) check()
        }
        document.addEventListener('visibilitychange', onVis)
        cleanupRef.current = () => {
          window.clearInterval(id)
          document.removeEventListener('visibilitychange', onVis)
        }
      },
    })
    updateRef.current = updateSW
    return () => cleanupRef.current?.()
  }, [])

  if (!needRefresh) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <div className="flex items-center gap-2 rounded-2xl border border-accent/30 bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur dark:border-accent/30 dark:bg-slate-800/95">
        <RefreshCw size={15} className="shrink-0 text-accent" />
        <span className="text-sm text-slate-700 dark:text-slate-200">有新版本可用</span>
        <button
          onClick={() => updateRef.current?.(true)}
          className="ml-1 rounded-xl bg-accent px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          更新
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          aria-label="稍後"
          className="rounded-lg p-1.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
