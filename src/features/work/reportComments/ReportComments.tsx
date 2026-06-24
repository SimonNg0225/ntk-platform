import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MessageSquareQuote,
  Sparkles,
  FileText,
  Copy,
  RefreshCw,
  Loader2,
  SlidersHorizontal,
  Users,
  ListChecks,
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
  SectionTitle,
  SegmentedControl,
  Select,
  Textarea,
  Tooltip,
  type FeatureGuideStep,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useSettings } from '../../../context/SettingsContext'
import { useCollection } from '../../../lib/store'
import { complete, isAIConfigured, type AIModel } from '../../../lib/aiClient'
import { classesCol, studentsCol, assessmentsCol, scoresCol } from '../../../data/collections'
import { getSubjectPack } from '../../../data/subjects'
import { downloadDocx, type ExportBlock, type ExportDoc } from '../../../lib/export'
import {
  buildCommentSystem,
  parseComments,
  type CommentLang,
  type CommentLength,
  type CommentTone,
} from './commentPrompts'

const TONE_OPTS: { id: CommentTone; label: string }[] = [
  { id: 'encourage', label: '鼓勵' },
  { id: 'balanced', label: '中肯' },
  { id: 'strict', label: '嚴謹' },
]
const LANG_OPTS: { id: CommentLang; label: string }[] = [
  { id: 'zh', label: '中文' },
  { id: 'en', label: 'English' },
]
const LEN_OPTS: { id: CommentLength; label: string }[] = [
  { id: 'short', label: '短' },
  { id: 'medium', label: '中' },
]
const MODEL_OPTS: { id: AIModel; label: string }[] = [
  { id: 'gemini-2.5-flash', label: 'Flash' },
  { id: 'gemini-2.5-pro', label: 'Pro' },
]

export default function ReportComments() {
  const { t } = useTranslation()
  const toast = useToast()
  const { subjectPackId } = useSettings()
  const subjectName = subjectPackId !== 'custom' ? getSubjectPack(subjectPackId)?.name : undefined

  const classes = useCollection(classesCol)
  const allStudents = useCollection(studentsCol)
  const allAssessments = useCollection(assessmentsCol)
  const scores = useCollection(scoresCol)

  const [classId, setClassId] = useState<string>(() => classes[0]?.id ?? '')
  const [tone, setTone] = useState<CommentTone>('balanced')
  const [lang, setLang] = useState<CommentLang>('zh')
  const [length, setLength] = useState<CommentLength>('medium')
  const [model, setModel] = useState<AIModel>('gemini-2.5-flash')
  const [busy, setBusy] = useState(false)
  const [regenIdx, setRegenIdx] = useState<number | null>(null)
  const [comments, setComments] = useState<string[]>([])

  const klass = classes.find((c) => c.id === classId) ?? classes[0]
  const students = useMemo(
    () =>
      allStudents
        .filter((s) => s.classId === klass?.id)
        .sort((a, b) =>
          (a.studentNo ?? '').localeCompare(b.studentNo ?? '') || a.name.localeCompare(b.name),
        ),
    [allStudents, klass?.id],
  )
  const assessments = useMemo(
    () => allAssessments.filter((a) => a.classId === klass?.id),
    [allAssessments, klass?.id],
  )

  const data = useMemo(
    () =>
      students.map((st) => {
        const per = assessments.map((a) => {
          const sc = scores.find((x) => x.assessmentId === a.id && x.studentId === st.id)
          const pct = sc && sc.score != null && a.maxScore > 0 ? (sc.score / a.maxScore) * 100 : null
          return { name: a.name, pct }
        })
        const done = per.filter((p): p is { name: string; pct: number } => p.pct != null)
        const overall = done.length ? done.reduce((s, p) => s + p.pct, 0) / done.length : null
        return { student: st, done, overall, submitted: done.length, expected: assessments.length }
      }),
    [students, assessments, scores],
  )

  // 換班 → 清空評語
  useEffect(() => {
    setComments([])
  }, [klass?.id])

  function summaryLine(i: number, d: (typeof data)[number]): string {
    const parts = [`${i}. ${d.student.name}`]
    parts.push(d.overall != null ? `總平均 ${Math.round(d.overall)}%` : '暫未有分數')
    parts.push(`已交 ${d.submitted}/${d.expected}`)
    if (d.done.length > 0) {
      const top = d.done.reduce((a, b) => (b.pct > a.pct ? b : a))
      const low = d.done.reduce((a, b) => (b.pct < a.pct ? b : a))
      parts.push(`最強：${top.name} ${Math.round(top.pct)}%`)
      if (low.name !== top.name) parts.push(`待加強：${low.name} ${Math.round(low.pct)}%`)
    }
    return parts.join('，')
  }

  async function runAll() {
    if (busy || students.length === 0) return
    setBusy(true)
    try {
      const content = data.map((d, i) => summaryLine(i + 1, d)).join('\n')
      const raw = await complete({
        system: buildCommentSystem({ tone, lang, length, subjectName }),
        messages: [{ role: 'user', content }],
        model,
        temperature: 0.5,
        source: 'report-comments',
      })
      setComments(parseComments(raw, students.length))
      toast.success('全班評語已生成')
    } catch (e) {
      toast.error((e as Error).message || '生成失敗，請再試。')
    } finally {
      setBusy(false)
    }
  }

  async function regenOne(i: number) {
    if (regenIdx != null || busy) return
    setRegenIdx(i)
    try {
      const raw = await complete({
        system: buildCommentSystem({ tone, lang, length, subjectName }),
        messages: [{ role: 'user', content: summaryLine(1, data[i]) }],
        model,
        temperature: 0.7,
        source: 'report-comments',
      })
      const one = parseComments(raw, 1)[0]
      if (one) {
        setComments((prev) => {
          const next = [...prev]
          next[i] = one
          return next
        })
      }
    } catch (e) {
      toast.error((e as Error).message || '重生失敗')
    } finally {
      setRegenIdx(null)
    }
  }

  function editComment(i: number, v: string) {
    setComments((prev) => {
      const next = [...prev]
      next[i] = v
      return next
    })
  }

  const hasComments = comments.some((c) => c.trim())

  function copyAll() {
    const text = students
      .map((s, i) => (comments[i]?.trim() ? `${s.name}\n${comments[i].trim()}` : ''))
      .filter(Boolean)
      .join('\n\n')
    if (!text) return
    void navigator.clipboard?.writeText(text)
    toast.success('已複製全部')
  }

  async function exportWord() {
    const blocks: ExportBlock[] = []
    students.forEach((s, i) => {
      const c = comments[i]?.trim()
      if (!c) return
      blocks.push({ kind: 'heading', text: s.name, level: 2 })
      blocks.push({ kind: 'paragraph', text: c })
    })
    if (blocks.length === 0) return
    const doc: ExportDoc = { title: `${klass?.name ?? ''} 成績表評語`, blocks }
    try {
      await downloadDocx(doc)
      toast.success('已下載 Word')
    } catch (e) {
      toast.error((e as Error).message || '下載失敗')
    }
  }

  // 教學引導步驟（廣東話 inline，唔改 i18n 檔）
  const GUIDE: FeatureGuideStep[] = [
    {
      title: t('reportComments.guide1Title', { defaultValue: '揀班別' }),
      desc: t('reportComments.guide1Desc', {
        defaultValue: '揀返要出評語嗰班；AI 會讀返該班每個學生嘅成績同進度。',
      }),
    },
    {
      title: t('reportComments.guide2Title', { defaultValue: '調語氣同長度' }),
      desc: t('reportComments.guide2Desc', {
        defaultValue: '揀鼓勵 / 中肯 / 嚴謹、中英、長短；撳「生成全班評語」一次過出齊。',
      }),
    },
    {
      title: t('reportComments.guide3Title', { defaultValue: '微調再匯出' }),
      desc: t('reportComments.guide3Desc', {
        defaultValue: '逐個改字、唔啱可重生；滿意就複製全部或下載做 Word。',
      }),
    },
  ]

  if (!isAIConfigured) {
    return (
      <EmptyState
        icon={MessageSquareQuote}
        title={t('reportComments.aiOffTitle', { defaultValue: '成績表評語未啟用' })}
        hint={t('reportComments.aiOffHint', {
          defaultValue: '要設定好 Supabase 並部署 gemini Edge Function 先用到。',
        })}
      />
    )
  }
  if (classes.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={t('reportComments.noClassTitle', { defaultValue: '未有班別' })}
        hint={t('reportComments.noClassHint', {
          defaultValue: '先去「班別管理」開班、加學生，再去「成績管理」入分，就可以一鍵出評語。',
        })}
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* 頁首 */}
      <PageHero
        guideKey="report-comments"
        icon={MessageSquareQuote}
        kicker={t('reportComments.kicker', { defaultValue: 'Report Comments' })}
        title={t('reportComments.title', { defaultValue: '成績表評語' })}
        description={t('reportComments.subtitle', {
          defaultValue: '揀班，AI 按每個學生成績一次過寫全班評語，可逐個微調、重生，再匯出 Word。',
        })}
      />

      {/* 教學引導 */}
      <FeatureGuide
        storageKey="report-comments"
        title={t('reportComments.guideTitle', { defaultValue: '成績表評語點用？' })}
        steps={GUIDE}
      />

      {/* 設定 */}
      <section>
        <SectionTitle icon={SlidersHorizontal}>
          {t('reportComments.settingsTitle', { defaultValue: '生成設定' })}
        </SectionTitle>
        <Card padded className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('reportComments.fieldClass', { defaultValue: '班別' })}>
              <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}（{allStudents.filter((s) => s.classId === c.id).length} 人）
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('reportComments.fieldModel', { defaultValue: '模型' })}>
              <Tooltip label={t('reportComments.modelHint', { defaultValue: 'Flash 快 · Pro 強' })}>
                <SegmentedControl options={MODEL_OPTS} value={model} onChange={setModel} />
              </Tooltip>
            </Field>
            <Field label={t('reportComments.fieldTone', { defaultValue: '語氣' })}>
              <SegmentedControl options={TONE_OPTS} value={tone} onChange={setTone} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('reportComments.fieldLang', { defaultValue: '語言' })}>
                <SegmentedControl options={LANG_OPTS} value={lang} onChange={setLang} />
              </Field>
              <Field label={t('reportComments.fieldLength', { defaultValue: '長度' })}>
                <SegmentedControl options={LEN_OPTS} value={length} onChange={setLength} />
              </Field>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
            <span className="inline-flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Users size={13} className="shrink-0" />
                <span className="tabular-nums slashed-zero">{students.length}</span>{' '}
                {t('reportComments.studentsUnit', { defaultValue: '個學生' })}
              </span>
              <span className="inline-flex items-center gap-1">
                <ListChecks size={13} className="shrink-0" />
                <span className="tabular-nums slashed-zero">{assessments.length}</span>{' '}
                {t('reportComments.assessmentsUnit', { defaultValue: '項評估' })}
              </span>
            </span>
            <Button icon={Sparkles} onClick={runAll} loading={busy} disabled={students.length === 0}>
              {busy
                ? t('reportComments.generating', { defaultValue: '生成緊…' })
                : t('reportComments.generateAll', { defaultValue: '生成全班評語' })}
            </Button>
          </div>
        </Card>
      </section>

      {/* 評語列表 / 引導式空狀態 */}
      {hasComments ? (
        <section>
          <SectionTitle
            icon={MessageSquareQuote}
            right={
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" icon={Copy} onClick={copyAll}>
                  {t('reportComments.copyAll', { defaultValue: '複製全部' })}
                </Button>
                <Button variant="secondary" size="sm" icon={FileText} onClick={exportWord}>
                  {t('reportComments.downloadWord', { defaultValue: '下載 Word' })}
                </Button>
              </div>
            }
          >
            {t('reportComments.listTitle', { defaultValue: '全班評語' })}
          </SectionTitle>
          <div className="space-y-2">
            {students.map((s, i) => (
              <Card key={s.id} padded className="space-y-2">
                <div className="flex items-center gap-2">
                  {s.studentNo && <Badge tone="slate">{s.studentNo}</Badge>}
                  <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                    {s.name}
                  </span>
                  <span className="tabular-nums slashed-zero text-[11px] text-slate-400 dark:text-slate-500">
                    {data[i]?.overall != null ? `${Math.round(data[i].overall!)}%` : '—'}
                  </span>
                  <Tooltip label={t('reportComments.regen', { defaultValue: '重新生成' })}>
                    <IconButton
                      label={t('reportComments.regen', { defaultValue: '重新生成' })}
                      size="sm"
                      onClick={() => void regenOne(i)}
                    >
                      {regenIdx === i ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                    </IconButton>
                  </Tooltip>
                </div>
                <Textarea
                  rows={2}
                  value={comments[i] ?? ''}
                  onChange={(e) => editComment(i, e.target.value)}
                  placeholder={t('reportComments.cellPlaceholder', {
                    defaultValue: '（未生成 — 撳右上重生）',
                  })}
                />
              </Card>
            ))}
          </div>
        </section>
      ) : students.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('reportComments.emptyNoStudentTitle', { defaultValue: '呢班未有學生' })}
          hint={t('reportComments.emptyNoStudentHint', {
            defaultValue: '揀返另一班，或去「班別管理」加學生先可以出評語。',
          })}
        />
      ) : (
        <EmptyState
          icon={Sparkles}
          title={t('reportComments.emptyReadyTitle', { defaultValue: '準備好出全班評語' })}
          hint={t('reportComments.emptyReadyHint', {
            defaultValue: '上面設定好語氣同長度，撳一下就一次過生成全班評語。',
          })}
          action={
            <Button icon={Sparkles} onClick={runAll} loading={busy} disabled={students.length === 0}>
              {busy
                ? t('reportComments.generating', { defaultValue: '生成緊…' })
                : t('reportComments.generateAll', { defaultValue: '生成全班評語' })}
            </Button>
          }
        />
      )}
    </div>
  )
}
