import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FeatureGuide,
  IconButton,
  Modal,
  PageHero,
  type FeatureGuideStep,
} from '../../../ui'
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
//  · hero：共用 PageHero accent 色塊（統一各功能頁頂部語言）
//  · FeatureGuide：教用家三步點用（上載 → 填寫 → 下載）
//  · 範本庫：useAdminDocTemplates 出卡，每張「填寫」/「刪除」
//  · 「＋ 新範本」開 TemplateUpload；空狀態引導式 CTA
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
  const { t } = useTranslation()
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

  // 教學引導步驟（inline t；唔改共用 i18n 檔）
  const ADMIN_DOCS_GUIDE: FeatureGuideStep[] = [
    {
      title: t('adminDocs.guideStep1Title', { defaultValue: '上載範本' }),
      desc: t('adminDocs.guideStep1Desc', {
        defaultValue:
          '撳「新範本」，揀一份 Word（句子入面寫 {標籤}）或有填寫欄位嘅 PDF，例如通告、申請表。',
      }),
    },
    {
      title: t('adminDocs.guideStep2Title', { defaultValue: '逐欄填寫' }),
      desc: t('adminDocs.guideStep2Desc', {
        defaultValue:
          '撳範本上嘅「填寫」，系統自動認出每個欄位，逐格填返學生／日期／內容。',
      }),
    },
    {
      title: t('adminDocs.guideStep3Title', { defaultValue: '原格式下載去印' }),
      desc: t('adminDocs.guideStep3Desc', {
        defaultValue:
          '即時生成 .docx / .pdf，100% 保留原本排版同字體，下載出嚟直接印。',
      }),
    },
  ]

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
      {/* ───────── 頁面身份 hero（共用 PageHero accent 色塊）───────── */}
      <PageHero
        guideKey="work-admin-docs"
        icon={FileStack}
        kicker={t('adminDocs.kicker', { defaultValue: 'Admin Docs' })}
        title={t('adminDocs.pageTitle', { defaultValue: '行政文件' })}
        description={t('adminDocs.pageDesc', {
          defaultValue:
            '上載 Word（{標籤}）或 PDF 範本，逐欄填寫，原格式生成下載去印。',
        })}
        actions={
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-medium backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <Plus size={15} />
            {t('adminDocs.newTemplate', { defaultValue: '新範本' })}
          </button>
        }
      />

      {/* ───────── 教學引導：點用呢個功能 ───────── */}
      <FeatureGuide
        storageKey="work-admin-docs"
        title={t('adminDocs.guideTitle', { defaultValue: '行政文件點用？' })}
        steps={ADMIN_DOCS_GUIDE}
      />

      {/* ───────── 範本庫 ───────── */}
      {templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t('adminDocs.emptyTitle', { defaultValue: '未有任何範本' })}
          hint={t('adminDocs.emptyHint', {
            defaultValue:
              '上載一份 Word 範本（句子入面寫 {標籤}）或有填寫欄位的 PDF，例如家長通告、申請表，之後逐欄填寫即可一鍵生成。',
          })}
          action={
            <Button onClick={() => setUploadOpen(true)} icon={Plus}>
              {t('adminDocs.emptyCta', { defaultValue: '上載第一份範本' })}
            </Button>
          }
        />
      ) : (
        <section>
          {/* 區段小標頭（純中文：用 text-slate-500，唔落 uppercase/tracking 免字距散）*/}
          <div className="mb-3">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <FileStack size={14} />
              {t('adminDocs.libraryTitle', { defaultValue: '範本庫' })}
              <span className="tabular-nums slashed-zero font-medium text-slate-400 dark:text-slate-500">
                {templates.length}
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
              {t('adminDocs.libraryDesc', {
                defaultValue: '撳「填寫」逐欄填好，即可下載去印。',
              })}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {templates.map((tpl) => {
              const isPdf = templateKind(tpl) === 'pdf'
              return (
                <Card key={tpl.id} padded className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                        <FileText size={18} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-medium text-slate-800 dark:text-slate-100">
                            {tpl.name}
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
                            {tpl.fields.length} 個欄位
                          </span>
                          <span
                            aria-hidden
                            className="text-slate-300 dark:text-slate-600"
                          >
                            ·
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays size={11} />
                            {fmtDate(tpl.createdAt)}
                          </span>
                        </p>
                      </div>
                    </div>
                    <IconButton
                      label="刪除範本"
                      tone="danger"
                      onClick={() => handleRemove(tpl)}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </div>

                  <Button
                    variant="secondary"
                    fullWidth
                    icon={Pencil}
                    onClick={() => setFillingId(tpl.id)}
                  >
                    {t('adminDocs.fillCta', { defaultValue: '填寫' })}
                  </Button>
                </Card>
              )
            })}
          </div>
        </section>
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
