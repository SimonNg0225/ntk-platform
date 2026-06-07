import { useEffect, useState } from 'react'
import { LifeBuoy, Send } from 'lucide-react'
import { Modal, Button, Field, Input, Textarea, Badge, EmptyState, cx } from '../ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  isSupportConfigured,
  isContactConfigured,
  submitSupportTicket,
  supportMailto,
  listMyTickets,
  type SupportTicket,
} from '../lib/support'

// ============================================================
//  客服掣（浮動）+ 聯絡表單 + 我的查詢
//  ------------------------------------------------------------
//  即裝即用：登入用戶 → support Edge Function（存 ticket + email 客服）；
//  未接 Supabase / 未登入 → mailto fallback。有 Crisp → 讓位畀 Crisp。
// ============================================================

export default function SupportButton() {
  const { user } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'new' | 'mine'>('new')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)

  const canTrack = isContactConfigured && !!user

  useEffect(() => {
    if (!open || tab !== 'mine' || !canTrack) return
    setLoadingTickets(true)
    listMyTickets()
      .then(setTickets)
      .catch(() => {})
      .finally(() => setLoadingTickets(false))
  }, [open, tab, canTrack])

  if (isSupportConfigured) return null // 有 Crisp → 用 Crisp bubble

  async function submit() {
    const s = subject.trim()
    const m = message.trim()
    if (!s || !m) {
      toast.error('請填寫主題同內容')
      return
    }
    if (canTrack) {
      try {
        setBusy(true)
        await submitSupportTicket(s, m)
        toast.success('已收到你嘅查詢，我哋會盡快回覆 🙏')
        setSubject('')
        setMessage('')
        setTab('mine')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '提交失敗')
      } finally {
        setBusy(false)
      }
    } else {
      window.location.href = supportMailto(s, m)
      setOpen(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="聯絡客服"
        className="fixed bottom-20 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-lg transition hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 md:bottom-5"
      >
        <LifeBuoy size={22} strokeWidth={1.75} />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="客服支援" size="md">
        {canTrack && (
          <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800">
            {(['new', 'mine'] as const).map((tb) => (
              <button
                key={tb}
                onClick={() => setTab(tb)}
                className={cx(
                  'flex-1 rounded-md px-3 py-1.5 font-medium transition',
                  tab === tb
                    ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400',
                )}
              >
                {tb === 'new' ? '新查詢' : '我的查詢'}
              </button>
            ))}
          </div>
        )}

        {tab === 'new' ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              有問題或建議？留低訊息，我哋會
              {user?.email ? `以 ${user.email} ` : ''}盡快回覆。
            </p>
            <Field label="主題">
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="例如：成績匯出有問題"
              />
            </Field>
            <Field label="內容">
              <Textarea
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="詳細描述你嘅問題或建議…"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button icon={Send} onClick={submit} disabled={busy}>
                {busy ? '提交中…' : '送出'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {loadingTickets ? (
              <p className="py-6 text-center text-sm text-slate-400">載入中…</p>
            ) : tickets.length === 0 ? (
              <EmptyState icon="📭" title="仲未有查詢記錄。" />
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto">
                {tickets.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-xl border border-[color:var(--border)] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {t.subject}
                      </span>
                      <Badge tone={t.status === 'closed' ? 'green' : 'amber'}>
                        {t.status === 'closed' ? '已處理' : '待處理'}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                      {t.message}
                    </p>
                    <p className="mt-1 text-[10px] tabular-nums text-slate-400">
                      {new Date(t.created_at).toLocaleString('zh-HK')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
