import { useEffect, useRef, useState } from 'react'
import { Download, Share, Plus, X } from 'lucide-react'

// ──────────────────────────────────────────────────────────────
//  PWA 安裝提示
//  - 只喺「未安裝」（唔係 standalone）先顯示；裝咗 / 喺 app 入面用 → 唔出。
//  - Android / 桌面 Chromium：捕捉 beforeinstallprompt → 原生「安裝」掣。
//  - iOS Safari：冇 beforeinstallprompt，改出手動指引（分享 → 加到主畫面）。
//  - 「直到加入為止」：撳「稍後」只係今次 session 收起，下次到訪再提；
//    一旦 appinstalled / 進入 standalone 就永久唔再出。
// ──────────────────────────────────────────────────────────────

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const SESSION_KEY = 'pwa-install-snoozed'

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isIOS(): boolean {
  const ua = navigator.userAgent
  return (
    /iPhone|iPad|iPod/i.test(ua) ||
    // iPadOS 13+ 報做 Mac，靠觸控點數分辨
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  )
}

export default function PwaInstallPrompt() {
  const [show, setShow] = useState(false)
  const [ios, setIos] = useState(false)
  const deferred = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (isStandalone()) return // 已經喺 app 入面用 → 唔提
    if (sessionStorage.getItem(SESSION_KEY) === '1') return // 今次 session 已收起

    const onBIP = (e: Event) => {
      e.preventDefault() // 阻止 Chrome 預設 mini-infobar，改用自家 banner
      deferred.current = e as BeforeInstallPromptEvent
      setShow(true)
    }
    const onInstalled = () => {
      setShow(false)
      deferred.current = null
    }
    window.addEventListener('beforeinstallprompt', onBIP)
    window.addEventListener('appinstalled', onInstalled)

    // iOS：冇 beforeinstallprompt，直接出手動指引
    if (isIOS()) {
      setIos(true)
      setShow(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!show) return null

  const snooze = () => {
    sessionStorage.setItem(SESSION_KEY, '1')
    setShow(false)
  }

  const install = async () => {
    const ev = deferred.current
    if (!ev) return
    await ev.prompt()
    const { outcome } = await ev.userChoice
    deferred.current = null
    if (outcome === 'accepted') setShow(false)
    else snooze() // 撳「取消」→ 今次 session 唔再煩，下次到訪再提
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+76px)] sm:pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-accent/30 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-accent/30 dark:bg-slate-800/95">
        <img
          src="/favicon.svg"
          alt="EziTeach 教學易"
          className="h-10 w-10 shrink-0 rounded-xl shadow-sm"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            安裝 EziTeach 教學易
          </p>
          {ios ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              撳底部
              <Share size={13} className="inline text-accent" />
              分享 → 揀
              <span className="inline-flex items-center gap-0.5 font-medium text-slate-600 dark:text-slate-300">
                <Plus size={12} /> 加入主畫面
              </span>
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              加到主畫面，一撳即開、似真 app 咁用
            </p>
          )}
        </div>

        {!ios && (
          <button
            onClick={install}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Download size={15} /> 安裝
          </button>
        )}
        <button
          onClick={snooze}
          aria-label="稍後"
          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
