import { useMemo, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  ExternalLink,
  FolderInput,
  Link2Off,
  Save,
  Star,
  Tag as TagIcon,
  Trash2,
} from 'lucide-react'
import { useCollection } from '../../../lib/store'
import { resourcesCol, topicsCol } from '../../../data/collections'
import type { ResourceType } from '../../../data/types'
import {
  Badge,
  Button,
  Field,
  IconButton,
  Input,
  Modal,
  Select,
  Separator,
  Textarea,
  Tooltip,
  cx,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import {
  TYPE_LABEL,
  TYPE_ORDER,
  domainOf,
  guessTypeFromUrl,
  logOpen,
  relativeDate,
  resourceFoldersCol,
  resourceOpenLogCol,
  tagFrequency,
  upsertMeta,
  folderColor,
} from './util'
import type { ResourceMeta } from './util'
import { FaviconChip, StarRating, TagEditor, TypeIconBox } from './parts'

// ============================================================
//  資源詳情 / 編輯（drawer 風 modal）
//  ------------------------------------------------------------
//  Resource 本體（resourcesCol）+ meta（resourceMetaCol）同步存。
// ============================================================

export function DetailModal({
  resourceId,
  meta,
  onClose,
  onDeleted,
}: {
  resourceId: string
  meta: ResourceMeta
  onClose: () => void
  onDeleted: (id: string, title: string) => void
}) {
  const resources = useCollection(resourcesCol)
  const topics = useCollection(topicsCol)
  const folders = useCollection(resourceFoldersCol)
  const openLog = useCollection(resourceOpenLogCol)
  const toast = useToast()

  const res = resources.find((r) => r.id === resourceId)

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(res?.title ?? '')
  const [type, setType] = useState<ResourceType>(res?.type ?? 'link')
  const [url, setUrl] = useState(res?.url ?? '')
  const [topicId, setTopicId] = useState(res?.topicId ?? '')
  const [notes, setNotes] = useState(res?.notes ?? '')
  const [tags, setTags] = useState<string[]>(res?.tags ?? [])

  const allTags = useMemo(
    () => tagFrequency(resources).map((t) => t.tag),
    [resources],
  )
  const history = useMemo(
    () =>
      openLog
        .filter((l) => l.resourceId === resourceId)
        .sort((a, b) => b.ts.localeCompare(a.ts))
        .slice(0, 8),
    [openLog, resourceId],
  )

  if (!res) return null

  const topicName = topics.find((t) => t.id === res.topicId)?.topic
  const folder = folders.find((f) => f.id === meta.folderId)
  const domain = domainOf(res.url)

  const open = () => {
    if (!res.url) return
    logOpen(res.id)
    window.open(res.url, '_blank', 'noopener,noreferrer')
  }

  const saveEdit = () => {
    if (!title.trim()) {
      toast.error('標題唔可以空白')
      return
    }
    resourcesCol.update(res.id, {
      title: title.trim(),
      type,
      url: url.trim() || undefined,
      topicId: topicId || undefined,
      notes: notes.trim() || undefined,
      tags: tags.length ? tags : undefined,
    })
    toast.success('已更新資源')
    setEditing(false)
  }

  const setMeta = (patch: Partial<Omit<ResourceMeta, 'id'>>) =>
    upsertMeta(res.id, patch)

  // ── 編輯模式 ──
  if (editing) {
    return (
      <Modal
        open
        onClose={() => setEditing(false)}
        title="編輯資源"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              取消
            </Button>
            <Button icon={Save} onClick={saveEdit}>
              儲存
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="標題" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="類型">
              <Select
                value={type}
                onChange={(e) => setType(e.target.value as ResourceType)}
              >
                {TYPE_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {TYPE_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="課題">
              <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                <option value="">未連結</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.topic}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="連結 URL" hint={domainOf(url) ? `網域：${domainOf(url)}` : undefined}>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </Field>
          <Field label="標籤">
            <TagEditor value={tags} onChange={setTags} suggestions={allTags} />
          </Field>
          <Field label="備註">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="用途、重點、提醒…"
            />
          </Field>
        </div>
      </Modal>
    )
  }

  // ── 詳情模式 ──
  return (
    <Modal open onClose={onClose} title="資源詳情" size="lg">
      <div className="space-y-4">
        {/* 標頭 */}
        <div className="flex items-start gap-3">
          <TypeIconBox type={res.type} />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {res.title}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone="accent">{TYPE_LABEL[res.type]}</Badge>
              {topicName && <Badge tone="slate">{topicName}</Badge>}
              {folder && (
                <span
                  className={cx(
                    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium',
                    folderColor(folder.color).soft,
                  )}
                >
                  <span className={cx('h-1.5 w-1.5 rounded-full', folderColor(folder.color).dot)} />
                  {folder.name}
                </span>
              )}
              {meta.broken && <Badge tone="rose" icon={Link2Off}>連結失效</Badge>}
              {meta.archived && <Badge tone="slate">已封存</Badge>}
            </div>
          </div>
          <Tooltip label={meta.favorite ? '取消收藏' : '收藏'}>
            <IconButton
              label="收藏"
              active={meta.favorite}
              onClick={() => setMeta({ favorite: !meta.favorite })}
            >
              <Star
                size={18}
                className={cx(meta.favorite && 'fill-amber-400 text-amber-400')}
              />
            </IconButton>
          </Tooltip>
        </div>

        {/* 連結 + 開啟 */}
        {res.url ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
            <FaviconChip domain={domain} />
            <Button size="sm" icon={ExternalLink} onClick={open}>
              開啟
            </Button>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
            此資源沒有連結（純筆記 / 實體教材）
          </p>
        )}

        {/* 標籤 */}
        {res.tags && res.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <TagIcon size={13} className="text-slate-400" />
            {res.tags.map((t) => (
              <span
                key={t}
                className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* 備註 */}
        {res.notes && (
          <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
            {res.notes}
          </p>
        )}

        {/* 評分 + 收藏夾 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
            <p className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              評分
            </p>
            <StarRating
              value={meta.rating ?? 0}
              onChange={(v) => setMeta({ rating: v })}
              size={18}
            />
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
            <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <FolderInput size={12} /> 收藏夾
            </p>
            <Select
              value={meta.folderId ?? ''}
              onChange={(e) => setMeta({ folderId: e.target.value || undefined })}
              className="py-1 text-xs"
            >
              <option value="">未分類</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* 使用統計 */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="開啟次數" value={meta.opens} />
          <Stat label="最後開啟" value={relativeDate(meta.lastOpened)} small />
          <Stat label="加入於" value={relativeDate(res.createdAt)} small />
        </div>

        {/* 開啟歷史 */}
        {history.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              最近開啟
            </p>
            <ul className="space-y-1">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"
                >
                  <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <span className="tabular-nums">
                    {new Date(h.ts).toLocaleString('zh-HK', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Separator />

        {/* 動作列 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              編輯
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={meta.broken ? ExternalLink : Link2Off}
              onClick={() => setMeta({ broken: !meta.broken })}
            >
              {meta.broken ? '標記為正常' : '標記失效'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={meta.archived ? ArchiveRestore : Archive}
              onClick={() => {
                setMeta({ archived: !meta.archived })
                toast.success(meta.archived ? '已還原' : '已封存')
              }}
            >
              {meta.archived ? '還原' : '封存'}
            </Button>
          </div>
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            onClick={() => onDeleted(res.id, res.title)}
          >
            刪除
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function Stat({
  label,
  value,
  small,
}: {
  label: string
  value: string | number
  small?: boolean
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-2 dark:bg-slate-800/50">
      <p
        className={cx(
          'font-bold tabular-nums text-slate-800 dark:text-slate-100',
          small ? 'text-sm' : 'text-xl',
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">{label}</p>
    </div>
  )
}

// ============================================================
//  快速新增（URL 智能猜類型 / 網域標題提示）
//  ------------------------------------------------------------
//  把 Resource 本體寫 resourcesCol；meta（收藏夾 / 評分）寫 upsertMeta。
// ============================================================
export function AddResourceModal({
  open,
  onClose,
  presetFolderId,
}: {
  open: boolean
  onClose: () => void
  presetFolderId?: string
}) {
  const topics = useCollection(topicsCol)
  const folders = useCollection(resourceFoldersCol)
  const allResources = useCollection(resourcesCol)
  const toast = useToast()

  const [title, setTitle] = useState('')
  const [type, setType] = useState<ResourceType>('link')
  const [url, setUrl] = useState('')
  const [topicId, setTopicId] = useState('')
  const [folderId, setFolderId] = useState(presetFolderId ?? '')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [typeTouched, setTypeTouched] = useState(false)

  const allTags = useMemo(
    () => tagFrequency(allResources).map((t) => t.tag),
    [allResources],
  )
  const domain = domainOf(url)

  const reset = () => {
    setTitle('')
    setType('link')
    setUrl('')
    setTopicId('')
    setFolderId(presetFolderId ?? '')
    setNotes('')
    setTags([])
    setTypeTouched(false)
  }

  // URL 改變 → 自動猜類型（除非用家已手動揀過）
  const onUrlChange = (v: string) => {
    setUrl(v)
    if (!typeTouched) {
      const g = guessTypeFromUrl(v)
      if (g) setType(g)
    }
  }

  const save = (addAnother: boolean) => {
    if (!title.trim()) {
      toast.error('請輸入標題')
      return
    }
    const created = resourcesCol.add({
      title: title.trim(),
      type,
      url: url.trim() || undefined,
      topicId: topicId || undefined,
      notes: notes.trim() || undefined,
      tags: tags.length ? tags : undefined,
      createdAt: new Date().toISOString(),
    })
    if (folderId) upsertMeta(created.id, { folderId })
    toast.success('已新增資源')
    if (addAnother) {
      setTitle('')
      setUrl('')
      setNotes('')
      setTags([])
      setTypeTouched(false)
    } else {
      reset()
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="新增資源"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => save(true)}>
            儲存並再新增
          </Button>
          <Button onClick={() => save(false)}>儲存</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="連結 URL" hint={domain ? `偵測到網域：${domain}` : '貼上連結，會自動猜類型'}>
          <Input
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://…（選填）"
          />
        </Field>
        <Field label="標題" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：第3章 市場推廣 工作紙"
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="類型">
            <Select
              value={type}
              onChange={(e) => {
                setType(e.target.value as ResourceType)
                setTypeTouched(true)
              }}
            >
              {TYPE_ORDER.map((k) => (
                <option key={k} value={k}>
                  {TYPE_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="收藏夾">
            <Select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
              <option value="">未分類</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="課題（選填）">
          <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">未連結</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.topic}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="標籤（選填）">
          <TagEditor value={tags} onChange={setTags} suggestions={allTags} />
        </Field>
        <Field label="備註（選填）">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="用途、重點…"
          />
        </Field>
      </div>
    </Modal>
  )
}
