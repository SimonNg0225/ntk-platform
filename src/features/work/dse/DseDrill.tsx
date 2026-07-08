import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  GraduationCap,
  Sparkles,
  FileText,
  Trash2,
  Clock,
  CalendarClock,
  Target,
  Settings,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FeatureGuide,
  Field,
  IconButton,
  Input,
  PageHero,
  SectionTitle,
  SegmentedControl,
  Select,
  cx,
  type FeatureGuideStep,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { useSettings } from '../../../context/SettingsContext'
import { useCollection } from '../../../lib/store'
import { complete, isAIConfigured, type AIModel } from '../../../lib/aiClient'
import { classifyAIError } from '../../../lib/aiError'
import { topicsCol } from '../../../data/collections'
import type { Difficulty } from '../../../data/types'
import { getSubjectPack } from '../../../data/subjects'
import { downloadDocx, type ExportBlock, type ExportDoc } from '../../../lib/export'
import { dseCol, getDseDate, setDseDate, type DseRecord } from './dseStore'
import { buildDseSystem, parseDse, DSE_PAPERS, type DsePaper } from './dsePrompts'
import CreditMeter from '../../../components/CreditMeter'

const DIFF_OPTS: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: '淺' },
  { id: 'medium', label: '中' },
  { id: 'hard', label: '深' },
]
const MODEL_OPTS: { id: AIModel; label: string }[] = [
  { id: 'gemini-2.5-flash', label: 'Flash' },
  { id: 'gemini-2.5-pro', label: 'Pro' },
]

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return ''
  }
}
function daysLeft(dateStr: string): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(target.getTime())) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / 86400000)
}

export default function DseDrill() {
  const { t } = useTranslation()
  const toast = useToast()
  const confirm = useConfirm()
  const { subjectPackId } = useSettings()
  const subjectName = subjectPackId !== 'custom' ? getSubjectPack(subjectPackId)?.name : undefined

  const allTopics = useCollection(topicsCol)
  const topics = useMemo(() => [...allTopics].sort((a, b) => a.order - b.order), [allTopics])
  const records = useCollection(dseCol)
  const history = useMemo(
    () => [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [records],
  )

  const [topicId, setTopicId] = useState<string>(() => topics[0]?.id ?? '')
  const [paper, setPaper] = useState<DsePaper>('mc')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [count, setCount] = useState(5)
  const [model, setModel] = useState<AIModel>('gemini-2.5-flash')
  const [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState<DseRecord | null>(null)
  const [dseDate, setDseDateState] = useState<string>(() => getDseDate())

  const dleft = daysLeft(dseDate)

  async function run() {
    const topic = topics.find((t) => t.id === topicId) ?? topics[0]
    if (!topic) {
      toast.info('未有課題 — 可去設定選擇任教科目')
      return
    }
    setBusy(true)
    try {
      const raw = await complete({
        system: buildDseSystem(subjectName, paper, difficulty, count),
        messages: [{ role: 'user', content: `課題：${topic.topic}` }],
        model,
        temperature: 0.5,
        source: 'dse-drill',
      })
      const questions = parseDse(raw)
      const rec = dseCol.add({
        createdAt: new Date().toISOString(),
        topicName: topic.topic,
        paper,
        model,
        questions,
      })
      setCurrent(rec)
      toast.success(`已生成 ${questions.length} 題`)
    } catch (e) {
      toast.error(classifyAIError(e).message, { label: '重試', onClick: run })
    } finally {
      setBusy(false)
    }
  }

  async function del(id: string) {
    const ok = await confirm({ title: '刪除此套操練？', tone: 'danger', confirmText: '刪除' })
    if (!ok) return
    dseCol.remove(id)
    if (current?.id === id) setCurrent(null)
  }

  if (!isAIConfigured) {
    return (
      <EmptyState
        icon={GraduationCap}
        title={t('dse.disabled.title', { defaultValue: 'DSE 操練未啟用' })}
        hint={t('dse.disabled.hint', {
          defaultValue: '要在設定接好 AI（Supabase + gemini Edge Function）先用到出題。',
        })}
      />
    )
  }

  const noTopics = topics.length === 0
  const GUIDE_STEPS: FeatureGuideStep[] = [
    {
      title: t('dse.guide.s1.title', { defaultValue: '選擇課題同卷別' }),
      desc: t('dse.guide.s1.desc', {
        defaultValue: '在下方重新選擇要操練的課題，再選擇卷別（選擇題／短答／長題）。',
      }),
    },
    {
      title: t('dse.guide.s2.title', { defaultValue: '調難度同數量' }),
      desc: t('dse.guide.s2.desc', {
        defaultValue: '選擇淺／中／深同題數；想快用 Flash，想深些就選擇 Pro。',
      }),
    },
    {
      title: t('dse.guide.s3.title', { defaultValue: '一鍵出題' }),
      desc: t('dse.guide.s3.desc', {
        defaultValue: '按「出 DSE 題」，即出公開試風格題目連評分要點同達標提示。',
      }),
    },
    {
      title: t('dse.guide.s4.title', { defaultValue: '下載／溫故' }),
      desc: t('dse.guide.s4.desc', {
        defaultValue: '可下載做 Word 卷；舊操練會存落「歷史」隨時翻查看。',
      }),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHero
        guideKey="dse-drill"
        icon={GraduationCap}
        kicker={t('dse.kicker', { defaultValue: '公開試 · DSE' })}
        title={t('dse.title', { defaultValue: 'DSE 操練' })}
        description={t('dse.subtitle', {
          defaultValue: '按課題出 DSE 公開試風格題目，連評分要點同達標提示。',
        })}
        actions={
          // DSE 倒數：狀態 chip + 日期輸入（紫底適配）
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span
              aria-live="polite"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm"
            >
              <CalendarClock size={13} className="shrink-0" />
              {dleft != null && dleft >= 0 ? (
                <span>
                  {t('dse.countdown.left', { defaultValue: '距離 DSE 還有' })}{' '}
                  <span className="tabular-nums slashed-zero">{dleft}</span>{' '}
                  {t('dse.countdown.days', { defaultValue: '日' })}
                </span>
              ) : dleft != null ? (
                <span>{t('dse.countdown.past', { defaultValue: 'DSE 已過' })}（{dseDate}）</span>
              ) : (
                <span>{t('dse.countdown.set', { defaultValue: '設定 DSE 日期查看倒數' })}</span>
              )}
            </span>
            <Input
              type="date"
              value={dseDate}
              aria-label={t('dse.countdown.dateLabel', { defaultValue: 'DSE 考試日期' })}
              onChange={(e) => {
                setDseDateState(e.target.value)
                setDseDate(e.target.value)
              }}
              className="max-w-[10rem] border-white/30 bg-white/15 text-white placeholder:text-white/60 [color-scheme:dark]"
            />
          </div>
        }
      />

      {/* 教學引導 */}
      <FeatureGuide
        storageKey="dse-drill"
        title={t('dse.guide.title', { defaultValue: 'DSE 操練使用說明' })}
        steps={GUIDE_STEPS}
      />

      {/* 出題設定 */}
      <section>
        <SectionTitle icon={Settings}>
          {t('dse.setup.title', { defaultValue: '出題設定' })}
        </SectionTitle>
        <Card className="space-y-4 rounded-2xl border border-slate-200/80 p-4 dark:border-slate-700/60">
          {noTopics ? (
            <GuidedEmpty
              icon={GraduationCap}
              title={t('dse.empty.noTopics.title', { defaultValue: '未有課題' })}
              hint={t('dse.empty.noTopics.hint', {
                defaultValue: '去設定重新選擇任教科目，就會帶入該科課題，之後即可出題。',
              })}
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('dse.field.topic', { defaultValue: '課題' })}>
                  <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                    {topics.map((tp) => (
                      <option key={tp.id} value={tp.id}>
                        {tp.topic}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t('dse.field.paper', { defaultValue: '卷別 / 題型' })}>
                  <SegmentedControl options={DSE_PAPERS} value={paper} onChange={setPaper} />
                </Field>
                <Field label={t('dse.field.difficulty', { defaultValue: '難度' })}>
                  <SegmentedControl options={DIFF_OPTS} value={difficulty} onChange={setDifficulty} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('dse.field.count', { defaultValue: '數量' })}>
                    <Select value={String(count)} onChange={(e) => setCount(Number(e.target.value))}>
                      {[3, 5, 8, 10].map((n) => (
                        <option key={n} value={n}>
                          {n} {t('dse.field.countUnit', { defaultValue: '題' })}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t('dse.field.model', { defaultValue: '模型' })}>
                    <SegmentedControl size="sm" options={MODEL_OPTS} value={model} onChange={setModel} />
                  </Field>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3">
                <CreditMeter source="dse-drill" model={model} />
                <Button icon={Sparkles} onClick={run} loading={busy}>
                  {busy
                    ? t('dse.cta.busy', { defaultValue: '出題中…' })
                    : t('dse.cta.run', { defaultValue: '出 DSE 題' })}
                </Button>
              </div>
            </>
          )}
        </Card>
      </section>

      {current && <DseView rec={current} />}

      {history.length > 0 && (
        <section>
          <SectionTitle icon={Clock}>{t('dse.history.title', { defaultValue: '歷史' })}</SectionTitle>
          <div className="space-y-2">
            {history.map((r) => {
              const active = current?.id === r.id
              return (
                <div
                  key={r.id}
                  className={cx(
                    'group flex items-center gap-2.5 rounded-2xl border bg-white p-3 transition duration-200 hover:border-slate-300 hover:shadow-md dark:bg-slate-800 dark:hover:border-slate-600',
                    active
                      ? 'border-accent/40 ring-1 ring-accent/30 dark:border-accent/40'
                      : 'border-slate-200/80 dark:border-slate-700/60',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setCurrent(r)}
                    aria-label={t('dse.history.open', { defaultValue: '開啟操練：' }) + r.topicName}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    <Badge tone="accent">
                      {DSE_PAPERS.find((p) => p.id === r.paper)?.label ?? r.paper}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                      {r.topicName}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                      {fmtDate(r.createdAt)} · {r.questions.length} {t('dse.field.countUnit', { defaultValue: '題' })}
                    </span>
                  </button>
                  <IconButton label={t('common.delete', { defaultValue: '刪除' })} size="sm" tone="danger" onClick={() => void del(r.id)}>
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {history.length === 0 && !current && !noTopics && (
        <section>
          <GuidedEmpty
            icon={Sparkles}
            tone="accent"
            title={t('dse.empty.noDrill.title', { defaultValue: '未有操練' })}
            hint={t('dse.empty.noDrill.hint', {
              defaultValue: '選擇好上面的課題同設定，按「出 DSE 題」整第一套。',
            })}
          />
        </section>
      )}
    </div>
  )
}

// 卡內引導式空狀態：圓形 icon 章 + 標題 + 提示（情感對應 tone）。
function GuidedEmpty({
  icon: I,
  title,
  hint,
  tone = 'slate',
}: {
  icon: typeof GraduationCap
  title: string
  hint?: string
  tone?: 'slate' | 'accent'
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <span
        className={cx(
          'flex h-12 w-12 items-center justify-center rounded-full',
          tone === 'accent'
            ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
            : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
        )}
      >
        <I size={22} strokeWidth={1.75} />
      </span>
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>
      {hint && <p className="max-w-xs text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  )
}

function dseToDoc(rec: DseRecord): ExportDoc {
  const blocks: ExportBlock[] = []
  rec.questions.forEach((q, i) => {
    blocks.push({ kind: 'heading', text: `第 ${i + 1} 題（${q.marks} 分）`, level: 2 })
    blocks.push({ kind: 'paragraph', text: q.stem })
    if (q.options && q.options.length) {
      blocks.push({
        kind: 'bullets',
        items: q.options.map(
          (o, oi) => `${String.fromCharCode(65 + oi)}. ${o}${oi === q.answerIndex ? '（答案）' : ''}`,
        ),
      })
    }
    if (q.markingPoints.length) {
      blocks.push({ kind: 'paragraph', text: '評分要點：' })
      blocks.push({ kind: 'bullets', items: q.markingPoints })
    }
    if (q.levelHint) blocks.push({ kind: 'paragraph', text: `達標提示：${q.levelHint}` })
  })
  return { title: `DSE 操練：${rec.topicName}`, blocks }
}

function DseView({ rec }: { rec: DseRecord }) {
  const { t } = useTranslation()
  const toast = useToast()
  const dlWord = async () => {
    try {
      await downloadDocx(dseToDoc(rec))
      toast.success(t('dse.view.downloaded', { defaultValue: '已下載 Word' }))
    } catch (e) {
      toast.error((e as Error).message || t('dse.view.downloadFail', { defaultValue: '下載失敗' }))
    }
  }
  return (
    <section>
      <SectionTitle icon={Sparkles}>
        {t('dse.view.title', { defaultValue: '今次操練' })}
      </SectionTitle>
      <Card className="space-y-4 rounded-2xl border border-accent/40 p-4 ring-1 ring-accent/20 dark:border-accent/40">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent" icon={GraduationCap}>
            {rec.questions.length} {t('dse.field.countUnit', { defaultValue: '題' })}
          </Badge>
          <h2 className="min-w-0 flex-1 text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            {rec.topicName}
          </h2>
          <Button variant="secondary" size="sm" icon={FileText} onClick={dlWord}>
            {t('dse.view.word', { defaultValue: 'Word' })}
          </Button>
        </div>
        <div className="space-y-3">
          {rec.questions.map((q, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-700/60 dark:bg-slate-800/40"
            >
              <div className="flex items-start gap-2">
                <span className="text-xs font-semibold tabular-nums text-slate-400">{i + 1}</span>
                <p className="min-w-0 flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{q.stem}</p>
                <Badge tone="slate">
                  <span className="tabular-nums">{q.marks}</span> {t('dse.view.marks', { defaultValue: '分' })}
                </Badge>
              </div>
              {q.options && q.options.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 pl-6">
                  {q.options.map((o, oi) => (
                    <li
                      key={oi}
                      className={cx(
                        'text-xs',
                        oi === q.answerIndex
                          ? 'font-medium text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400',
                      )}
                    >
                      {String.fromCharCode(65 + oi)}. {o}
                      {oi === q.answerIndex && ' ✓'}
                    </li>
                  ))}
                </ul>
              )}
              {q.markingPoints.length > 0 && (
                <div className="mt-2 pl-6">
                  <p className="text-[11px] font-semibold text-slate-400">
                    {t('dse.view.markingPoints', { defaultValue: '評分要點' })}
                  </p>
                  <ul className="mt-0.5 space-y-0.5">
                    {q.markingPoints.map((p, pi) => (
                      <li key={pi} className="flex gap-1.5 text-[13px] text-slate-600 dark:text-slate-300">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent/60" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {q.levelHint && (
                <p className="mt-1.5 flex items-start gap-1.5 pl-6 text-[11px] text-accent-strong dark:text-accent">
                  <Target size={12} className="mt-0.5 shrink-0" />
                  {t('dse.view.levelHint', { defaultValue: '達標' })}：{q.levelHint}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </section>
  )
}
