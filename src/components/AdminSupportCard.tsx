import { useEffect, useState } from 'react'
import { Inbox, RefreshCw, Check, RotateCcw } from 'lucide-react'
import { Card, SectionTitle, Badge, Button, EmptyState, cx } from '../ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  adminListTickets,
  adminSetTicketStatus,
  type SupportTicket,
} from '../lib/support'

// ============================================================
//  客服收件箱（管理員）— 只喺 admin（VITE_ADMIN_EMAILS）顯示。
//  真正權限由 support-admin Edge Function 用 ADMIN_EMAILS 驗。
// ============================================================

export default function AdminSupportCard() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const reload = () => {
    setLoading(true)
    adminListTickets()
      .then(setTickets)
      .catch((e) => toast.error(e instanceof Error ? e.message : '載入失敗'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (isAdmin) reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  if (!isAdmin) return null

  async function setStatus(t: SupportTicket, status: 'open' | 'closed') {
    try {
      setBusyId(t.id)
      await adminSetTicketStatus(t.id, status)
      setTickets((cur) =>
        cur.map((x) => (x.id === t.id ? { ...x, status } : x)),
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '更新失敗')
    } finally {
      setBusyId(null)
    }
  }

  const open = tickets.filter((t) => t.status !== 'closed').length

  return (
    <Card className="p-5">
      <SectionTitle
        right={
          <button
            onClick={reload}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-accent"
          >
            <RefreshCw size={13} className={cx(loading && 'animate-spin')} /> 重新整理
          </button>
        }
      >
        <span className="inline-flex items-center gap-1.5">
          <Inbox size={16} /> 客服收件箱
          {open > 0 && <Badge tone="amber">{open} 待處理</Badge>}
        </span>
      </SectionTitle>
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        管理員專用 · 顯示全部用戶查詢。
      </p>

      {loading && tickets.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">載入中…</p>
      ) : tickets.length === 0 ? (
        <EmptyState icon="📭" title="暫時未有查詢。" />
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li
              key={t.id}
              className="rounded-xl border border-[color:var(--border)] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {t.subject}
                    </span>
                    <Badge tone={t.status === 'closed' ? 'green' : 'amber'}>
                      {t.status === 'closed' ? '已處理' : '待處理'}
                    </Badge>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">
                    {t.message}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {t.email ?? '（無 email）'} ·{' '}
                    <span className="tabular-nums">
                      {new Date(t.created_at).toLocaleString('zh-HK')}
                    </span>
                  </p>
                </div>
                {t.status === 'closed' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={RotateCcw}
                    disabled={busyId === t.id}
                    onClick={() => setStatus(t, 'open')}
                  >
                    重開
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Check}
                    disabled={busyId === t.id}
                    onClick={() => setStatus(t, 'closed')}
                  >
                    標記處理
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
