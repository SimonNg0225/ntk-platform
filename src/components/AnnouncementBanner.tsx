import { useEffect, useState } from 'react'
import { X, Info, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listActiveAnnouncements, type PublicAnnouncement } from '../lib/announcements'
import { cx } from '../ui'

// ============================================================
//  全站公告橫額 — 登入用戶頂部顯示生效中嘅公告。
//  關閉狀態記喺 localStorage（按公告 id），唔會再彈。
// ============================================================

const TONE: Record<PublicAnnouncement['level'], { wrap: string; icon: typeof Info }> = {
  info: {
    wrap: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:border-blue-500/20',
    icon: Info,
  },
  warning: {
    wrap: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/20',
    icon: AlertTriangle,
  },
  success: {
    wrap: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/20',
    icon: CheckCircle2,
  },
}

const dismissKey = (id: string) => `ntk.ann.dismiss.${id}`

export default function AnnouncementBanner() {
  const { user } = useAuth()
  const [items, setItems] = useState<PublicAnnouncement[]>([])

  useEffect(() => {
    if (!user) {
      setItems([])
      return
    }
    let alive = true
    listActiveAnnouncements().then((rows) => {
      if (!alive) return
      const visible = rows.filter((a) => {
        try {
          return localStorage.getItem(dismissKey(a.id)) !== '1'
        } catch {
          return true
        }
      })
      setItems(visible)
    })
    return () => {
      alive = false
    }
  }, [user])

  if (items.length === 0) return null

  const dismiss = (id: string) => {
    try {
      localStorage.setItem(dismissKey(id), '1')
    } catch {
      /* ignore */
    }
    setItems((cur) => cur.filter((a) => a.id !== id))
  }

  return (
    <div className="space-y-px">
      {items.map((a) => {
        const tone = TONE[a.level] ?? TONE.info
        const I = tone.icon
        return (
          <div
            key={a.id}
            className={cx('flex items-start gap-2.5 border-b px-4 py-2.5 text-sm sm:px-8', tone.wrap)}
          >
            <I size={16} className="mt-0.5 shrink-0" strokeWidth={2} />
            <div className="min-w-0 flex-1">
              <span className="font-semibold">{a.title}</span>
              {a.body && <span className="ml-2 opacity-90">{a.body}</span>}
            </div>
            <button
              onClick={() => dismiss(a.id)}
              aria-label="關閉公告"
              className="shrink-0 rounded p-0.5 opacity-60 transition hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-current/40"
            >
              <X size={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
