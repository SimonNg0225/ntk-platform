import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Copy, RefreshCw, Megaphone } from 'lucide-react'
import {
  Card,
  SectionTitle,
  Badge,
  Button,
  Input,
  Textarea,
  Select,
  Field,
  EmptyState,
  Modal,
} from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { adminListMarketing, adminSaveMarketing, adminDeleteMarketing } from '../../lib/admin'
import {
  ASSET_TYPE_LABEL,
  ASSET_TYPE_OPTIONS,
  STATUS_LABEL,
  STATUS_OPTIONS,
  STATUS_TONE,
  type MarketingAsset,
  type MarketingAssetType,
  type MarketingStatus,
} from '../../lib/marketingContent'

// ════════════ 行銷內容管理（雲端共享）════════════
// 資料存在 Supabase marketing_content,經 admin Edge Function 讀寫;
// 全部管理員共用。只後台 admin 見到（Admin 頁面整體已 gate）。

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString('zh-HK', { dateStyle: 'short', timeStyle: 'short' })

type EditableAsset = Pick<MarketingAsset, 'type' | 'title' | 'channel' | 'status' | 'body' | 'notes'>

const BLANK: EditableAsset = {
  type: 'other',
  title: '',
  channel: '',
  status: 'draft',
  body: '',
  notes: '',
}

export default function MarketingTab() {
  const toast = useToast()
  const confirm = useConfirm()

  const [rows, setRows] = useState<MarketingAsset[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [filter, setFilter] = useState<MarketingStatus | 'all'>('all')

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<EditableAsset>(BLANK)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    adminListMarketing()
      .then((d) => {
        setRows(d)
        setErr(null)
      })
      .catch((e) => setErr(e instanceof Error ? e.message : '載入失敗'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => reload(), [reload])

  const all = rows ?? []
  const sorted = useMemo(
    () =>
      all
        .filter((a) => filter === 'all' || a.status === filter)
        .slice()
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [all, filter],
  )
  const publishedCount = useMemo(() => all.filter((a) => a.status === 'published').length, [all])

  const openNew = () => {
    setEditId(null)
    setForm(BLANK)
    setOpen(true)
  }
  const openEdit = (a: MarketingAsset) => {
    setEditId(a.id)
    setForm({ type: a.type, title: a.title, channel: a.channel, status: a.status, body: a.body, notes: a.notes })
    setOpen(true)
  }

  const save = async () => {
    const title = form.title.trim()
    if (!title) {
      toast.error('請輸入標題')
      return
    }
    const payload: Partial<MarketingAsset> = {
      ...form,
      title,
      channel: form.channel.trim(),
      notes: form.notes.trim(),
    }
    if (editId) payload.id = editId
    try {
      setBusy(true)
      await adminSaveMarketing(payload)
      toast.success(editId ? '已更新' : '已新增')
      setOpen(false)
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '儲存失敗')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (a: MarketingAsset) => {
    const ok = await confirm({ title: `刪除「${a.title}」？`, tone: 'danger', confirmText: '刪除' })
    if (!ok) return
    try {
      await adminDeleteMarketing(a.id)
      setRows((cur) => (cur ? cur.filter((x) => x.id !== a.id) : cur))
      toast.success('已刪除')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '刪除失敗')
    }
  }

  const copy = async (a: MarketingAsset) => {
    try {
      await navigator.clipboard.writeText(a.body)
      toast.success('已複製內文')
    } catch {
      toast.error('複製失敗')
    }
  }

  return (
    <Card className="p-5">
      <SectionTitle
        right={
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" icon={RefreshCw} loading={loading} onClick={reload}>
              重新載入
            </Button>
            <Button size="sm" icon={Plus} onClick={openNew}>
              新增內容
            </Button>
          </div>
        }
      >
        <span className="inline-flex items-center gap-1.5">
          行銷內容
          {rows && <Badge tone="slate">{all.length}</Badge>}
          {publishedCount > 0 && <Badge tone="green">{publishedCount} 已發佈</Badge>}
        </span>
      </SectionTitle>

      <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
        集中管理推廣 campaign 的內容草稿（Landing 文案、示範腳本、SEO 文…）。雲端共享,全部管理員查看到同一份。
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
          全部
        </FilterChip>
        {STATUS_OPTIONS.map((s) => (
          <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>
            {STATUS_LABEL[s]}
          </FilterChip>
        ))}
      </div>

      {rows === null ? (
        <p className="py-8 text-center text-sm text-slate-400">{loading ? '載入中…' : (err ?? '載入失敗')}</p>
      ) : err ? (
        <p className="py-8 text-center text-sm text-rose-500">{err}</p>
      ) : sorted.length === 0 ? (
        <EmptyState icon={Megaphone} title="未有內容。" hint="㩒「新增內容」開始草擬。" />
      ) : (
        <ul className="space-y-2">
          {sorted.map((a) => (
            <li key={a.id} className="rounded-xl border border-[color:var(--border)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {a.title}
                    </span>
                    <Badge tone="accent">{ASSET_TYPE_LABEL[a.type]}</Badge>
                    <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                  </div>
                  {a.channel && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">渠道：{a.channel}</p>}
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">
                    {a.body || '（未有內文）'}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    更新：<span className="tabular-nums">{fmtDateTime(a.updated_at)}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button size="sm" variant="ghost" icon={Copy} onClick={() => copy(a)}>
                    複製
                  </Button>
                  <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEdit(a)}>
                    編輯
                  </Button>
                  <Button size="sm" variant="danger" icon={Trash2} onClick={() => remove(a)}>
                    刪除
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={editId ? '編輯內容' : '新增內容'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button loading={busy} onClick={save}>
              儲存
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="標題" required>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="例如 Landing page 文案 v1"
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="類型">
              <Select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as MarketingAssetType }))}
              >
                {ASSET_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {ASSET_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="狀態">
              <Select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as MarketingStatus }))}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="渠道">
              <Input
                value={form.channel}
                onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                placeholder="例如 Threads / IG"
              />
            </Field>
          </div>
          <Field label="內文" hint="可直接複製去出帖／落 Landing。">
            <Textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              className="min-h-[240px]"
              placeholder="內容草稿…"
            />
          </Field>
          <Field label="內部備註" hint="拍攝提示、SEO 關鍵詞、to-do（不會出街）。">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="備註…"
            />
          </Field>
        </div>
      </Modal>
    </Card>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-full px-3 py-1 text-xs font-medium transition ' +
        (active
          ? 'bg-accent text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700')
      }
    >
      {children}
    </button>
  )
}
