import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Compass,
  Target,
  AlertTriangle,
  ListOrdered,
  Users,
  SlidersHorizontal,
  ClipboardCheck,
  Trash2,
  Clock,
  NotebookPen,
  GraduationCap,
  FileText,
  Printer,
  Settings,
  Wand2,
  type LucideIcon,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FeatureGuide,
  Field,
  IconButton,
  PageHero,
  SegmentedControl,
  Select,
  Textarea,
  Tooltip,
  cx,
  type FeatureGuideStep,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { useSettings } from '../../../context/SettingsContext'
import { useNav } from '../../../context/NavContext'
import { useCollection } from '../../../lib/store'
import { complete, isAIConfigured, type AIModel } from '../../../lib/aiClient'
import { topicsCol } from '../../../data/collections'
import { getSubjectPack } from '../../../data/subjects'
import { downloadDocx, printDoc, type ExportBlock, type ExportDoc } from '../../../lib/export'
import { teachGuideCol, type GuideRecord } from './guideStore'
import { buildGuideSystem, parseGuide, isEmptyGuide, type GuideResult } from './prompts'
import CreditMeter from '../../../components/CreditMeter'

const MODEL_OPTIONS: { id: AIModel; label: string }[] = [
  { id: 'gemini-2.5-flash', label: 'Flash' },
  { id: 'gemini-2.5-pro', label: 'Pro' },
]

type BadgeTone = Parameters<typeof Badge>[0]['tone']

const SECTIONS: {
  key: keyof GuideResult
  label: string
  icon: LucideIcon
  tone: BadgeTone
  ordered?: boolean
}[] = [
  { key: 'keyPoints', label: '教學重點', icon: Target, tone: 'accent' },
  { key: 'misconceptions', label: '學生常見誤解', icon: AlertTriangle, tone: 'rose' },
  { key: 'steps', label: '建議教學步驟', icon: ListOrdered, tone: 'blue', ordered: true },
  { key: 'activities', label: '課堂活動', icon: Users, tone: 'green' },
  { key: 'differentiation', label: '差異化建議', icon: SlidersHorizontal, tone: 'amber' },
  { key: 'assessment', label: '評估方式', icon: ClipboardCheck, tone: 'slate' },
]

const GUIDE_STEPS: FeatureGuideStep[] = [
  { title: '選擇課題', desc: '在上方重新選擇今次想備課的課題；課題來自你的課程大綱。' },
  { title: '補充背景（選填）', desc: '可填班級程度、節數、想強調的角度，AI 會貼住來出。' },
  { title: '生成指引', desc: '一鍵出齊重點、學生常見誤解、教學步驟、活動、差異化同評估。' },
  { title: '下載或接落去', desc: '可匯出 Word／PDF，或直接跳去生成教材、教案或 DSE 操練。' },
]

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

export default function TeachGuide() {
  const { t } = useTranslation()
  const toast = useToast()
  const confirm = useConfirm()
  const nav = useNav()
  const { subjectPackId } = useSettings()
  const subjectName =
    subjectPackId !== 'custom' ? getSubjectPack(subjectPackId)?.name : undefined

  const allTopics = useCollection(topicsCol)
  const topics = useMemo(
    () => [...allTopics].sort((a, b) => a.order - b.order),
    [allTopics],
  )
  const records = useCollection(teachGuideCol)
  const history = useMemo(
    () => [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [records],
  )

  const [topicId, setTopicId] = useState<string>(() => topics[0]?.id ?? '')
  const [extra, setExtra] = useState('')
  const [model, setModel] = useState<AIModel>('gemini-2.5-flash')
  const [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState<GuideRecord | null>(null)

  async function run() {
    const topic = topics.find((t) => t.id === topicId) ?? topics[0]
    if (!topic) {
      toast.info('未有課題 — 可去設定選擇任教科目')
      return
    }
    setBusy(true)
    try {
      const raw = await complete({
        system: buildGuideSystem(subjectName),
        messages: [
          {
            role: 'user',
            content: `課題：${topic.topic}${extra.trim() ? `\n補充要求：${extra.trim()}` : ''}`,
          },
        ],
        model,
        temperature: 0.4,
        source: 'teach-guide',
      })
      const result = parseGuide(raw)
      if (isEmptyGuide(result)) {
        throw new Error('AI 出不到內容，嘗試換 Pro 或補充課題說明。')
      }
      const rec = teachGuideCol.add({
        createdAt: new Date().toISOString(),
        topicId: topic.id,
        topicName: topic.topic,
        model,
        ...result,
      })
      setCurrent(rec)
      toast.success('教學指引已生成')
    } catch (e) {
      toast.error((e as Error).message || '生成失敗，請再試。')
    } finally {
      setBusy(false)
    }
  }

  async function del(id: string) {
    const ok = await confirm({ title: '刪除此份指引？', tone: 'danger', confirmText: '刪除' })
    if (!ok) return
    teachGuideCol.remove(id)
    if (current?.id === id) setCurrent(null)
  }

  if (!isAIConfigured) {
    return (
      <div className="space-y-5">
        <PageHero
          guideKey="teachGuide"
          icon={Compass}
          kicker={t('teachGuide.kicker', { defaultValue: '教學設計' })}
          title={t('teachGuide.title', { defaultValue: '教學指引' })}
          description={t('teachGuide.subtitle', {
            defaultValue: '選擇一個課題，AI 協助整理「如何教」：重點、誤解、步驟、活動、差異化、評估。',
          })}
        />
        <EmptyState
          icon={Compass}
          title={t('teachGuide.aiOffTitle', { defaultValue: '教學指引暫時未能生成' })}
          hint={t('teachGuide.aiOffHint', {
            defaultValue:
              '生成服務暫時未連接，請稍後再試或聯絡管理員。',
          })}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHero
        icon={Compass}
        kicker={t('teachGuide.kicker', { defaultValue: '教學設計' })}
        title={t('teachGuide.title', { defaultValue: '教學指引' })}
        description={t('teachGuide.subtitle', {
          defaultValue: '選擇一個課題，AI 協助整理「如何教」：重點、誤解、步驟、活動、差異化、評估。',
        })}
      />

      <FeatureGuide
        storageKey="teachGuide"
        title={t('teachGuide.guideTitle', { defaultValue: '教學指引使用說明' })}
        steps={GUIDE_STEPS}
      />

      {topics.length === 0 ? (
        <EmptyState
          icon={Compass}
          title={t('teachGuide.noTopicTitle', { defaultValue: '尚未有課題' })}
          hint={t('teachGuide.noTopicHint', {
            defaultValue: '先去設定重新選擇你的任教科目，就會帶出課程大綱的課題給你備課。',
          })}
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={Settings}
              onClick={() => nav.open('__settings__')}
            >
              {t('teachGuide.goSettings', { defaultValue: '去設定選擇科目' })}
            </Button>
          }
        />
      ) : (
        <>
          {/* 輸入：選擇課題 → 補充 → 生成（純展示卡） */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
            <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
              <Wand2 size={13} />
              {t('teachGuide.composeHeading', { defaultValue: '生成教學指引' })}
            </div>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('teachGuide.topicLabel', { defaultValue: '課題' })}>
                  <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                    {topics.map((tp) => (
                      <option key={tp.id} value={tp.id}>
                        {tp.topic}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t('teachGuide.modelLabel', { defaultValue: '模型' })}>
                  <Tooltip label={t('teachGuide.modelHint', { defaultValue: 'Flash 快 · Pro 強' })}>
                    <SegmentedControl options={MODEL_OPTIONS} value={model} onChange={setModel} />
                  </Tooltip>
                </Field>
              </div>
              <Field
                label={t('teachGuide.extraLabel', { defaultValue: '補充（選填）' })}
                hint={t('teachGuide.extraHint', {
                  defaultValue: '例如班級程度、想強調的角度、節數',
                })}
              >
                <Textarea
                  rows={2}
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder={t('teachGuide.extraPlaceholder', {
                    defaultValue: '例：中四基礎班，2 節，想多些生活例子',
                  })}
                />
              </Field>
              <div className="flex items-center justify-end gap-3">
                <CreditMeter source="teach-guide" model={model} />
                <Button icon={Compass} onClick={run} loading={busy}>
                  {busy
                    ? t('teachGuide.generating', { defaultValue: '生成中…' })
                    : t('teachGuide.generate', { defaultValue: '生成指引' })}
                </Button>
              </div>
            </div>
          </section>

          {/* 接落去：跳去其他教材功能（純展示卡） */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
            <div className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
              <Compass size={13} />
              {t('teachGuide.nextSteps', { defaultValue: '接落去' })}
            </div>
            <p className="mb-3 text-[11px] text-slate-400 dark:text-slate-500">
              {t('teachGuide.nextStepsDesc', {
                defaultValue: '備課完，接住開教材、教案或 DSE 操練。',
              })}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={Compass}
                onClick={() => nav.open('work-generate')}
              >
                {t('teachGuide.toGenerate', { defaultValue: '教材生成' })}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={NotebookPen}
                onClick={() => nav.open('work-lesson-plan')}
              >
                {t('teachGuide.toLessonPlan', { defaultValue: '備課 / 教案' })}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={GraduationCap}
                onClick={() => nav.open('work-dse')}
              >
                {t('teachGuide.toDse', { defaultValue: 'DSE 操練' })}
              </Button>
            </div>
          </section>
        </>
      )}

      {/* 結果 */}
      {current && <GuideView rec={current} />}

      {/* 歷史 */}
      {history.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
            <Clock size={13} />
            {t('teachGuide.history', { defaultValue: '歷史' })}
            <span className="tabular-nums font-normal text-slate-400 dark:text-slate-500">
              · {history.length}
            </span>
          </div>
          <div className="space-y-2">
            {history.map((r) => {
              const active = current?.id === r.id
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setCurrent(r)}
                  aria-label={r.topicName}
                  aria-pressed={active}
                  className={cx(
                    'group flex min-h-14 w-full items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 text-left transition duration-200 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.99] dark:bg-slate-800 dark:hover:border-slate-600',
                    active
                      ? 'border-accent/40 ring-1 ring-accent/30'
                      : 'border-slate-200/80 dark:border-slate-700/60',
                  )}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                    <Compass size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                      {r.topicName}
                    </span>
                    <span className="mt-0.5 block text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                      {fmtDate(r.createdAt)}
                    </span>
                  </span>
                  <span onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      label={t('teachGuide.delete', { defaultValue: '刪除' })}
                      size="sm"
                      tone="danger"
                      className="min-h-11 min-w-11"
                      onClick={() => void del(r.id)}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {topics.length > 0 && history.length === 0 && !current && (
        <EmptyState
          icon={Compass}
          title={t('teachGuide.emptyTitle', { defaultValue: '未有教學指引' })}
          hint={t('teachGuide.emptyHint', {
            defaultValue: '在上方選擇一個課題，按「生成指引」建立第一份「如何教」備課。',
          })}
        />
      )}
    </div>
  )
}

function guideToDoc(rec: GuideRecord): ExportDoc {
  const blocks: ExportBlock[] = []
  for (const sec of SECTIONS) {
    const items = rec[sec.key]
    if (!items || items.length === 0) continue
    blocks.push({ kind: 'heading', text: sec.label, level: 1 })
    blocks.push(sec.ordered ? { kind: 'numbered', items } : { kind: 'bullets', items })
  }
  return { title: `${rec.topicName} — 教學指引`, blocks }
}

function GuideView({ rec }: { rec: GuideRecord }) {
  const toast = useToast()
  const dlWord = async () => {
    try {
      await downloadDocx(guideToDoc(rec))
      toast.success('已下載 Word')
    } catch (e) {
      toast.error((e as Error).message || '下載失敗')
    }
  }
  const dlPdf = () => {
    try {
      printDoc(guideToDoc(rec))
    } catch (e) {
      toast.error((e as Error).message || '列印失敗')
    }
  }
  return (
    <Card padded className="space-y-5 ring-1 ring-accent/20">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent" icon={Compass}>
          教學指引
        </Badge>
        <h2 className="min-w-0 flex-1 text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
          {rec.topicName}
        </h2>
        <Button variant="secondary" size="sm" icon={FileText} onClick={dlWord}>
          Word
        </Button>
        <Button variant="secondary" size="sm" icon={Printer} onClick={dlPdf}>
          PDF
        </Button>
      </div>

      {SECTIONS.map((sec) => {
        const items = rec[sec.key]
        if (!items || items.length === 0) return null
        const Ico = sec.icon
        return (
          <div key={sec.key}>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Ico size={15} className="text-accent" />
              {sec.label}
            </p>
            {sec.ordered ? (
              <ol className="space-y-1.5">
                {items.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-slate-700 dark:text-slate-200">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-strong dark:bg-accent/15 dark:text-accent">
                      {i + 1}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <ul className="space-y-1.5">
                {items.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </Card>
  )
}
