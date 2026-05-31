import { useMemo, useState } from 'react'
import {
  BookMarked,
  Clapperboard,
  ClipboardList,
  FileText,
  Link as LinkIcon,
  Plus,
  Presentation,
  Search,
  StickyNote,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCollection } from '../../lib/store'
import { resourcesCol, topicsCol } from '../../data/collections'
import type { ResourceType } from '../../data/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Pills,
  Select,
  StatCard,
  Textarea,
  Tooltip,
} from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'

const TYPE_LABEL: Record<ResourceType, string> = {
  handout: '講義',
  slides: '簡報',
  paper: '試題',
  link: '連結',
  video: '影片',
  note: '筆記',
}
const TYPE_ICON: Record<ResourceType, LucideIcon> = {
  handout: FileText,
  slides: Presentation,
  paper: ClipboardList,
  link: LinkIcon,
  video: Clapperboard,
  note: StickyNote,
}

const TYPE_KEYS = Object.keys(TYPE_LABEL) as ResourceType[]

type FilterType = 'all' | ResourceType

export default function ResourceLibrary() {
  const resources = useCollection(resourcesCol)
  const topics = useCollection(topicsCol)
  const toast = useToast()
  const confirm = useConfirm()

  const [showForm, setShowForm] = useState(false)
  const [fType, setFType] = useState<FilterType>('all')
  const [fTopic, setFTopic] = useState('')
  const [search, setSearch] = useState('')

  const topicName = (id?: string) =>
    id ? (topics.find((t) => t.id === id)?.topic ?? '') : ''

  const typeCounts = useMemo(() => {
    const counts: Record<ResourceType, number> = {
      handout: 0,
      slides: 0,
      paper: 0,
      link: 0,
      video: 0,
      note: 0,
    }
    for (const r of resources) counts[r.type] += 1
    return counts
  }, [resources])

  const filtered = useMemo(
    () =>
      resources
        .filter((r) => (fType !== 'all' ? r.type === fType : true))
        .filter((r) => (fTopic ? r.topicId === fTopic : true))
        .filter((r) =>
          search ? r.title.toLowerCase().includes(search.toLowerCase()) : true,
        )
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [resources, fType, fTopic, search],
  )

  const removeResource = async (id: string, title: string) => {
    const ok = await confirm({
      title: '刪除資源？',
      message: `「${title}」將會被永久刪除，呢個動作無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    resourcesCol.remove(id)
    toast.success('已刪除資源')
  }

  const pillOptions: { id: FilterType; label: string }[] = [
    { id: 'all', label: '全部' },
    ...TYPE_KEYS.map((k) => ({
      id: k as FilterType,
      label: TYPE_LABEL[k],
    })),
  ]

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          教學資源庫
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          收集講義、簡報、試題、連結同筆記，按類型或課題快速搵返。
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {TYPE_KEYS.map((k) => (
          <StatCard
            key={k}
            label={TYPE_LABEL[k]}
            value={typeCounts[k]}
            icon={TYPE_ICON[k]}
            highlight={fType === k}
            onClick={() => setFType((prev) => (prev === k ? 'all' : k))}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[140px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋資源…"
            className="pl-9"
          />
        </div>
        <Select
          value={fTopic}
          onChange={(e) => setFTopic(e.target.value)}
          className="w-auto"
        >
          <option value="">全部課題</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.topic}
            </option>
          ))}
        </Select>
        <Button icon={Plus} onClick={() => setShowForm(true)}>
          新增資源
        </Button>
      </div>

      <Pills options={pillOptions} active={fType} onChange={setFType} />

      {filtered.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title="未有符合嘅資源"
          hint="撳「新增資源」開始建立你嘅教材庫，或者調整篩選條件。"
          action={
            <Button icon={Plus} onClick={() => setShowForm(true)}>
              新增資源
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((r) => {
            const TypeIcon = TYPE_ICON[r.type]
            return (
              <Card key={r.id} className="group flex flex-col p-4">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                    <TypeIcon size={20} strokeWidth={1.75} />
                  </div>
                  <Tooltip label="刪除">
                    <IconButton
                      label="刪除"
                      tone="danger"
                      onClick={() => removeResource(r.id, r.title)}
                      className="opacity-0 transition group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </Tooltip>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {r.title}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge tone="accent">{TYPE_LABEL[r.type]}</Badge>
                  {r.topicId && (
                    <Badge tone="slate">{topicName(r.topicId)}</Badge>
                  )}
                </div>
                {r.notes && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {r.notes}
                  </p>
                )}
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    開啟連結
                    <LinkIcon size={12} />
                  </a>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="新增資源">
        <AddForm onDone={() => setShowForm(false)} />
      </Modal>
    </div>
  )
}

function AddForm({ onDone }: { onDone: () => void }) {
  const topics = useCollection(topicsCol)
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ResourceType>('link')
  const [url, setUrl] = useState('')
  const [topicId, setTopicId] = useState('')
  const [notes, setNotes] = useState('')

  const save = () => {
    if (!title.trim()) return
    resourcesCol.add({
      title: title.trim(),
      type,
      url: url.trim() || undefined,
      topicId: topicId || undefined,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    })
    toast.success('已新增資源')
    onDone()
  }

  return (
    <div className="space-y-3">
      <Field label="資源標題">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="資源標題…"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="類型">
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as ResourceType)}
          >
            {TYPE_KEYS.map((k) => (
              <option key={k} value={k}>
                {TYPE_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="課題（選填）">
          <Select
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
          >
            <option value="">未選擇</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.topic}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="連結 URL（選填）">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />
      </Field>
      <Field label="備註（選填）">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="備註…"
          rows={2}
        />
      </Field>
      <Button onClick={save} className="w-full">
        儲存資源
      </Button>
    </div>
  )
}
