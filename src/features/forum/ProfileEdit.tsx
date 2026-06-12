import { useEffect, useState } from 'react'
import { Modal, Field, Input, Button } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { getMyProfile, setProfile } from './api'

export default function ProfileEdit({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved?: () => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [school, setSchool] = useState('')
  const [subjects, setSubjects] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!open) return
    getMyProfile().then((p) => {
      if (!p) return
      setName(p.display_name); setSchool(p.school ?? ''); setSubjects(p.subjects.join('、'))
    })
  }, [open])
  const save = async () => {
    if (!name.trim()) { toast.error('請輸入顯示名'); return }
    try {
      setSaving(true)
      await setProfile(name.trim(), school.trim(), subjects.split(/[、,，\s]+/).map((s) => s.trim()).filter(Boolean))
      toast.success('已儲存個人資料'); onSaved?.(); onClose()
    } catch (e) { toast.error(e instanceof Error ? e.message : '儲存失敗') } finally { setSaving(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="討論區個人資料">
      <div className="space-y-3">
        <Field label="顯示名"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：陳老師" /></Field>
        <Field label="學校（選填）"><Input value={school} onChange={(e) => setSchool(e.target.value)} /></Field>
        <Field label="任教科（選填，逗號分隔）"><Input value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="中文、BAFS" /></Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={save} disabled={saving}>{saving ? '儲存中…' : '儲存'}</Button>
        </div>
      </div>
    </Modal>
  )
}
