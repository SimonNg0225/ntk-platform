import { useCallback, useEffect } from 'react'
import {
  CalendarCheck2,
  CloudOff,
  Copy,
  ExternalLink,
  LogIn,
  RefreshCw,
  Smartphone,
  X,
} from 'lucide-react'
import { Button, IconButton, Modal } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { useAuth } from '../../../context/AuthContext'
import { useCollection } from '../../../lib/store'
import { calendarFeedCol } from '../../../data/collections'
import {
  buildWebcalUrl,
  buildHttpsUrl,
  getOrCreateToken,
  rotateToken,
  FEED_TOKEN_ID,
} from './calendarFeed'

// ============================================================
//  訂閱到手機日曆 —— 顯示 webcal:// 連結，iPhone/iPad 點一下即訂閱，
//  之後 Apple 日曆自動同步 + 到時間原生彈提醒（靠 .ics feed 嘅 VALARM）。
//  · 未接 Supabase / 未登入 → 友善提示（feed 要雲端 + 登入先有意義）。
//  · token 由 crypto 生成、存 calendarFeedCol（sync 上 Supabase 畀 feed
//    function 反查）；可「重新產生」即時失效舊連結。
//  詳見 docs/superpowers/specs/2026-06-04-calendar-feed-reminders-design.md
// ============================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined

// ───────── 自管「週記」頁眉（teal kicker + serif 標題 + 雙線分隔）─────────
function Masthead({ onClose }: { onClose: () => void }) {
  return (
    <header className="-mx-5 -mt-5 mb-5 px-5 pt-5 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
            <Smartphone size={12} className="shrink-0" />
            隨身提醒 · Subscribe
          </p>
          <h2 className="mt-1 font-serif text-[22px] font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100 sm:text-[26px]">
            訂閱到手機日曆
          </h2>
        </div>
        <IconButton label="關閉" onClick={onClose} className="-mr-1 shrink-0">
          <X size={18} />
        </IconButton>
      </div>
      <div className="mt-4 space-y-1" aria-hidden>
        <span className="block h-px bg-slate-200/90 dark:bg-slate-700/70" />
        <span className="block h-px bg-slate-200/60 dark:bg-slate-700/40" />
      </div>
    </header>
  )
}

// ───────── 步驟列（編號圓點 + 文字）─────────
function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((node, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold tabular-nums text-accent-strong dark:bg-accent/15 dark:text-accent">
            {i + 1}
          </span>
          <span className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {node}
          </span>
        </li>
      ))}
    </ol>
  )
}

// ───────── 友善提示卡（未接雲端 / 未登入共用）─────────
function GuardCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof CloudOff
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-5 text-center dark:border-slate-600 dark:bg-slate-800/40">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-xs dark:bg-slate-800 dark:text-slate-500">
        <Icon size={24} strokeWidth={1.75} />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {title}
      </p>
      <div className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {children}
      </div>
    </div>
  )
}

export default function CalendarSubscribe({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const { user, configured, signInWithGoogle } = useAuth()

  // 訂閱 collection：生成 / rotate 後即時 re-render（連結跟住更新）。
  const feedRows = useCollection(calendarFeedCol)

  const ready = configured && !!user

  // 由 subscribed collection 直接讀 token（render 唔寫 store）。
  const token = feedRows.find((r) => r.id === FEED_TOKEN_ID)?.token ?? null

  // 「可用」（已接雲端 + 已登入）但未有 token → 生成一個（喺 effect 寫，唔喺
  // render 期間 mutate store）。生成後 collection 變 → 重 render → 顯示連結。
  useEffect(() => {
    if (ready && !token) getOrCreateToken()
  }, [ready, token])

  const webcalUrl = token ? buildWebcalUrl(SUPABASE_URL, token) : null
  const httpsUrl = token ? buildHttpsUrl(SUPABASE_URL, token) : null

  const copyLink = useCallback(
    (text: string) => {
      try {
        const p = navigator.clipboard?.writeText(text)
        // writeText 回 Promise；async 失敗（權限／非安全內容）唔會行 sync catch，
        // 要顯式接住 rejection，先唔會誤報「已複製」。
        if (p) {
          p.then(
            () => toast.success('已複製連結'),
            () => toast.error('複製失敗，請長按連結手動複製'),
          )
        } else {
          toast.error('複製失敗，請長按連結手動複製')
        }
      } catch {
        toast.error('複製失敗，請長按連結手動複製')
      }
    },
    [toast],
  )

  async function handleRotate() {
    const ok = await confirm({
      title: '重新產生連結？',
      message:
        '舊連結會即時失效。已經喺手機／iPad 訂閱咗嘅，要刪除舊訂閱再用新連結重新訂閱。',
      confirmText: '重新產生',
      tone: 'danger',
    })
    if (!ok) return
    rotateToken()
    toast.success('已產生新連結，舊連結已失效')
  }

  return (
    // 唔傳 title → 自管「週記」masthead，令彈窗用返主畫面 serif + kicker + 雙線語言
    <Modal open onClose={onClose} size="md">
      <Masthead onClose={onClose} />

      {/* ───────── 狀態 1：未接 Supabase ───────── */}
      {!configured ? (
        <GuardCard icon={CloudOff} title="需要連接雲端先可以訂閱">
          訂閱式日曆要靠雲端 feed，手機／iPad 先可以定時同步同原生彈提醒。
          呢部裝置暫時未接雲端，可以先用行事曆頁嘅「匯出 .ics」一次過匯入。
        </GuardCard>
      ) : !user ? (
        /* ───────── 狀態 2：已接雲端但未登入 ───────── */
        <GuardCard icon={LogIn} title="登入後就可以訂閱">
          <p>
            登入之後會有一條專屬連結，手機／iPad 訂閱一次，
            行事曆同重要日子就會自動同步、到時間原生提你。
          </p>
          <div className="mt-4 flex justify-center">
            <Button icon={LogIn} onClick={() => void signInWithGoogle()}>
              用 Google 登入
            </Button>
          </div>
        </GuardCard>
      ) : !webcalUrl ? (
        /* ───────── 狀態 3：已登入但 URL 拆唔到（理論上罕見）───────── */
        <GuardCard icon={CloudOff} title="連結暫時組唔到">
          讀唔到雲端網址設定（VITE_SUPABASE_URL）。請確認部署設定後再試。
        </GuardCard>
      ) : (
        /* ───────── 狀態 4：可訂閱 —— 顯示連結 + 步驟 + 重新產生 ───────── */
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            喺 iPhone／iPad 點一下下面嘅連結就可以訂閱。之後行事曆事件同重要日子
            會自動同步入 Apple 日曆，到時間用<span className="font-medium text-slate-600 dark:text-slate-300">原生提醒</span>通知你。
          </p>

          {/* 連結卡：可點（webcal://）+ 複製 */}
          <div className="rounded-2xl border border-accent/30 bg-accent-soft/50 p-4 dark:border-accent/30 dark:bg-accent/10">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-accent-strong/80 dark:text-accent">
              <CalendarCheck2 size={13} /> 你的訂閱連結
            </p>
            <a
              href={webcalUrl}
              className="mt-2 block break-all rounded-lg bg-white/80 px-3 py-2 font-mono text-xs leading-relaxed text-slate-700 underline decoration-accent/40 underline-offset-2 transition hover:decoration-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:bg-slate-900/40 dark:text-slate-200"
            >
              {webcalUrl}
            </a>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                icon={Copy}
                onClick={() => copyLink(httpsUrl ?? webcalUrl)}
              >
                複製連結
              </Button>
              <a
                href={webcalUrl}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:shadow-none dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-900"
              >
                在 Apple 裝置開啟
                <ExternalLink size={16} strokeWidth={2} />
              </a>
            </div>
          </div>

          {/* 步驟 */}
          <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800/40">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              喺 iPhone／iPad 訂閱
            </p>
            <Steps
              items={[
                <>喺 iPhone／iPad 上<span className="font-medium text-slate-700 dark:text-slate-200">點一下上面個連結</span> → 跳出「訂閱日曆」→ 撳「訂閱」。</>,
                <>
                  或手動：開<span className="font-medium text-slate-700 dark:text-slate-200">「設定」→「日曆」→「帳戶」→「加入帳戶」→「加入已訂閱的日曆」</span>，貼上連結。
                </>,
                <>訂閱完，到時間 Apple 日曆就會自動彈原生提醒（提前幾耐跟你喺事件設定嘅提醒）。</>,
              ]}
            />
          </div>

          {/* 重新產生 + 安全提示 */}
          <div className="space-y-3 border-t border-slate-200/70 pt-4 dark:border-slate-700/60">
            <p className="text-xs leading-relaxed text-slate-400 dark:text-slate-500">
              連結唯讀、只曝露你自己嘅事件標題同時間。覺得連結外洩咗，
              可以隨時重新產生 —— 舊連結會即時失效。
            </p>
            <div className="flex justify-end">
              <Button variant="ghost" icon={RefreshCw} onClick={handleRotate}>
                重新產生連結
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
