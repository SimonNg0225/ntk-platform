import { useEffect, useState } from 'react'
import { Check, Loader2, SpellCheck, BrainCircuit } from 'lucide-react'
import { Badge, Button, Modal, cx } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { complete } from '../../../lib/aiClient'
import { PROOFREAD_SYSTEM, parseProofread, type ProofIssue } from './proofread'

// ============================================================
//  筆記校對 Modal — AI 列出「錯字 / 知識錯誤」，逐項或全部套用
// ============================================================

export default function ProofreadModal({
  content,
  onApply,
  onClose,
}: {
  content: string
  /** 套用後嘅完整內文 */
  onApply: (next: string) => void
  onClose: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(true)
  const [issues, setIssues] = useState<ProofIssue[] | null>(null)
  const [applied, setApplied] = useState<Set<number>>(new Set())

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const raw = await complete({
          system: PROOFREAD_SYSTEM,
          messages: [{ role: 'user', content }],
          temperature: 0.1,
          source: 'notes',
        })
        if (!alive) return
        setIssues(parseProofread(raw))
      } catch (e) {
        if (!alive) return
        toast.error((e as Error).message || '校對失敗，請再試。')
        onClose()
      } finally {
        if (alive) setBusy(false)
      }
    })()
    return () => {
      alive = false
    }
    // 只跑一次（開 modal 時）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyOne(i: number) {
    const iss = issues?.[i]
    if (!iss) return
    if (!content.includes(iss.quote)) {
      toast.info('搵唔到原文，可能已經改咗')
      return
    }
    onApply(content.replace(iss.quote, iss.suggestion))
    setApplied((p) => new Set(p).add(i))
    toast.success('已套用')
  }

  function applyAll() {
    if (!issues) return
    let next = content
    const done = new Set(applied)
    let count = 0
    issues.forEach((iss, i) => {
      if (done.has(i)) return
      if (next.includes(iss.quote)) {
        next = next.replace(iss.quote, iss.suggestion)
        done.add(i)
        count++
      }
    })
    if (count === 0) {
      toast.info('冇可套用嘅修改')
      return
    }
    onApply(next)
    setApplied(done)
    toast.success(`已套用 ${count} 項`)
  }

  const pending = issues ? issues.filter((_, i) => !applied.has(i)).length : 0

  return (
    <Modal open onClose={onClose} title="AI 校對" size="lg">
      {busy ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin text-accent" /> AI 校對緊…
        </div>
      ) : !issues || issues.length === 0 ? (
        <div className="py-10 text-center">
          <Check size={28} className="mx-auto text-emerald-500" />
          <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            冇發現明顯問題 ✅
          </p>
          <p className="mt-1 text-xs text-slate-400">錯字同知識點都睇唔出問題。</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              搵到 {issues.length} 項，{pending} 項待處理
            </p>
            {pending > 0 && (
              <Button size="sm" variant="secondary" onClick={applyAll}>
                全部套用
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {issues.map((iss, i) => {
              const done = applied.has(i)
              return (
                <div
                  key={i}
                  className={cx(
                    'rounded-xl border p-3 transition',
                    done
                      ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/5'
                      : 'border-black/[0.06] bg-slate-50/60 dark:border-white/[0.08] dark:bg-slate-800/40',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Badge tone={iss.type === 'fact' ? 'rose' : 'amber'} icon={iss.type === 'fact' ? BrainCircuit : SpellCheck}>
                      {iss.type === 'fact' ? '知識' : '錯字'}
                    </Badge>
                    {iss.note && (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">{iss.note}</span>
                    )}
                    <div className="ml-auto">
                      {done ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <Check size={13} /> 已套用
                        </span>
                      ) : (
                        <Button size="sm" onClick={() => applyOne(i)}>
                          套用
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-sm">
                    <span className="rounded bg-rose-100 px-1 text-rose-700 line-through dark:bg-rose-500/15 dark:text-rose-300">
                      {iss.quote}
                    </span>
                    <span className="mx-1.5 text-slate-300">→</span>
                    <span className="rounded bg-emerald-100 px-1 font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      {iss.suggestion}
                    </span>
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Modal>
  )
}
