import { useMemo, useState } from 'react'
import { Badge, Button, Card, EmptyState, IconButton, Modal } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import {
  removeTemplate,
  templateKind,
  useAdminDocTemplates,
  type AdminDocTemplate,
} from './adminDocStore'
import TemplateUpload from './TemplateUpload'
import FillForm from './FillForm'
import {
  FileText,
  FileStack,
  FileType,
  FileBadge,
  Plus,
  Pencil,
  Trash2,
  Tag,
  CalendarDays,
} from 'lucide-react'

// ============================================================
//  行政文件 — hub feature（selfManagedHeader）
//  ------------------------------------------------------------
//  · masthead：公文卷宗封面感（kicker + serif 標題 + 左裝訂線 + 分隔線）
//  · 範本庫：useAdminDocTemplates 出卡，每張「填寫」/「刪除」
//  · 「＋ 新範本」開 TemplateUpload；空狀態引導
//  老師上載 Word（{標籤}）或 PDF（填寫欄位）範本 → 逐欄填 →
//  100% 保留格式生成 .docx / .pdf 下載去印。
// ============================================================

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(
      d.getDate(),
    ).padStart(2, '0')}`
  } catch {
    return ''
  }
}

export default function AdminDocs() {
  const templates = useAdminDocTemplates()
  const toast = useToast()
  const confirm = useConfirm()

  const [uploadOpen, setUploadOpen] = useState(false)
  // 正在填寫嘅範本 id；null = 唔喺填寫畫面。
  const [fillingId, setFillingId] = useState<string | null>(null)

  const filling = useMemo<AdminDocTemplate | undefined>(
    () => templates.find((t) => t.id === fillingId),
    [templates, fillingId],
  )

  async function handleRemove(t: AdminDocTemplate) {
    const ok = await confirm({
      title: `刪除範本「${t.name}」？`,
      message: '刪除後無法復原（此範本只存於本機，未同步雲端）。',
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    removeTemplate(t.id)
    toast.success('範本已刪除。')
  }

  return (
    <div className="w-full space-y-5 p-4 sm:p-6">
      {/* ───────── masthead：公文卷宗封面（kicker + serif 標題 + 左裝訂線 + 分隔線）───────── */}
      <header className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white pl-7 pr-5 py-5 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none sm:pl-9 sm:pr-7 sm:py-6">
        {/* 左側裝訂線（卷宗釘裝感，純裝飾） */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-4 left-3 flex w-1 flex-col items-center justify-between sm:left-4"
        >
          {Array.from({ length: 7 }).map((_, i) => (
            <span
              key={i}
              className="h-1 w-1 rounded-full bg-accent/25 dark:bg-accent/30"
            />
          ))}
        </span>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
              <FileStack size={13} />
              Documents · 公文範本
            </p>
            <h1 className="mt-1.5 text-[28px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[34px]">
              行政文件
            </h1>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              上載 Word（{'{標籤}'}）或 PDF（填寫欄位）範本，逐欄填寫，原格式生成下載去印。
            </p>
          </div>
          <Button
            onClick={() => setUploadOpen(true)}
            icon={Plus}
            className="shrink-0"
          >
            新範本
          </Button>
        </div>
        {/* 分隔線（封面留白感） */}
        <div className="mt-5 space-y-1.5" aria-hidden>
          <span className="block h-px bg-slate-200/90 dark:bg-slate-700/70" />
          <span className="block h-px bg-slate-200/50 dark:bg-slate-700/40" />
        </div>
      </header>

      {/* ───────── 範本庫 ───────── */}
      {templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="未有任何範本"
          hint="上載一份 Word 範本（含 {標籤}）或有填寫欄位的 PDF（例如家長通知書、申請表），之後逐欄填寫即可一鍵生成。"
          action={
            <Button onClick={() => setUploadOpen(true)} icon={Plus}>
              上載第一份範本
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {templates.map((t) => {
            const isPdf = templateKind(t) === 'pdf'
            return (
            <Card
              key={t.id}
              padded
              className="flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                    <FileText size={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-medium text-slate-800 dark:text-slate-100">
                        {t.name}
                      </h3>
                      {/* Word / PDF 來源 badge */}
                      <Badge
                        tone={isPdf ? 'rose' : 'blue'}
                        icon={isPdf ? FileBadge : FileType}
                        className="shrink-0"
                      >
                        {isPdf ? 'PDF' : 'Word'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400 dark:text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Tag size={11} />
                        {t.fields.length} 個欄位
                      </span>
                      <span aria-hidden className="text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={11} />
                        {fmtDate(t.createdAt)}
                      </span>
                    </p>
                  </div>
                </div>
                <IconButton
                  label="刪除範本"
                  tone="danger"
                  onClick={() => handleRemove(t)}
                >
                  <Trash2 size={16} />
                </IconButton>
              </div>

              <Button
                variant="secondary"
                fullWidth
                icon={Pencil}
                onClick={() => setFillingId(t.id)}
              >
                填寫
              </Button>
            </Card>
            )
          })}
        </div>
      )}

      {/* ───────── 上載範本 modal ───────── */}
      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="新增範本"
        size="lg"
        closeOnBackdrop={false}
      >
        <TemplateUpload
          onSaved={() => setUploadOpen(false)}
          onCancel={() => setUploadOpen(false)}
        />
      </Modal>

      {/* ───────── 填寫 modal ───────── */}
      <Modal
        open={!!filling}
        onClose={() => setFillingId(null)}
        title={filling ? `填寫：${filling.name}` : undefined}
        size="xl"
        closeOnBackdrop={false}
      >
        {filling && (
          <FillForm template={filling} onBack={() => setFillingId(null)} />
        )}
      </Modal>
    </div>
  )
}
