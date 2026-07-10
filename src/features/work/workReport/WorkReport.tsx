import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FileBarChart2,
  CalendarRange,
  Copy,
  Printer,
  FileText,
  Loader2,
  CheckCircle2,
  Clock,
  ListTodo,
  NotebookPen,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FeatureGuide,
  type FeatureGuideStep,
  PageHero,
  SegmentedControl,
  cx,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useCollection } from '../../../lib/store'
import { complete, isAIConfigured, type AIModel } from '../../../lib/aiClient'
import { classifyAIError } from '../../../lib/aiError'
import { eventsCol, tasksCol, meetingNotesCol } from '../../../data/collections'
import {
  downloadDocx,
  printDoc,
  type ExportBlock,
  type ExportDoc,
} from '../../../lib/export'
import {
  buildWorkReportSystem,
  buildWorkReportUser,
  parseWorkReport,
  type WorkReportResult,
} from './workReportPrompts'
import {
  resolveRange,
  aggregate,
  isEmptyAggregate,
  toKey,
  type RangePreset,
  type ResolvedRange,
  type AggregatedData,
} from './reportRange'
import CreditMeter from '../../../components/CreditMeter'

const MODEL_OPTS: { id: AIModel; label: string }[] = [
  { id: 'gemini-2.5-flash', label: 'Flash' },
  { id: 'gemini-2.5-pro', label: 'Pro' },
]

// 教學引導（3 步：選擇時段 → 一鍵生成 → 複製/列印/匯出）
const GUIDE_STEPS: FeatureGuideStep[] = [
  {
    title: '選擇一個時段',
    desc: '本週、本月，或者自訂日期範圍。下面立即見到那段時間有幾多事件、待辦同筆記。',
  },
  {
    title: '一鍵生成報告',
    desc: 'AI 會聚合你的 行事曆／待辦／會議筆記，撮要成「已完成事項 / 待跟進 / 重點同建議」一頁。',
  },
  {
    title: '複製、列印或匯出 Word',
    desc: '完成後可一鍵複製、列印，或出 Word 交給科主任 / 存底。',
  },
]

// YYYY-MM-DD → YYYY/MM/DD（顯示用）
function fmt(key: string): string {
  return key.replace(/-/g, '/')
}

function rangeLabel(r: ResolvedRange): string {
  return `${fmt(r.start)}–${fmt(r.end)}`
}

const PRESET_BADGE: Record<RangePreset, string> = {
  week: '週報',
  month: '月報',
  custom: '自訂',
}

export default function WorkReport() {
  const { t } = useTranslation()
  const toast = useToast()
  const events = useCollection(eventsCol)
  const tasks = useCollection(tasksCol)
  const notes = useCollection(meetingNotesCol)

  const today = toKey(new Date())
  const [preset, setPreset] = useState<RangePreset>('week')
  const [customStart, setCustomStart] = useState<string>(today)
  const [customEnd, setCustomEnd] = useState<string>(today)
  const [model, setModel] = useState<AIModel>('gemini-2.5-flash')
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<WorkReportResult | null>(null)
  const [reportRange, setReportRange] = useState<ResolvedRange | null>(null)
  const [reportPreset, setReportPreset] = useState<RangePreset>('week')
  const [error, setError] = useState<string | null>(null)

  // 即時聚合（不用等 AI）：給預覽小計 + 判斷零資料
  const range = useMemo(
    () => resolveRange(preset, customStart, customEnd),
    [preset, customStart, customEnd],
  )
  const agg = useMemo<AggregatedData>(
    () => aggregate(events, tasks, notes, range),
    [events, tasks, notes, range],
  )
  const isEmpty = isEmptyAggregate(agg)

  // 重試讀返最新 UI 選擇的時段／模型（避免閉包鎖死出錯嗰刻的舊值）。
  const latest = useRef({ agg, range, preset, model, isEmpty })
  latest.current = { agg, range, preset, model, isEmpty }

  async function run() {
    if (busy) return
    const { agg: a, range: r, preset: p, model: m, isEmpty: empty } = latest.current
    if (empty) {
      toast.error(
        t('workReport.empty.noRecords', {
          defaultValue: '這段時間沒有行事曆／待辦／會議紀錄，選擇闊些時段或先加資料。',
        }),
      )
      return
    }
    setBusy(true)
    setError(null)
    try {
      const raw = await complete({
        system: buildWorkReportSystem(),
        messages: [{ role: 'user', content: buildWorkReportUser(a, r) }],
        model: m,
        temperature: 0.3,
        source: 'work-report', // 不傳 feature → 走一般「每日」AI 額度桶
      })
      const result = parseWorkReport(raw)
      setReport(result)
      setReportRange(r)
      setReportPreset(p)
      toast.success(t('workReport.done', { defaultValue: '報告整好' }))
    } catch (e) {
      const info = classifyAIError(e)
      setError(info.message)
      toast.error(info.message, { label: t('common.retry', { defaultValue: '重試' }), onClick: run })
    } finally {
      setBusy(false)
    }
  }

  // ① AI 未設定
  if (!isAIConfigured) {
    return (
      <EmptyState
        icon={FileBarChart2}
        title={t('workReport.notReady.title', { defaultValue: '工作報告暫時未能生成' })}
        hint={t('workReport.notReady.hint', {
          defaultValue: '生成服務暫時未連接，請稍後再試或聯絡管理員。',
        })}
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* ───────── 頁首 ───────── */}
      <PageHero
        guideKey="work-report"
        icon={FileBarChart2}
        kicker={t('workReport.kicker', { defaultValue: '工作整理' })}
        title={t('workReport.title', { defaultValue: '工作週報／月報' })}
        description={t('workReport.subtitle', {
          defaultValue: '一鍵聚合你的行事曆、待辦同會議筆記，AI 撮要成一頁報告。',
        })}
      />

      {/* ───────── 教學引導 ───────── */}
      <FeatureGuide
        storageKey="work-report"
        title={t('workReport.guide.title', { defaultValue: '工作週報／月報使用說明' })}
        steps={GUIDE_STEPS}
      />

      {/* ───────── 時段表單 ───────── */}
      <Card padded className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedControl
            options={[
              { id: 'week' as RangePreset, label: t('workReport.preset.week', { defaultValue: '本週' }) },
              { id: 'month' as RangePreset, label: t('workReport.preset.month', { defaultValue: '本月' }) },
              { id: 'custom' as RangePreset, label: t('workReport.preset.custom', { defaultValue: '自訂' }) },
            ]}
            value={preset}
            onChange={setPreset}
          />
          <div className="flex items-center gap-1.5">
            <span
              className="text-[11px] font-medium text-slate-400 dark:text-slate-500"
              title={t('workReport.model.hint', {
                defaultValue: 'Flash = 快；Pro = 較詳細但慢些',
              })}
            >
              {t('workReport.model.label', { defaultValue: 'AI 模型' })}
            </span>
            <SegmentedControl
              size="sm"
              options={MODEL_OPTS}
              value={model}
              onChange={setModel}
            />
          </div>
        </div>

        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-h-11 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              {t('workReport.custom.from', { defaultValue: '由' })}
              <input
                type="date"
                value={customStart}
                max={customEnd < today ? customEnd : today}
                onChange={(e) => setCustomStart(e.target.value)}
                className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </label>
            <label className="flex min-h-11 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              {t('workReport.custom.to', { defaultValue: '至' })}
              <input
                type="date"
                value={customEnd}
                min={customStart}
                max={today}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </label>
          </div>
        )}

        {/* 即時聚合預覽（不用等 AI）*/}
        <div
          role="group"
          aria-label={t('workReport.preview.aria', {
            defaultValue: '{{range}}：事件 {{events}}、完成 {{done}}、未完成 {{open}}、筆記 {{notes}}',
            range: rangeLabel(range),
            events: agg.counts.events,
            done: agg.counts.done,
            open: agg.counts.open,
            notes: agg.counts.notes,
          })}
          className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-slate-50/60 px-3 py-2 text-[12px] text-slate-500 dark:bg-slate-800/40 dark:text-slate-400"
        >
          <span className="font-medium text-slate-600 dark:text-slate-300">{rangeLabel(range)}</span>
          <span className="inline-flex items-center gap-1">
            <CalendarRange size={13} />
            {t('workReport.preview.events', { defaultValue: '事件 {{n}}', n: agg.counts.events })}
          </span>
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 size={13} />
            {t('workReport.preview.done', { defaultValue: '完成 {{n}}', n: agg.counts.done })}
          </span>
          <span className="inline-flex items-center gap-1">
            <ListTodo size={13} />
            {t('workReport.preview.open', { defaultValue: '未完成 {{n}}', n: agg.counts.open })}
          </span>
          <span className="inline-flex items-center gap-1">
            <NotebookPen size={13} />
            {t('workReport.preview.notes', { defaultValue: '筆記 {{n}}', n: agg.counts.notes })}
          </span>
        </div>

        <div className="flex items-center justify-end gap-3">
          <CreditMeter source="work-report" model={model} />
          <Button
            icon={busy ? Loader2 : FileBarChart2}
            onClick={run}
            loading={busy}
            disabled={isEmpty}
          >
            {busy
              ? t('workReport.action.running', { defaultValue: '整緊…' })
              : t('workReport.action.run', { defaultValue: '生成報告' })}
          </Button>
        </div>
        {busy && (
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
            {t('workReport.action.wait', { defaultValue: '整理緊你的紀錄…' })}
          </p>
        )}
      </Card>

      {/* ───────── 失敗（常駐 inline，不靠 toast）───────── */}
      {error && (
        <Card padded className="ring-1 ring-rose-300/40 dark:ring-rose-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-500" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t('workReport.error.title', { defaultValue: '生成失敗' })}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{error}</p>
              <Button variant="secondary" size="sm" icon={FileBarChart2} onClick={run} disabled={busy}>
                {t('common.retry', { defaultValue: '重試' })}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ───────── 結果 ───────── */}
      {report && reportRange && (
        <ResultCard report={report} range={reportRange} preset={reportPreset} agg={agg} />
      )}

      {/* ───────── 空狀態（出錯 / 已有結果時不顯示）───────── */}
      {!report && !error && isEmpty && (
        <EmptyState
          icon={CalendarRange}
          title={t('workReport.zero.title', { defaultValue: '這段時間沒有紀錄' })}
          hint={t('workReport.zero.hint', {
            defaultValue: '這段時間沒有行事曆／待辦／會議紀錄，選擇闊些時段或先加資料再生成。',
          })}
          action={
            preset !== 'month' ? (
              <Button variant="secondary" size="sm" icon={CalendarRange} onClick={() => setPreset('month')}>
                {t('workReport.zero.tryMonth', { defaultValue: '改為本月' })}
              </Button>
            ) : undefined
          }
        />
      )}
      {!report && !error && !isEmpty && (
        <EmptyState
          icon={FileBarChart2}
          title={t('workReport.prompt.title', { defaultValue: '準備好生成報告' })}
          hint={t('workReport.prompt.hint', {
            defaultValue: '按上面「生成報告」，AI 立即幫你撮要成「已完成事項 / 待跟進 / 重點同建議」。',
          })}
        />
      )}
    </div>
  )
}

// ───────── ExportDoc 組裝（複製 / 列印 / Word 共用）─────────
function reportToDoc(report: WorkReportResult, range: ResolvedRange, preset: RangePreset): ExportDoc {
  const blocks: ExportBlock[] = []
  if (report.done.length) {
    blocks.push({ kind: 'heading', text: '已完成事項', level: 1 })
    blocks.push({ kind: 'bullets', items: report.done })
  }
  if (report.followUps.length) {
    blocks.push({ kind: 'heading', text: '待跟進', level: 1 })
    blocks.push({ kind: 'bullets', items: report.followUps })
  }
  if (report.highlights.length) {
    blocks.push({ kind: 'heading', text: '重點同建議', level: 1 })
    blocks.push({ kind: 'bullets', items: report.highlights })
  }
  return { title: `${PRESET_BADGE[preset]} ${rangeLabel(range)}`, blocks }
}

// 三段語意色（已完成事項=accent、待跟進=amber、重點同建議=emerald）
const DOT_TONE = {
  accent: 'bg-accent',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
} as const

function ResultCard({
  report,
  range,
  preset,
  agg,
}: {
  report: WorkReportResult
  range: ResolvedRange
  preset: RangePreset
  agg: AggregatedData
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const doc = useMemo(() => reportToDoc(report, range, preset), [report, range, preset])

  const copyAll = async () => {
    const md = doc.blocks
      .map((b) =>
        b.kind === 'heading'
          ? `\n【${b.text}】`
          : b.kind === 'bullets'
            ? b.items.map((i) => `• ${i}`).join('\n')
            : b.kind === 'paragraph'
              ? b.text
              : '',
      )
      .join('\n')
    const text = `${doc.title}\n${md}`.trim()
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no-clipboard')
      await navigator.clipboard.writeText(text)
      toast.success(t('workReport.result.copyOk', { defaultValue: '已複製' }))
    } catch {
      toast.error(
        t('workReport.result.copyFail', {
          defaultValue: '複製不到（瀏覽器不支援或沒有權限），請手動選取內文複製。',
        }),
      )
    }
  }

  const print = () => {
    try {
      printDoc(doc)
    } catch (e) {
      toast.error(
        (e as Error).message || t('workReport.result.printFail', { defaultValue: '列印失敗，請再試。' }),
      )
    }
  }

  const dlWord = async () => {
    try {
      await downloadDocx(doc)
      toast.success(t('workReport.result.dlOk', { defaultValue: '已下載 Word' }))
    } catch (e) {
      toast.error((e as Error).message || t('workReport.result.dlFail', { defaultValue: '下載失敗' }))
    }
  }

  const Section = ({
    title,
    items,
    tone,
  }: {
    title: string
    items: string[]
    tone: keyof typeof DOT_TONE
  }) =>
    items.length === 0 ? null : (
      <div>
        <p className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{title}</p>
        <ul className="space-y-1.5">
          {items.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-slate-700 dark:text-slate-200">
              <span className={cx('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', DOT_TONE[tone])} />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>
    )

  const allEmpty =
    report.done.length === 0 && report.followUps.length === 0 && report.highlights.length === 0

  return (
    <Card padded className="space-y-4 ring-1 ring-accent/20">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent" icon={FileBarChart2}>
          {PRESET_BADGE[preset]}
        </Badge>
        <h2 className="min-w-0 flex-1 text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
          {rangeLabel(range)}
        </h2>
        <Button variant="secondary" size="sm" icon={Copy} onClick={copyAll}>
          {t('workReport.result.copy', { defaultValue: '複製' })}
        </Button>
        <Button variant="secondary" size="sm" icon={Printer} onClick={print}>
          {t('workReport.result.print', { defaultValue: '列印' })}
        </Button>
        <Button variant="secondary" size="sm" icon={FileText} onClick={dlWord}>
          {t('workReport.result.word', { defaultValue: 'Word' })}
        </Button>
      </div>

      <Section
        title={t('workReport.section.done', { defaultValue: '已完成事項' })}
        items={report.done}
        tone="accent"
      />
      <Section
        title={t('workReport.section.followUps', { defaultValue: '待跟進' })}
        items={report.followUps}
        tone="amber"
      />
      <Section
        title={t('workReport.section.highlights', { defaultValue: '重點同建議' })}
        items={report.highlights}
        tone="emerald"
      />

      {allEmpty && (
        <div className="flex min-h-11 items-center gap-2.5 rounded-xl bg-slate-50/60 px-3 py-2.5 text-sm text-slate-400 dark:bg-slate-800/40 dark:text-slate-500">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400 dark:bg-slate-700/70">
            <Clock size={16} />
          </span>
          {t('workReport.result.noPoints', {
            defaultValue: '今次撮不到明顯重點，可展開下面原始紀錄核對。',
          })}
        </div>
      )}

      {/* 原始聚合清單（核對用）*/}
      <details className="group rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-700/60 dark:bg-slate-800/40">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-slate-500 transition hover:bg-white hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-slate-200">
          <ChevronRight
            size={14}
            className="shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-90"
          />
          {t('workReport.result.rawTitle', { defaultValue: '原始紀錄（核對用）' })}
        </summary>
        <div className="mt-3 space-y-3">
          <RawList
            icon={CalendarRange}
            label={t('workReport.raw.events', { defaultValue: '行事曆事件' })}
            items={agg.events.map((e) => `${e.title || '（無題）'}（${e.date}${e.type ? ` · ${e.type}` : ''}）`)}
          />
          <RawList
            icon={CheckCircle2}
            label={t('workReport.raw.done', { defaultValue: '已完成待辦' })}
            items={agg.tasksDone.map((tk) => tk.text)}
          />
          <RawList
            icon={ListTodo}
            label={t('workReport.raw.open', { defaultValue: '未完成待辦' })}
            items={agg.tasksOpen.map((tk) => tk.text)}
          />
          <RawList
            icon={NotebookPen}
            label={t('workReport.raw.notes', { defaultValue: '會議筆記／跟進' })}
            items={agg.notes.map((n) => `${n.title || '（無題）'}（${n.date}）`)}
          />
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {t('workReport.raw.note', { defaultValue: '備註：待辦以建立日期計，並非完成日期。' })}
          </p>
        </div>
      </details>
    </Card>
  )
}

function RawList({
  icon: IconCmp,
  label,
  items,
}: {
  icon: typeof CalendarRange
  label: string
  items: string[]
}) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 dark:text-slate-400">
        <IconCmp size={13} />
        {label}（{items.length}）
      </p>
      <ul className="space-y-0.5 pl-4">
        {items.map((it, i) => (
          <li key={i} className="list-disc text-[12px] text-slate-500 dark:text-slate-400">
            {it}
          </li>
        ))}
      </ul>
    </div>
  )
}
