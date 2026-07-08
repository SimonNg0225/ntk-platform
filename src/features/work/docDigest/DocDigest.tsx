import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FileSearch,
  Sparkles,
  Upload,
  Camera,
  CheckSquare,
  CalendarPlus,
  Trash2,
  Clock,
  FileText,
  Printer,
  ListChecks,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FeatureGuide,
  type FeatureGuideStep,
  IconButton,
  PageHero,
  SectionTitle,
  SegmentedControl,
  Textarea,
  Tooltip,
  cx,
} from '../../../ui'
import CreditMeter from '../../../components/CreditMeter'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { useCollection } from '../../../lib/store'
import { complete, isAIConfigured, type AIMessage, type AIModel } from '../../../lib/aiClient'
import { tasksCol, eventsCol } from '../../../data/collections'
import { downloadDocx, printDoc, type ExportBlock, type ExportDoc } from '../../../lib/export'
import { docDigestCol, type DigestAction, type DigestRecord } from './digestStore'
import { buildDigestSystem, parseDigest } from './prompts'
import { extractFromFile } from './extract'

type Mode = 'text' | 'file' | 'photo'

const MODE_OPTIONS: { id: Mode; label: string }[] = [
  { id: 'text', label: '貼文字' },
  { id: 'file', label: '上載檔' },
  { id: 'photo', label: '影相' },
]
const MODEL_OPTIONS: { id: AIModel; label: string }[] = [
  { id: 'gemini-2.5-flash', label: 'Flash' },
  { id: 'gemini-2.5-pro', label: 'Pro' },
]

const CAT_TONE: Record<string, Parameters<typeof Badge>[0]['tone']> = {
  校務通告: 'blue',
  家長通告: 'green',
  會議文件: 'accent',
  行政表格: 'amber',
  政策指引: 'rose',
  課程相關: 'accent',
  其他: 'slate',
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

export default function DocDigest() {
  const { t } = useTranslation()
  const toast = useToast()
  const confirm = useConfirm()
  const records = useCollection(docDigestCol)
  const history = useMemo(
    () => [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [records],
  )

  const [mode, setMode] = useState<Mode>('text')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [model, setModel] = useState<AIModel>('gemini-2.5-flash')
  const [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState<DigestRecord | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const hasInput = mode === 'text' ? text.trim().length > 0 : file !== null

  async function run() {
    if (busy || !hasInput) return
    setBusy(true)
    try {
      let inputText = ''
      let image: AIMessage['images'] = undefined
      let sourceType: DigestRecord['sourceType'] = 'text'

      if (mode === 'text') {
        inputText = text.trim()
      } else if (file) {
        const ex = await extractFromFile(file)
        inputText = ex.text
        if (ex.image) image = [ex.image]
        sourceType = ex.sourceType
        if (!inputText && !ex.image) {
          throw new Error('這個檔抽不到文字。請確認檔案有可讀內容，或嘗試改用「影相」。')
        }
        if (ex.scanPagesDropped && ex.scanPagesDropped > 0) {
          toast.info(
            `掃描頁多過 50 版，餘下 ${ex.scanPagesDropped} 版未處理；建議分批上載（已多扣 1 點作 AI 辨識）`,
          )
        } else if (ex.usedVision) {
          toast.info('掃描頁已用 AI 圖像辨識補字（多扣 1 點）')
        }
      }

      const system = buildDigestSystem(new Date().toISOString().slice(0, 10))
      const messages: AIMessage[] = [
        { role: 'user', content: inputText || '（請閱讀附圖的文件）', images: image },
      ]
      const raw = await complete({ messages, system, model, temperature: 0.2, source: 'doc-digest' })
      const result = parseDigest(raw)

      const rec = docDigestCol.add({
        createdAt: new Date().toISOString(),
        title: result.title,
        category: result.category,
        summary: result.summary,
        actions: result.actions,
        sourceType,
        snippet: (inputText || '（圖片文件）').slice(0, 500),
        model,
      })
      setCurrent(rec)
      setText('')
      setFile(null)
      toast.success(t('docDigest.toast.done', { defaultValue: '速讀完成' }))
    } catch (e) {
      toast.error(
        (e as Error).message ||
          t('docDigest.toast.failed', { defaultValue: '速讀失敗，請再試。' }),
      )
    } finally {
      setBusy(false)
    }
  }

  function addTodo(a: DigestAction) {
    tasksCol.add({
      text: a.date ? `${a.text}（${a.date}）` : a.text,
      done: false,
      createdAt: new Date().toISOString(),
    })
    toast.success(t('docDigest.toast.todoAdded', { defaultValue: '已加入待辦' }))
  }

  function addEvent(a: DigestAction) {
    if (!a.date) return
    eventsCol.add({ title: a.text, date: a.date, allDay: true })
    toast.success(t('docDigest.toast.eventAdded', { defaultValue: '已加入行事曆' }))
  }

  async function del(id: string) {
    const ok = await confirm({
      title: t('docDigest.confirm.del', { defaultValue: '刪除這個速讀記錄？' }),
      tone: 'danger',
      confirmText: t('docDigest.confirm.delOk', { defaultValue: '刪除' }),
    })
    if (!ok) return
    docDigestCol.remove(id)
    if (current?.id === id) setCurrent(null)
  }

  const guideSteps: FeatureGuideStep[] = [
    {
      title: t('docDigest.guide.s1.title', { defaultValue: '選擇輸入方式' }),
      desc: t('docDigest.guide.s1.desc', {
        defaultValue: '貼上通告文字、上載 PDF／Word，或直接影低紙本文件。',
      }),
    },
    {
      title: t('docDigest.guide.s2.title', { defaultValue: '按「速讀」' }),
      desc: t('docDigest.guide.s2.desc', {
        defaultValue: 'AI 立即幫你歸類、抽幾條重點，同列出要跟進的事項。',
      }),
    },
    {
      title: t('docDigest.guide.s3.title', { defaultValue: '一鍵跟進' }),
      desc: t('docDigest.guide.s3.desc', {
        defaultValue: '把跟進事項加入待辦或行事曆，亦可下載 Word／PDF 留底。',
      }),
    },
  ]

  if (!isAIConfigured) {
    return (
      <div className="space-y-5">
        <PageHero
          guideKey="doc-digest"
          icon={FileSearch}
          kicker={t('docDigest.kicker', { defaultValue: 'Doc Digest' })}
          title={t('docDigest.title', { defaultValue: '文件速讀' })}
          description={t('docDigest.subtitle', {
            defaultValue: '貼上、上載或影低行政文件，AI 立即幫你歸類、抽重點、列出要跟進事項。',
          })}
        />
        <EmptyState
          icon={FileSearch}
          title={t('docDigest.disabled.title', { defaultValue: '文件速讀未啟用' })}
          hint={t('docDigest.disabled.hint', {
            defaultValue:
              '要設定好 Supabase 並部署 gemini Edge Function 先用到，步驟見 docs/SETUP.md。',
          })}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ───────── Page hero（共用 accent hero） ───────── */}
      <PageHero
        icon={FileSearch}
        kicker={t('docDigest.kicker', { defaultValue: 'Doc Digest' })}
        title={t('docDigest.title', { defaultValue: '文件速讀' })}
        description={t('docDigest.subtitle', {
          defaultValue: '貼上、上載或影低行政文件，AI 立即幫你歸類、抽重點、列出要跟進事項。',
        })}
      />

      {/* ───────── 教學引導：如何使用此功能（可摺疊 / 永久收起） ───────── */}
      <FeatureGuide
        storageKey="doc-digest"
        title={t('docDigest.guide.title', { defaultValue: '文件速讀使用說明' })}
        steps={guideSteps}
      />

      {/* ───────── 輸入 ───────── */}
      <section aria-label={t('docDigest.input.aria', { defaultValue: '輸入文件' })}>
        <SectionTitle
          icon={Sparkles}
          right={
            <Tooltip label={t('docDigest.model.hint', { defaultValue: 'Flash 快 · Pro 強' })}>
              <SegmentedControl size="sm" options={MODEL_OPTIONS} value={model} onChange={setModel} />
            </Tooltip>
          }
        >
          {t('docDigest.input.title', { defaultValue: '貼上文件' })}
        </SectionTitle>

        <Card padded className="space-y-3">
          <SegmentedControl
            options={MODE_OPTIONS}
            value={mode}
            onChange={(m) => {
              setMode(m)
              setFile(null)
            }}
          />

          {mode === 'text' ? (
            <Textarea
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('docDigest.input.placeholder', {
                defaultValue: '貼上通告 / 會議文件 / 政策內容…',
              })}
            />
          ) : (
            <div>
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                accept={mode === 'photo' ? 'image/*' : '.pdf,.docx,.doc,.txt'}
                {...(mode === 'photo' ? { capture: 'environment' as const } : {})}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="group flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-accent/40 bg-accent-soft/50 px-4 py-8 text-center transition duration-200 hover:border-accent hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] dark:border-accent/40 dark:bg-accent/10"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-white">
                  {mode === 'photo' ? <Camera size={20} /> : <Upload size={20} />}
                </span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {file
                    ? file.name
                    : mode === 'photo'
                      ? t('docDigest.upload.photo', { defaultValue: '影相 / 選擇相片' })
                      : t('docDigest.upload.file', { defaultValue: '選擇 PDF / Word 檔' })}
                </span>
                {!file && (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {mode === 'photo'
                      ? t('docDigest.upload.photoHint', { defaultValue: '手機可即影紙本通告' })
                      : t('docDigest.upload.fileHint', {
                          defaultValue: '掃描件自動 AI 辨識文字（多扣 1 點）',
                        })}
                  </span>
                )}
              </button>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <CreditMeter source="doc-digest" model={model} className="mr-auto" />
            <Button icon={Sparkles} onClick={run} loading={busy} disabled={!hasInput}>
              {busy
                ? t('docDigest.run.busy', { defaultValue: '速讀中…' })
                : t('docDigest.run.label', { defaultValue: '速讀' })}
            </Button>
          </div>
        </Card>
      </section>

      {/* ───────── 結果 ───────── */}
      {current && <ResultCard rec={current} onAddTodo={addTodo} onAddEvent={addEvent} />}

      {/* ───────── 歷史 ───────── */}
      {history.length > 0 && (
        <section aria-label={t('docDigest.history.title', { defaultValue: '速讀記錄' })}>
          <SectionTitle
            icon={Clock}
            right={
              <span className="text-xs font-medium tabular-nums text-slate-400 dark:text-slate-500">
                {history.length}
              </span>
            }
          >
            {t('docDigest.history.title', { defaultValue: '速讀記錄' })}
          </SectionTitle>
          <div className="space-y-2">
            {history.map((r) => {
              const active = current?.id === r.id
              return (
                <Card
                  key={r.id}
                  hover
                  onClick={() => setCurrent(r)}
                  className={cx('p-3', active && 'ring-1 ring-accent/40')}
                >
                  <div className="flex items-start gap-2.5">
                    <Badge tone={CAT_TONE[r.category] ?? 'slate'}>{r.category}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                        {r.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                        <span className="tabular-nums slashed-zero">{fmtDate(r.createdAt)}</span>
                        {' · '}
                        {t('docDigest.history.points', {
                          defaultValue: '{{n}} 重點',
                          n: r.summary.length,
                        })}
                        {r.actions.length > 0 &&
                          ` · ${t('docDigest.history.follow', {
                            defaultValue: '{{n}} 跟進',
                            n: r.actions.length,
                          })}`}
                      </p>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <IconButton
                        label={t('docDigest.history.del', { defaultValue: '刪除' })}
                        size="sm"
                        tone="danger"
                        onClick={() => void del(r.id)}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {history.length === 0 && !current && (
        <EmptyState
          icon={FileText}
          title={t('docDigest.empty.title', { defaultValue: '未有速讀記錄' })}
          hint={t('docDigest.empty.hint', {
            defaultValue: '貼上、上載或影低第一份行政文件，按「速讀」立即見到歸類同重點。',
          })}
        />
      )}
    </div>
  )
}

function digestToDoc(rec: DigestRecord): ExportDoc {
  const blocks: ExportBlock[] = []
  if (rec.summary.length > 0) {
    blocks.push({ kind: 'heading', text: '重點', level: 1 })
    blocks.push({ kind: 'bullets', items: rec.summary })
  }
  if (rec.actions.length > 0) {
    blocks.push({ kind: 'heading', text: '要跟進', level: 1 })
    blocks.push({
      kind: 'bullets',
      items: rec.actions.map((a) => (a.date ? `${a.text}（${a.date}）` : a.text)),
    })
  }
  return { title: rec.title, subtitle: rec.category, blocks }
}

function ResultCard({
  rec,
  onAddTodo,
  onAddEvent,
}: {
  rec: DigestRecord
  onAddTodo: (a: DigestAction) => void
  onAddEvent: (a: DigestAction) => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const dlWord = async () => {
    try {
      await downloadDocx(digestToDoc(rec))
      toast.success(t('docDigest.result.dlWordOk', { defaultValue: '已下載 Word' }))
    } catch (e) {
      toast.error((e as Error).message || t('docDigest.result.dlErr', { defaultValue: '下載失敗' }))
    }
  }
  const dlPdf = () => {
    try {
      printDoc(digestToDoc(rec))
    } catch (e) {
      toast.error(
        (e as Error).message || t('docDigest.result.printErr', { defaultValue: '列印失敗' }),
      )
    }
  }
  return (
    <Card padded className="space-y-4 ring-1 ring-accent/40">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={CAT_TONE[rec.category] ?? 'slate'}>{rec.category}</Badge>
        <h2 className="min-w-0 flex-1 text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
          {rec.title}
        </h2>
        <Button variant="secondary" size="sm" icon={FileText} onClick={dlWord}>
          Word
        </Button>
        <Button variant="secondary" size="sm" icon={Printer} onClick={dlPdf}>
          PDF
        </Button>
      </div>

      {rec.summary.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
            <ListChecks size={13} className="text-accent" />
            {t('docDigest.result.points', { defaultValue: '重點' })}
          </p>
          <ul className="space-y-1.5">
            {rec.summary.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-200">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rec.actions.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
            <CheckSquare size={13} className="text-amber-500" />
            {t('docDigest.result.follow', { defaultValue: '要跟進' })}
          </p>
          <div className="space-y-2">
            {rec.actions.map((a, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/60 px-3 py-2 dark:border-slate-700/60 dark:bg-slate-800/40"
              >
                <span className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-200">
                  {a.text}
                </span>
                {a.date && (
                  <Badge tone="amber" icon={Clock}>
                    {a.date}
                  </Badge>
                )}
                <Button variant="secondary" size="sm" icon={CheckSquare} onClick={() => onAddTodo(a)}>
                  {t('docDigest.result.toTodo', { defaultValue: '待辦' })}
                </Button>
                {a.date && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={CalendarPlus}
                    onClick={() => onAddEvent(a)}
                  >
                    {t('docDigest.result.toEvent', { defaultValue: '行事曆' })}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {rec.summary.length === 0 && rec.actions.length === 0 && (
        <p className="text-sm text-slate-400 dark:text-slate-500">
          {t('docDigest.result.none', {
            defaultValue: 'AI 抽不到明顯重點，嘗試換 Pro 模型或補多些內容。',
          })}
        </p>
      )}
    </Card>
  )
}
