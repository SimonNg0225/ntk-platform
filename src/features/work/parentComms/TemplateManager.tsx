import { useEffect, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Select,
  Textarea,
  cx,
} from '../../../ui'
import {
  CATEGORY_LABEL,
  CATEGORY_OPTIONS,
  CATEGORY_STYLE,
  CHANNELS,
  type Category,
  type Channel,
  type CommTemplate,
} from './util'
import { FileText, Library, Pencil, Plus, Trash2, X } from 'lucide-react'

// ============================================================
//  信件範本管理 — 通訊錄裡嘅「常用信箋」
//  ------------------------------------------------------------
//  呼應主畫面通訊錄信箋語言：封面 masthead（kicker + serif 標題）、
//  範本似一疊歸檔信箋（分類色脊 + serif 標題）。
//  純表現層 —— 範本存喺本功能 parent_comm_templates 集合，
//  onAdd / onUpdate / onRemove / onClose 簽名一律不變。
// ============================================================

interface TemplateDraft {
  title: string
  category: Category
  channel: Channel
  body: string
}

function empty(): TemplateDraft {
  return { title: '', category: 'academic', channel: '電郵', body: '' }
}

export default function TemplateManager({
  open,
  templates,
  onClose,
  onAdd,
  onUpdate,
  onRemove,
}: {
  open: boolean
  templates: CommTemplate[]
  onClose: () => void
  onAdd: (draft: TemplateDraft) => void
  onUpdate: (id: string, draft: TemplateDraft) => void
  onRemove: (t: CommTemplate) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TemplateDraft>(empty)
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      setFormOpen(false)
      setEditingId(null)
    }
  }, [open])

  const startNew = () => {
    setDraft(empty())
    setEditingId(null)
    setFormOpen(true)
  }

  const startEdit = (t: CommTemplate) => {
    setDraft({
      title: t.title,
      category: t.category,
      channel: (CHANNELS as readonly string[]).includes(t.channel)
        ? (t.channel as Channel)
        : '電郵',
      body: t.body,
    })
    setEditingId(t.id)
    setFormOpen(true)
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.title.trim() || !draft.body.trim()) return
    if (editingId) onUpdate(editingId, draft)
    else onAdd(draft)
    setFormOpen(false)
    setEditingId(null)
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      {/* ───────── 信箋封面：kicker + serif 標題 + 收納裝飾 ───────── */}
      <header className="relative -mx-5 -mt-5 overflow-hidden px-5 pb-4 pt-5 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
              <Library size={12} />
              通訊錄 · Stationery
            </p>
            <h2 className="mt-1.5 font-serif text-[24px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[26px]">
              信件範本
            </h2>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              收藏常用信箋句式，撰寫信件時一鍵取用。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="-mr-1.5 -mt-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-700">
            <X size={18} />
          </button>
        </div>
        {/* 信箋雙線 */}
        <div className="mt-4 space-y-1" aria-hidden>
          <span className="block h-px bg-slate-200/90 dark:bg-slate-700/70" />
          <span className="block h-px bg-slate-200/60 dark:bg-slate-700/40" />
        </div>
      </header>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            <FileText size={13} className="shrink-0" />
            常用信箋
            <span className="tabular-nums text-slate-300 dark:text-slate-600">
              · {templates.length}
            </span>
          </p>
          <Button size="sm" icon={Plus} onClick={startNew}>
            新範本
          </Button>
        </div>

        {templates.length === 0 ? (
          <EmptyState icon={FileText} title="未有信件範本" hint="撳「新範本」加入常用句式，慳返寫信時間。" />
        ) : (
          <div className="max-h-[48vh] space-y-2 overflow-y-auto pr-1">
            {templates.map((t) => {
              const style = CATEGORY_STYLE[t.category]
              return (
                <Card key={t.id} hover clip className="p-0">
                  <div className="flex items-stretch">
                    {/* 分類色脊 —— 一眼分到範本主題 */}
                    <span aria-hidden className={cx('w-1 shrink-0', style.bar)} />
                    <div className="flex min-w-0 flex-1 items-start gap-2 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-serif text-[15px] font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                            {t.title}
                          </span>
                          <Badge tone={style.badge}>{CATEGORY_LABEL[t.category]}</Badge>
                          <Badge tone="slate">{t.channel}</Badge>
                          {t.builtIn && (
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                              內建
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          {t.body}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <IconButton label="編輯範本" size="sm" onClick={() => startEdit(t)}>
                          <Pencil size={15} />
                        </IconButton>
                        <IconButton
                          label="刪除範本"
                          tone="danger"
                          size="sm"
                          onClick={() => onRemove(t)}
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* 範本表單（巢狀 Modal） */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        size="md"
        title={editingId ? '編輯範本' : '新增範本'}
      >
        <form onSubmit={save} className="space-y-4">
          <Field label="標題" required>
            <Input
              value={draft.title}
              onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
              placeholder="例如：學習進度（正面）"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="分類">
              <Select
                value={draft.category}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, category: e.target.value as Category }))
                }
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="預設聯絡方式">
              <Select
                value={draft.channel}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, channel: e.target.value as Channel }))
                }
              >
                {CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="信箋內容" required hint="可用 [學生] / [科目] / [日期] 等佔位字眼，套用後自行替換。">
            <Textarea
              className="min-h-[120px] leading-relaxed"
              value={draft.body}
              onChange={(e) => setDraft((p) => ({ ...p, body: e.target.value }))}
              placeholder="敬啟者…&#10;常用句式內容。"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={!draft.title.trim() || !draft.body.trim()}>
              {editingId ? '儲存' : '新增'}
            </Button>
          </div>
        </form>
      </Modal>
    </Modal>
  )
}
