import { useState } from 'react'
import { LifeBuoy, Send } from 'lucide-react'
import { Modal, Button, Field, Input, Textarea } from '../ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  isSupportConfigured,
  isContactConfigured,
  submitSupportTicket,
  supportMailto,
} from '../lib/support'

// ============================================================
//  客服掣（浮動）+ 聯絡表單
//  ------------------------------------------------------------
//  即裝即用：登入用戶 → support Edge Function（存 ticket + email 客服）；
//  未接 Supabase / 未登入 → mailto fallback。
//  若已設 Crisp（即時聊天）→ 讓位畀 Crisp 自己嘅 bubble，唔重複出掣。
// ============================================================

export default function SupportButton() {
  const { user } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (isSupportConfigured) return null // 有 Crisp → 用 Crisp bubble

  async function submit() {
    const s = subject.trim()
    const m = message.trim()
    if (!s || !m) {
      toast.error('請填寫主題同內容')
      return
    }
    if (isContactConfigured && user) {
      try {
        setBusy(true)
        await submitSupportTicket(s, m)
        toast.success('已收到你嘅查詢，我哋會盡快回覆 🙏')
        setOpen(false)
        setSubject('')
        setMessage('')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '提交失敗')
      } finally {
        setBusy(false)
      }
    } else {
      // 未登入 / 未接雲端 → 用 email
      window.location.href = supportMailto(s, m)
      setOpen(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="聯絡客服"
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-lg transition hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <LifeBuoy size={22} strokeWidth={1.75} />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="聯絡客服" size="md">
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
      </Modal>
    </>
  )
}
