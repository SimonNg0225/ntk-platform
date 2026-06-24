import { useMemo, useState } from 'react'
import { Scale, Sparkles, FileText, Copy, Trash2, Clock, ListChecks, Grid3x3 } from 'lucide-react'
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
  cx,
  type FeatureGuideStep,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { useSettings } from '../../../context/SettingsContext'
import { useCollection } from '../../../lib/store'
import { complete, isAIConfigured, type AIModel } from '../../../lib/aiClient'
import { getSubjectPack } from '../../../data/subjects'
import { downloadDocx, type ExportBlock, type ExportDoc } from '../../../lib/export'
import { rubricCol, type RubricRecord } from './rubricStore'
import {
  buildSchemeSystem,
  parseScheme,
  buildRubricSystem,
  parseRubric,
  type RubricMode,
} from './rubricPrompts'

const MODE_OPTS: { id: RubricMode; label: string }[] = [
  { id: 'scheme', label: '評分指引' },
  { id: 'rubric', label: '評分量表' },
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

export default function RubricGen() {
  const toast = useToast()
  const confirm = useConfirm()
  const { subjectPackId } = useSettings()
  const subjectName = subjectPackId !== 'custom' ? getSubjectPack(subjectPackId)?.name : undefined

  const records = useCollection(rubricCol)
  const history = useMemo(
    () => [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [records],
  )

  const [mode, setMode] = useState<RubricMode>('scheme')
  const [question, setQuestion] = useState('')
  const [totalMarks, setTotalMarks] = useState(10)
  const [levelCount, setLevelCount] = useState(4)
  const [model, setModel] = useState<AIModel>('gemini-2.5-flash')
  const [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState<RubricRecord | null>(null)

  async function run() {
    if (busy || !question.trim()) return
    setBusy(true)
    try {
      const q = question.trim()
      let rec: RubricRecord
      if (mode === 'scheme') {
        const raw = await complete({
          system: buildSchemeSystem(subjectName, totalMarks),
          messages: [{ role: 'user', content: q }],
          model,
          temperature: 0.3,
          source: 'rubric',
        })
        rec = rubricCol.add({
          createdAt: new Date().toISOString(),
          mode,
          question: q.slice(0, 60),
          model,
          scheme: parseScheme(raw),
        })
      } else {
        const raw = await complete({
          system: buildRubricSystem(subjectName, levelCount),
          messages: [{ role: 'user', content: q }],
          model,
          temperature: 0.3,
          source: 'rubric',
        })
        rec = rubricCol.add({
          createdAt: new Date().toISOString(),
          mode,
          question: q.slice(0, 60),
          model,
          rubric: parseRubric(raw),
        })
      }
      setCurrent(rec)
      toast.success('已生成')
    } catch (e) {
      toast.error((e as Error).message || '生成失敗，請再試。')
    } finally {
      setBusy(false)
    }
  }

  async function del(id: string) {
    const ok = await confirm({ title: '刪除呢個準則？', tone: 'danger', confirmText: '刪除' })
    if (!ok) return
    rubricCol.remove(id)
    if (current?.id === id) setCurrent(null)
  }

  if (!isAIConfigured) {
    return (
      <div className="space-y-5">
        <PageHero
          guideKey="rubric-gen"
          icon={Scale}
          kicker="Rubric Studio"
          title="評分準則"
          description="貼上題目或任務，AI 一鍵擬「評分指引」（參考答案＋評分點）或「評分量表」（準則 × 等級），可複製或下載做 Word。"
        />
        <EmptyState
          icon={Scale}
          title="評分準則未啟用"
          hint="要設定好 Supabase 並部署 gemini Edge Function 先用到 AI 生成（步驟見 docs/SETUP.md）。"
        />
      </div>
    )
  }

  // 教學引導：跟住模式換內容（同一 storageKey，「知道喇」後兩個都收起）
  const SCHEME_GUIDE: FeatureGuideStep[] = [
    {
      title: '貼題目或任務',
      desc: '將要批改嘅題目、寫作任務或專題要求貼入下面，愈具體 AI 出得愈準。',
    },
    {
      title: '揀總分',
      desc: 'set 返呢題嘅總分，AI 會將分數分配落各個評分點。',
    },
    {
      title: '生成 + 取用',
      desc: '撳生成即出參考答案同評分點，滿意就複製或下載做 Word。',
    },
  ]
  const RUBRIC_GUIDE: FeatureGuideStep[] = [
    {
      title: '貼題目或任務',
      desc: '將要評分嘅題目、寫作任務或專題要求貼入下面，愈具體 AI 出得愈準。',
    },
    {
      title: '揀等級數',
      desc: '選 3–5 級，AI 會為每個準則寫由高到低嘅表現描述。',
    },
    {
      title: '生成 + 取用',
      desc: '撳生成即出「準則 × 等級」量表，滿意就複製或下載做 Word。',
    },
  ]

  const canRun = !!question.trim()

  return (
    <div className="space-y-5">
      <PageHero
        icon={Scale}
        kicker="Rubric Studio"
        title="評分準則"
        description="貼上題目或任務，AI 一鍵擬「評分指引」（參考答案＋評分點）或「評分量表」（準則 × 等級），可複製或下載做 Word。"
      />

      {/* 教學引導：點用呢個功能（可摺疊 / 永久收起） */}
      <FeatureGuide
        storageKey="rubric-gen"
        title={mode === 'scheme' ? '評分指引點用？' : '評分量表點用？'}
        steps={mode === 'scheme' ? SCHEME_GUIDE : RUBRIC_GUIDE}
      />

      {/* ───────── 輸入卡 ───────── */}
      <Card padded className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
            {mode === 'scheme' ? <ListChecks size={13} className="text-accent" /> : <Grid3x3 size={13} className="text-accent" />}
            {mode === 'scheme' ? '出參考答案＋逐項評分點' : '出準則 × 表現等級量表'}
          </div>
          <Tooltip label="Flash 快 · Pro 強">
            <SegmentedControl size="sm" options={MODEL_OPTS} value={model} onChange={setModel} />
          </Tooltip>
        </div>

        <Field
          label="要做邊種？"
          hint={mode === 'scheme' ? '評分指引：適合有標準答案嘅題目（如計算、簡答）。' : '評分量表：適合開放式作答（如寫作、專題、匯報）。'}
        >
          <SegmentedControl options={MODE_OPTS} value={mode} onChange={setMode} />
        </Field>

        <Field label="題目 / 任務">
          <Textarea
            rows={4}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              mode === 'scheme'
                ? '例：解釋光合作用嘅過程同重要性。'
                : '例：就「全球暖化」寫一篇 400 字議論文。'
            }
          />
        </Field>

        <div className="flex flex-wrap items-end justify-between gap-3">
          {mode === 'scheme' ? (
            <Field label="總分">
              <Select value={String(totalMarks)} onChange={(e) => setTotalMarks(Number(e.target.value))}>
                {[5, 8, 10, 15, 20, 25].map((n) => (
                  <option key={n} value={n}>
                    {n} 分
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="等級數">
              <Select value={String(levelCount)} onChange={(e) => setLevelCount(Number(e.target.value))}>
                {[3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} 級
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Button icon={Sparkles} onClick={run} loading={busy} disabled={!canRun}>
            {busy ? '生成緊…' : mode === 'scheme' ? '生成評分指引' : '生成評分量表'}
          </Button>
        </div>
      </Card>

      {current && <ResultCard rec={current} />}

      {history.length > 0 && (
        <section>
          <SectionTitle icon={Clock} description="撳返任何一條即重新查看">
            歷史紀錄
          </SectionTitle>
          <div className="space-y-2">
            {history.map((r) => (
              <Card
                key={r.id}
                hover
                onClick={() => setCurrent(r)}
                className={cx('p-3', current?.id === r.id && 'ring-1 ring-accent/30')}
              >
                <div className="flex items-center gap-2.5">
                  <Badge tone={r.mode === 'rubric' ? 'blue' : 'accent'}>
                    {r.mode === 'rubric' ? '量表' : '指引'}
                  </Badge>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                    {r.question}
                  </p>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{fmtDate(r.createdAt)}</span>
                  <div onClick={(e) => e.stopPropagation()}>
                    <IconButton label="刪除" size="sm" tone="danger" onClick={() => void del(r.id)}>
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {history.length === 0 && !current && (
        <EmptyState
          icon={Scale}
          title="未有評分準則"
          hint={
            mode === 'scheme'
              ? '喺上面貼第一條題目，揀返總分，AI 即幫你出參考答案同評分點。'
              : '喺上面貼第一條任務，揀返等級數，AI 即幫你出「準則 × 等級」量表。'
          }
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={Sparkles}
              onClick={() => {
                document.querySelector<HTMLTextAreaElement>('textarea')?.focus()
              }}
            >
              貼題目開始
            </Button>
          }
        />
      )}
    </div>
  )
}

function recToDoc(rec: RubricRecord): ExportDoc {
  const blocks: ExportBlock[] = []
  if (rec.mode === 'scheme' && rec.scheme) {
    if (rec.scheme.modelAnswer) {
      blocks.push({ kind: 'heading', text: '參考答案', level: 1 })
      blocks.push({ kind: 'paragraph', text: rec.scheme.modelAnswer })
    }
    blocks.push({ kind: 'heading', text: `評分點（共 ${rec.scheme.total} 分）`, level: 1 })
    blocks.push({
      kind: 'bullets',
      items: rec.scheme.points.map((p) => `${p.text}（${p.marks} 分）`),
    })
  } else if (rec.mode === 'rubric' && rec.rubric) {
    for (const c of rec.rubric.criteria) {
      blocks.push({ kind: 'heading', text: c.name, level: 2 })
      blocks.push({
        kind: 'bullets',
        items: c.levels.map((l) => `${l.label}（${l.marks} 分）：${l.descriptor}`),
      })
    }
  }
  return { title: `評分準則：${rec.question}`, blocks }
}

function ResultCard({ rec }: { rec: RubricRecord }) {
  const toast = useToast()
  const dlWord = async () => {
    try {
      await downloadDocx(recToDoc(rec))
      toast.success('已下載 Word')
    } catch (e) {
      toast.error((e as Error).message || '下載失敗')
    }
  }
  const copyAll = () => {
    const doc = recToDoc(rec)
    const text = doc.blocks
      .map((b) =>
        b.kind === 'heading' ? `【${b.text}】` : b.kind === 'paragraph' ? b.text : b.kind === 'bullets' ? b.items.map((i) => `• ${i}`).join('\n') : '',
      )
      .join('\n')
    void navigator.clipboard?.writeText(text)
    toast.success('已複製')
  }

  return (
    <Card padded className="space-y-4 ring-1 ring-accent/20">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent" icon={Scale}>
          {rec.mode === 'rubric' ? '評分量表' : '評分指引'}
        </Badge>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
          {rec.question}
        </h2>
        <Button variant="secondary" size="sm" icon={Copy} onClick={copyAll}>
          複製
        </Button>
        <Button variant="secondary" size="sm" icon={FileText} onClick={dlWord}>
          Word
        </Button>
      </div>

      {rec.mode === 'scheme' && rec.scheme && (
        <div className="space-y-3">
          {rec.scheme.modelAnswer && (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">參考答案</p>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {rec.scheme.modelAnswer}
              </p>
            </div>
          )}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              評分點（共 {rec.scheme.total} 分）
            </p>
            <div className="space-y-1.5">
              {rec.scheme.points.map((p, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <Badge tone="slate">{p.marks}</Badge>
                  <span className="flex-1">{p.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {rec.mode === 'rubric' && rec.rubric && (
        <div className="space-y-3">
          {rec.rubric.criteria.map((c, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-700/60 dark:bg-slate-800/40"
            >
              <p className="mb-2 text-sm font-semibold text-accent-strong dark:text-accent">{c.name}</p>
              <div className="space-y-1.5">
                {c.levels.map((l, li) => (
                  <div key={li} className="flex items-start gap-2 text-[13px]">
                    <Badge tone="accent">{l.label}</Badge>
                    <span className="shrink-0 tabular-nums text-slate-400">{l.marks}分</span>
                    <span className="flex-1 text-slate-700 dark:text-slate-200">{l.descriptor}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
