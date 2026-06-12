import { useRef, useState } from 'react'
import { Upload, Link2, FileCheck2, Send } from 'lucide-react'
import { Button, Field, Input, Modal, SegmentedControl, Select, Textarea, cx } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { SUBJECT_PACKS } from '../../../data/subjects'
import { TYPE_LABEL, TYPE_ORDER } from '../resourceLibrary/util'
import { isCommunityConfigured, publishResource, type CommunityResourceType } from '../../../lib/community'
import { validateFile, validatePublish, type ResourceLicense } from './util'

const GRADES = ['小一至小三', '小四至小六', '中一', '中二', '中三', '中四', '中五', '中六']

export default function PublishForm({
  open,
  onClose,
  onPublished,
}: {
  open: boolean
  onClose: () => void
  onPublished?: () => void
}) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<CommunityResourceType>('handout')
  const [subjectPackId, setSubjectPackId] = useState('')
  const [grade, setGrade] = useState('')
  const [mode, setMode] = useState<'file' | 'link'>('file')
  const [file, setFile] = useState<File | null>(null)
  const [externalUrl, setExternalUrl] = useState('')
  const [tagsStr, setTagsStr] = useState('')
  const [license, setLicense] = useState<ResourceLicense>('original')
  const [busy, setBusy] = useState(false)

  function reset() {
    setTitle(''); setDescription(''); setType('handout'); setSubjectPackId(''); setGrade('')
    setMode('file'); setFile(null); setExternalUrl(''); setTagsStr(''); setLicense('original')
  }

  function pickFile(f: File | null) {
    if (!f) { setFile(null); return }
    const v = validateFile(f)
    if (!v.ok) { toast.error(v.error ?? '檔案唔合格'); return }
    setFile(f)
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }

  const tags = tagsStr.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean).slice(0, 12)

  async function submit() {
    const v = validatePublish({
      title, type, license, tags,
      hasFile: mode === 'file' && !!file,
      externalUrl: mode === 'link' ? externalUrl : undefined,
    })
    if (!v.ok) { toast.error(v.error ?? '請檢查表單'); return }
    if (!isCommunityConfigured) {
      toast.error('示範模式：接 Supabase + 登入後先發佈到。')
      return
    }
    try {
      setBusy(true)
      await publishResource({
        title, description, type, license, tags,
        subjectPackId: subjectPackId || undefined,
        grade: grade || undefined,
        hasFile: mode === 'file' && !!file,
        file: mode === 'file' ? file ?? undefined : undefined,
        fileName: file?.name,
        externalUrl: mode === 'link' ? externalUrl : undefined,
        status: 'published',
      })
      toast.success('已發佈到資源分享區 🎉')
      reset()
      onPublished?.()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '發佈失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="分享資源" size="lg">
      <div className="space-y-3.5">
        <Field label="標題" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：供求曲線互動工作紙（連答案）" maxLength={120} />
        </Field>

        <Field label="描述（選填）" hint="講下內容、用法、啱邊個程度">
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} />
        </Field>

        <Field label="類型">
          <Select value={type} onChange={(e) => setType(e.target.value as CommunityResourceType)}>
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="科目（選填）">
            <Select value={subjectPackId} onChange={(e) => setSubjectPackId(e.target.value)}>
              <option value="">通用 / 跨科</option>
              {SUBJECT_PACKS.map((p) => (
                <option key={p.id} value={p.id}>{p.short}</option>
              ))}
            </Select>
          </Field>
          <Field label="年級（選填）">
            <Select value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">不限</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </Select>
          </Field>
        </div>

        {/* 來源 */}
        <Field label="資源">
          <div className="space-y-2">
            <SegmentedControl<'file' | 'link'>
              size="sm"
              value={mode}
              onChange={setMode}
              options={[
                { id: 'file', label: '上載檔案', icon: Upload },
                { id: 'link', label: '貼連結', icon: Link2 },
              ]}
            />
            {mode === 'file' ? (
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.pptx,.docx,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className={cx(
                    'flex w-full items-center gap-2 rounded-xl border border-dashed px-3 py-3 text-sm transition',
                    file
                      ? 'border-accent/40 bg-accent-soft/40 text-accent-strong dark:text-accent'
                      : 'border-black/15 text-slate-500 hover:border-accent/40 hover:text-accent dark:border-white/15',
                  )}
                >
                  {file ? <FileCheck2 size={16} /> : <Upload size={16} />}
                  <span className="truncate">{file ? file.name : '揀檔案（PDF / PPTX / Word / 圖片，上限 25MB）'}</span>
                </button>
              </div>
            ) : (
              <Input icon={Link2} value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://…" />
            )}
          </div>
        </Field>

        <Field label="標籤（選填，逗號分隔）">
          <Input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="例：供求, 市場, 工作紙" />
        </Field>

        {/* 版權聲明 */}
        <Field label="版權聲明">
          <Select value={license} onChange={(e) => setLicense(e.target.value as ResourceLicense)}>
            <option value="original">我原創 / 有權分享呢份資源</option>
            <option value="shareable">已獲授權、可自由分享</option>
          </Select>
        </Field>
        <p className="-mt-1 text-[11px] leading-relaxed text-slate-400">
          請確認冇侵犯版權（例如出版社課本）。被檢舉成立會下架。
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button icon={Send} onClick={submit} loading={busy}>發佈</Button>
        </div>
      </div>
    </Modal>
  )
}
