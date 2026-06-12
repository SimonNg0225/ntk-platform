import { useState } from 'react'
import { Modal, Textarea, Button } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { reportContent } from './api'

export default function ReportModal({ open, onClose, targetType, targetId }: {
  open: boolean; onClose: () => void; targetType: 'thread' | 'post'; targetId: string | null
}) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!targetId) return
    try {
      setBusy(true)
      await reportContent(targetType, targetId, reason.trim())
      toast.success('已提交檢舉，多謝你'); setReason(''); onClose()
    } catch (e) { toast.error(e instanceof Error ? e.message : '提交失敗') } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="檢舉內容">
      <div className="space-y-3">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="理由（選填）：違規 / 廣告 / 攻擊性…" />
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>取消</Button><Button variant="danger" onClick={submit} disabled={busy}>提交檢舉</Button></div>
      </div>
    </Modal>
  )
}
