// ============================================================
//  上載資源 Modal
// ============================================================

import { useState, useRef } from 'react'
import { Upload } from 'lucide-react'
import { Modal, Button, Field, Input, Textarea, Select } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { validateUpload, fmtSize } from './logic'
import { uploadResource } from './api'
import type { SharedResource, ResourceType } from './types'

const TYPE_OPTIONS: { value: ResourceType; label: string }[] = [
  { value: 'handout', label: '講義' },
  { value: 'slides', label: '簡報' },
  { value: 'paper', label: '試題' },
  { value: 'note', label: '筆記' },
  { value: 'link', label: '連結' },
  { value: 'video', label: '影片' },
]

const FILE_TYPES = ['handout', 'slides', 'paper', 'note'] as ResourceType[]

export default function UploadModal({
  open,
  onClose,
  onUploaded,
}: {
  open: boolean
  onClose: () => void
  onUploaded: (r: SharedResource) => void
}) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<ResourceType>('handout')
  const [tags, setTags] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [externalUrl, setExternalUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')

  const isFile = FILE_TYPES.includes(type)

  const reset = () => {
    setTitle(''); setDescription(''); setType('handout')
    setTags(''); setFile(null); setExternalUrl(''); setProgress('')
  }

  const handleClose = () => { if (!uploading) { reset(); onClose() } }

  const submit = async () => {
    const err = validateUpload({ title, type, file, externalUrl })
    if (err) { toast.error(err); return }
    try {
      setUploading(true)
      setProgress('上載中…')
      const tagList = tags.split(/[、,，\s]+/).map((s) => s.trim()).filter(Boolean)
      const r = await uploadResource({
        title, description: description || undefined,
        type,
        tags: tagList,
        file: isFile ? file : null,
        externalUrl: !isFile ? externalUrl : undefined,
      })
      setProgress('完成！')
      toast.success('上載成功！')
      reset()
      onUploaded(r)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '上載失敗')
      setProgress('')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="上載教學資源" size="lg">
      <div className="space-y-4">
        <Field label="標題" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：中六數學 積分練習（2024）"
            maxLength={120}
            disabled={uploading}
          />
        </Field>

        <Field label="描述（選填）">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="簡單介紹資源內容…"
            rows={3}
            disabled={uploading}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="類型" required>
            <Select
              value={type}
              onChange={(e) => { setType(e.target.value as ResourceType); setFile(null); setExternalUrl('') }}
              disabled={uploading}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>

          <Field label="標籤（選填，逗號分隔）">
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="DSE、中六、數學"
              disabled={uploading}
            />
          </Field>
        </div>

        {isFile ? (
          <Field label="檔案" required hint="支援 PDF、PPT/PPTX、DOC/DOCX、PNG、JPG，最大 50 MB">
            <div
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 transition hover:border-accent hover:bg-accent/5 dark:border-slate-700 dark:bg-slate-800/50"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={24} className="text-slate-400" />
              {file ? (
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{file.name}</p>
                  <p className="text-xs text-slate-400">{fmtSize(file.size)}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-400">點擊選擇檔案</p>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={uploading}
              />
            </div>
          </Field>
        ) : (
          <Field label="連結 URL" required>
            <Input
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://…"
              type="url"
              disabled={uploading}
            />
          </Field>
        )}

        {progress && (
          <p className="text-center text-sm text-slate-500">{progress}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={handleClose} disabled={uploading}>取消</Button>
          <Button onClick={submit} loading={uploading} icon={Upload}>上載</Button>
        </div>
      </div>
    </Modal>
  )
}
