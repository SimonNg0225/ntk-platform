import { useMemo, useRef, useState } from 'react'
import {
  ClipboardCheck,
  MessageSquareQuote,
  Sparkles,
  Square,
  Copy,
  FileText,
  Camera,
  Upload,
  Trash2,
  Clock,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  SectionTitle,
  Select,
  SegmentedControl,
  Textarea,
  Tooltip,
  cx,
} from '../../ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useSettings } from '../../context/SettingsContext'
import { useCollection } from '../../lib/store'
import { SUBJECT_PACKS } from '../../data/subjects'
import {
  complete,
  streamChat,
  isAIConfigured,
  type AIModel,
  type AIImage,
} from '../../lib/aiClient'
import { fileToImage } from './docDigest/extract'
import { downloadDocx, type ExportBlock, type ExportDoc } from '../../lib/export'
import { Markdown } from '../shared/aiAssistant/markdown'
import {
  buildCommentSystem,
  buildCommentPrompt,
  COMMENT_TONES,
  type CommentTone,
} from './grading/prompts'
import { buildStructuredSystem, parseStructured } from './grading/structured'
import { buildRichSystem, resolveStrand } from './grading/richSystem'
import { MARKING_PROFILES, profileForSubject, type IssueType } from './grading/markingProfiles'
import { gradingCol, type GradingRecord } from './grading/gradingStore'
import { getSubjectKnowledge } from '../../data/subjectProfiles'

// ============================================================
//  AI 批改（教學 AI 工具）
//  ------------------------------------------------------------
//  ① 批改答案：逐科 bespoke 結構化批改 —— 揀科目 → 按該科準則 + 慣例
//     批改學生作答（文字 / 相片）→ 逐準則分數 + 錯處標示 + 總評，
//     有歷史 + Word 匯出。（前身「作文批改」已併入呢度並通用化到每一科。）
//  ② 成績表評語：學生表現摘要 + 語氣 → 一段評語（串流自由文字）。
//  經 gemini Edge Function（受 AI 額度 / Pro 白名單管制）。
// ============================================================

const MODELS: { id: AIModel; label: string }[] = [
  { id: 'gemini-2.5-flash', label: '快' },
  { id: 'gemini-2.5-pro', label: '仔細' },
]

// 錯處分類 meta（攤平所有科 profile 嘅 issues → 標籤 / 色查找；舊記錄都覆蓋到）
const ISSUE_META: Record<string, IssueType> = (() => {
  const m: Record<string, IssueType> = {}
  for (const p of Object.values(MARKING_PROFILES)) for (const it of p.issues) m[it.key] = it
  return m
})()
const issueMeta = (type: string): IssueType =>
  ISSUE_META[type] ?? { key: type, label: type || '其他', tone: 'slate' }

// 科目顯示名（舊「作文批改」記錄係 zh/en）
const subjectLabel = (subject: string): string =>
  getSubjectKnowledge(subject)?.label ??
  (subject === 'zh' ? '中文' : subject === 'en' ? 'English' : profileForSubject(subject).label)

type InputMode = 'text' | 'photo'

export default function Grading() {
  const { user, configured, signInWithGoogle } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const { subjectPackId } = useSettings()
  const records = useCollection(gradingCol)

  const [tab, setTab] = useState<'mark' | 'comment'>('mark')

  // ── 批改答案（結構化）──
  const [subject, setSubject] = useState<string>(subjectPackId || 'custom')
  const [strandKey, setStrandKey] = useState('') // 多範疇科（如 BAFS）嘅學習範疇
  const [areaKey, setAreaKey] = useState('') // 課題範疇（空 = 全部 / 由 AI 自動判斷）
  const [question, setQuestion] = useState('')
  const [customRubric, setCustomRubric] = useState('')
  const [totalMarks, setTotalMarks] = useState('')
  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [answerText, setAnswerText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [markModel, setMarkModel] = useState<AIModel>('gemini-2.5-flash')
  const [marking, setMarking] = useState(false)
  const [current, setCurrent] = useState<GradingRecord | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── 成績表評語（串流自由文字）──
  const [studentName, setStudentName] = useState('')
  const [summary, setSummary] = useState('')
  const [tone, setTone] = useState<CommentTone>('encouraging')
  const [commentModel, setCommentModel] = useState<AIModel>('gemini-2.5-flash')
  const [commenting, setCommenting] = useState(false)
  const [comment, setComment] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const profile = profileForSubject(subject)
  // 有 rich 知識檔嘅科（如 BAFS 兩範疇）→ 用 strand / area 度身定制；否則用 generic profile。
  const knowledge = getSubjectKnowledge(subject)
  const activeStrand = knowledge ? resolveStrand(knowledge, strandKey) : undefined
  const activeArea = activeStrand && areaKey ? activeStrand.areas.find((a) => a.key === areaKey) : undefined
  const rubricPreview = activeArea
    ? activeArea.rubric.map((r) => `${r.criterion}（${r.max}）`).join('、')
    : activeStrand
      ? `${activeStrand.label} · ${activeStrand.areas.map((a) => a.label.split(' ')[0]).join('、')}`
      : profile.rubric.map((r) => `${r.criterion}（${r.max}）`).join('、')

  // 切科目：重設範疇 / 課題
  const onSubjectChange = (v: string) => {
    setSubject(v)
    setStrandKey('')
    setAreaKey('')
  }

  const history = useMemo(
    () => [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [records],
  )

  // ── gates ──
  if (!isAIConfigured) {
    return (
      <EmptyState
        icon={Sparkles}
        title="AI 批改需要接好 Supabase + Gemini"
        hint="設定步驟見 docs/SETUP.md。"
      />
    )
  }
  if (!user) {
    return (
      <EmptyState
        icon={Sparkles}
        title="登入先可以用 AI 批改"
        hint="AI 功能經你自己嘅 Supabase + Gemini 運作。"
        action={
          configured ? (
            <Button onClick={() => void signInWithGoogle()}>用 Google 登入</Button>
          ) : undefined
        }
      />
    )
  }

  const hasMarkInput = inputMode === 'text' ? answerText.trim().length > 0 : file !== null

  async function runMark() {
    if (marking || !hasMarkInput) {
      if (!hasMarkInput) toast.error(inputMode === 'text' ? '請輸入學生答案' : '請上載答案相片')
      return
    }
    setMarking(true)
    try {
      let images: AIImage[] | undefined
      let title = ''
      if (inputMode === 'text') {
        title = (question.trim() || answerText.trim()).slice(0, 24)
      } else if (file) {
        images = [await fileToImage(file)]
        title = question.trim() ? question.trim().slice(0, 24) : '相片作答'
      }
      if (knowledge && activeStrand) title = `[${activeStrand.label}] ${title}`
      const sharedOpts = { rubric: customRubric, question, totalMarks, hasImage: inputMode === 'photo' }
      const raw = await complete({
        system: knowledge
          ? buildRichSystem(knowledge, { ...sharedOpts, strandKey: activeStrand?.key, areaKey })
          : buildStructuredSystem(profile, sharedOpts),
        messages: [
          {
            role: 'user',
            content: inputMode === 'text' ? answerText.trim() : '（請閱讀附圖學生作答並批改）',
            images,
          },
        ],
        model: markModel,
        temperature: 0.3,
        source: 'grading',
      })
      const result = parseStructured(raw)
      const rec = gradingCol.add({
        createdAt: new Date().toISOString(),
        subject,
        title: title || '批改',
        question: question.trim() || undefined,
        model: markModel,
        ...result,
      })
      setCurrent(rec)
      setAnswerText('')
      setFile(null)
      toast.success('批改完成')
    } catch (e) {
      toast.error((e as Error).message || '批改失敗，請再試。')
    } finally {
      setMarking(false)
    }
  }

  async function delRecord(id: string) {
    const ok = await confirm({ title: '刪除呢個批改？', tone: 'danger', confirmText: '刪除' })
    if (!ok) return
    gradingCol.remove(id)
    if (current?.id === id) setCurrent(null)
  }

  function stopComment() {
    abortRef.current?.abort()
    setCommenting(false)
  }

  async function runComment() {
    if (!summary.trim()) {
      toast.error('請輸入學生表現摘要')
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    setCommenting(true)
    setComment('')
    try {
      for await (const chunk of streamChat({
        system: buildCommentSystem(subject !== 'custom' ? subjectLabel(subject) : undefined),
        messages: [{ role: 'user', content: buildCommentPrompt({ studentName, summary, tone }) }],
        model: commentModel,
        signal: controller.signal,
        source: 'grading',
      })) {
        setComment((o) => o + chunk)
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        toast.error((e as Error).message || 'AI 失敗，請再試')
      }
    } finally {
      setCommenting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* 分頁 */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800">
        {[
          { id: 'mark' as const, label: '批改答案', icon: ClipboardCheck },
          { id: 'comment' as const, label: '成績表評語', icon: MessageSquareQuote },
        ].map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={cx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition',
              tab === tb.id
                ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400',
            )}
          >
            <tb.icon size={15} /> {tb.label}
          </button>
        ))}
      </div>

      {tab === 'mark' ? (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            {/* 輸入 */}
            <Card className="space-y-3 p-4">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Field label="科目（按呢科準則批改）" hint={`本科準則：${rubricPreview}`}>
                  <Select value={subject} onChange={(e) => onSubjectChange(e.target.value)}>
                    {SUBJECT_PACKS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.short}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="滿分（選填）">
                  <Input
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(e.target.value)}
                    placeholder="自動"
                    className="w-24"
                  />
                </Field>
              </div>

              {knowledge && activeStrand && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="學習範疇">
                    <Select
                      value={activeStrand.key}
                      onChange={(e) => {
                        setStrandKey(e.target.value)
                        setAreaKey('')
                      }}
                    >
                      {knowledge.strands.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="課題範疇">
                    <Select value={areaKey} onChange={(e) => setAreaKey(e.target.value)}>
                      <option value="">全部（自動判斷）</option>
                      {activeStrand.areas.map((a) => (
                        <option key={a.key} value={a.key}>
                          {a.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              )}

              <Field label="題目 / 寫作提示（選填）">
                <Textarea
                  rows={2}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="例如：解釋通脹三個成因 / 作文題目"
                />
              </Field>

              <Field label="自訂評分準則（選填，蓋過本科預設）">
                <Textarea
                  rows={2}
                  value={customRubric}
                  onChange={(e) => setCustomRubric(e.target.value)}
                  placeholder={rubricPreview}
                />
              </Field>

              <div className="flex items-center justify-between gap-2">
                <SegmentedControl<InputMode>
                  value={inputMode}
                  onChange={(m) => {
                    setInputMode(m)
                    setFile(null)
                  }}
                  options={[
                    { id: 'text', label: '貼文字' },
                    { id: 'photo', label: '影相 / 試卷' },
                  ]}
                />
                <Tooltip label="快 · 仔細">
                  <SegmentedControl<AIModel>
                    size="sm"
                    value={markModel}
                    onChange={setMarkModel}
                    options={MODELS}
                  />
                </Tooltip>
              </div>

              {inputMode === 'text' ? (
                <Textarea
                  rows={6}
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="貼上學生作答…"
                />
              ) : (
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/[0.12] bg-slate-50/60 px-4 py-8 text-center transition hover:border-accent/40 hover:bg-accent-soft/40 dark:border-white/[0.12] dark:bg-slate-800/40"
                  >
                    <Camera size={22} className="text-accent" />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      {file ? file.name : '影相 / 揀相片（手寫 / 試卷）'}
                    </span>
                    {!file && (
                      <span className="text-[11px] text-slate-400">影低學生作答，AI 會讀字批改</span>
                    )}
                  </button>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  icon={inputMode === 'photo' ? Upload : Sparkles}
                  onClick={runMark}
                  loading={marking}
                  disabled={!hasMarkInput}
                >
                  {marking ? '批改中…' : '批改'}
                </Button>
              </div>
            </Card>

            {/* 結果 */}
            <div>
              {current ? (
                <ResultCard rec={current} />
              ) : (
                <Card className="flex h-full items-center justify-center p-4">
                  <p className="py-10 text-center text-sm text-slate-400">
                    揀科目、貼學生作答，撳「批改」。
                    <br />
                    AI 會按 <span className="font-medium text-slate-500">{profile.label}</span> 科準則逐項打分、標錯處、寫總評。
                  </p>
                </Card>
              )}
            </div>
          </div>

          {/* 歷史 */}
          {history.length > 0 && (
            <div>
              <SectionTitle icon={Clock}>批改記錄</SectionTitle>
              <div className="space-y-2">
                {history.map((r) => (
                  <Card
                    key={r.id}
                    hover
                    onClick={() => setCurrent(r)}
                    className={cx('p-3', current?.id === r.id && 'ring-1 ring-accent/30')}
                  >
                    <div className="flex items-center gap-2.5">
                      <Badge tone="accent">{subjectLabel(r.subject)}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                          {r.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                          {fmtDate(r.createdAt)} · {r.total}/{r.maxTotal}
                        </p>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <IconButton label="刪除" size="sm" tone="danger" onClick={() => void delRecord(r.id)}>
                          <Trash2 size={14} />
                        </IconButton>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* 成績表評語 */
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="space-y-3 p-4">
            <Field label="學生姓名（選填）">
              <Input
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="例如：陳大文"
              />
            </Field>
            <Field label="表現摘要">
              <Textarea
                rows={6}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="例如：數學 85（全班第 3）、中文 60、上課積極、偶有欠交功課、出席率 95%"
              />
            </Field>
            <Field label="語氣">
              <SegmentedControl<CommentTone>
                value={tone}
                onChange={setTone}
                options={COMMENT_TONES.map((c) => ({ id: c.id, label: c.label }))}
              />
            </Field>
            <div className="flex items-center justify-between gap-2 pt-1">
              <SegmentedControl<AIModel>
                size="sm"
                value={commentModel}
                onChange={setCommentModel}
                options={MODELS}
              />
              {commenting ? (
                <Button variant="secondary" icon={Square} onClick={stopComment}>
                  停止
                </Button>
              ) : (
                <Button icon={Sparkles} onClick={runComment}>
                  生成評語
                </Button>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">評語</span>
              {comment && !commenting && (
                <IconButton
                  label="複製"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(comment)
                    toast.success('已複製')
                  }}
                >
                  <Copy size={15} />
                </IconButton>
              )}
            </div>
            {comment ? (
              <div className="prose-sm max-w-none">
                <Markdown text={comment} />
                {commenting && <span className="ml-0.5 animate-pulse">▍</span>}
              </div>
            ) : commenting ? (
              <p className="py-10 text-center text-sm text-slate-400">AI 思考緊…</p>
            ) : (
              <p className="py-10 text-center text-sm text-slate-400">
                輸入學生表現摘要，撳「生成評語」。
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

function gradingToDoc(rec: GradingRecord): ExportDoc {
  const blocks: ExportBlock[] = []
  if (rec.question) {
    blocks.push({ kind: 'heading', text: '題目', level: 1 })
    blocks.push({ kind: 'paragraph', text: rec.question })
  }
  if (rec.scores.length > 0) {
    blocks.push({ kind: 'heading', text: '評分', level: 1 })
    blocks.push({
      kind: 'bullets',
      items: rec.scores.map(
        (s) => `${s.criterion}：${s.score}/${s.max}${s.comment ? ` — ${s.comment}` : ''}`,
      ),
    })
  }
  if (rec.issues.length > 0) {
    blocks.push({ kind: 'heading', text: '錯處標示', level: 1 })
    blocks.push({ kind: 'bullets', items: rec.issues.map((i) => `${i.quote} → ${i.suggestion}`) })
  }
  if (rec.overall) {
    blocks.push({ kind: 'heading', text: '總評', level: 1 })
    blocks.push({ kind: 'paragraph', text: rec.overall })
  }
  return { title: `${rec.title}（${rec.total}/${rec.maxTotal}）`, blocks }
}

function ResultCard({ rec }: { rec: GradingRecord }) {
  const toast = useToast()
  const pct = rec.maxTotal > 0 ? Math.round((rec.total / rec.maxTotal) * 100) : 0
  const copyAll = () => {
    const lines = [
      ...rec.scores.map((s) => `${s.criterion}：${s.score}/${s.max} ${s.comment}`),
      '',
      '總評：' + rec.overall,
    ]
    void navigator.clipboard?.writeText(lines.join('\n'))
    toast.success('已複製')
  }
  const dlWord = async () => {
    try {
      await downloadDocx(gradingToDoc(rec))
      toast.success('已下載 Word')
    } catch (e) {
      toast.error((e as Error).message || '下載失敗')
    }
  }

  return (
    <Card padded className="space-y-4 ring-1 ring-accent/20">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold tabular-nums text-accent-strong dark:text-accent">
            {rec.total}
          </span>
          <span className="text-sm text-slate-400">/ {rec.maxTotal}</span>
          <Badge tone="slate" className="ml-1">
            {pct}%
          </Badge>
          <Badge tone="accent" className="ml-1">
            {subjectLabel(rec.subject)}
          </Badge>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={Copy} onClick={copyAll}>
            複製
          </Button>
          <Button variant="secondary" size="sm" icon={FileText} onClick={dlWord}>
            Word
          </Button>
        </div>
      </div>

      {rec.scores.length > 0 && (
        <div className="space-y-1.5">
          {rec.scores.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">{s.criterion}</span>
              <span className="tabular-nums text-accent-strong dark:text-accent">
                {s.score}/{s.max}
              </span>
              {s.comment && (
                <span className="text-[13px] text-slate-500 dark:text-slate-400">— {s.comment}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {rec.issues.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">錯處標示</p>
          <div className="space-y-2">
            {rec.issues.map((iss, i) => {
              const meta = issueMeta(iss.type)
              return (
                <div
                  key={i}
                  className="rounded-xl border border-black/[0.06] bg-slate-50/60 p-2.5 dark:border-white/[0.08] dark:bg-slate-800/40"
                >
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <p className="mt-1.5 text-sm">
                    <span className="rounded bg-rose-100 px-1 text-rose-700 line-through dark:bg-rose-500/15 dark:text-rose-300">
                      {iss.quote}
                    </span>
                    <span className="mx-1.5 text-slate-300">→</span>
                    <span className="rounded bg-emerald-100 px-1 font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      {iss.suggestion}
                    </span>
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {rec.overall && (
        <div>
          <p className="mb-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">總評</p>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{rec.overall}</p>
        </div>
      )}
    </Card>
  )
}
