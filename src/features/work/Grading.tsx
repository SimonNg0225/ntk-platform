import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  Type,
  PenLine,
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
  Select,
  SegmentedControl,
  Textarea,
  Tooltip,
  cx,
} from '../../ui'
import type { FeatureGuideStep } from '../../ui'
import CreditMeter from '../../components/CreditMeter'
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
  const { t } = useTranslation()
  const { user, configured, signInWithGoogle } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const { subjectPackId } = useSettings()
  const records = useCollection(gradingCol)

  // 教學引導步驟（跟分頁切換；defaultValue 廣東話，唔改 i18n 檔）
  const MARK_GUIDE: FeatureGuideStep[] = [
    {
      title: t('grading.markGuide1Title', { defaultValue: '揀科目' }),
      desc: t('grading.markGuide1Desc', {
        defaultValue: '揀返呢份功課嘅科目，AI 會跟返該科準則同慣例批改。',
      }),
    },
    {
      title: t('grading.markGuide2Title', { defaultValue: '貼答案或影相' }),
      desc: t('grading.markGuide2Desc', {
        defaultValue: '貼上學生作答文字，或影低手寫 / 試卷，AI 會自動讀字。',
      }),
    },
    {
      title: t('grading.markGuide3Title', { defaultValue: '撳批改，睇結果' }),
      desc: t('grading.markGuide3Desc', {
        defaultValue: '逐項打分、標錯處、寫總評；可複製或下載做 Word。',
      }),
    },
  ]
  const COMMENT_GUIDE: FeatureGuideStep[] = [
    {
      title: t('grading.commentGuide1Title', { defaultValue: '寫表現摘要' }),
      desc: t('grading.commentGuide1Desc', {
        defaultValue: '簡單列低分數、課堂表現、出席等重點，愈具體愈貼。',
      }),
    },
    {
      title: t('grading.commentGuide2Title', { defaultValue: '揀語氣' }),
      desc: t('grading.commentGuide2Desc', {
        defaultValue: '揀鼓勵 / 中肯等語氣，AI 會用相應口吻寫。',
      }),
    },
    {
      title: t('grading.commentGuide3Title', { defaultValue: '生成 + 複製' }),
      desc: t('grading.commentGuide3Desc', {
        defaultValue: '即時串流出一段成績表評語，滿意就一鍵複製。',
      }),
    },
  ]

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
  const answerRef = useRef<HTMLTextAreaElement>(null)

  // ── 成績表評語（串流自由文字）──
  const [studentName, setStudentName] = useState('')
  const [summary, setSummary] = useState('')
  const [tone, setTone] = useState<CommentTone>('encouraging')
  const [commentModel, setCommentModel] = useState<AIModel>('gemini-2.5-flash')
  const [commenting, setCommenting] = useState(false)
  const [comment, setComment] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const summaryRef = useRef<HTMLTextAreaElement>(null)

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
        title={t('grading.gateConfigTitle', { defaultValue: 'AI 批改需要接好 Supabase + Gemini' })}
        hint={t('grading.gateConfigHint', { defaultValue: '設定步驟見 docs/SETUP.md。' })}
      />
    )
  }
  if (!user) {
    return (
      <EmptyState
        icon={Sparkles}
        title={t('grading.gateLoginTitle', { defaultValue: '登入先可以用 AI 批改' })}
        hint={t('grading.gateLoginHint', { defaultValue: 'AI 功能經你自己嘅 Supabase + Gemini 運作。' })}
        action={
          configured ? (
            <Button onClick={() => void signInWithGoogle()}>
              {t('grading.signInGoogle', { defaultValue: '用 Google 登入' })}
            </Button>
          ) : undefined
        }
      />
    )
  }

  const hasMarkInput = inputMode === 'text' ? answerText.trim().length > 0 : file !== null

  async function runMark() {
    if (marking || !hasMarkInput) {
      if (!hasMarkInput)
        toast.error(
          inputMode === 'text'
            ? t('grading.errNoText', { defaultValue: '請輸入學生答案' })
            : t('grading.errNoPhoto', { defaultValue: '請上載答案相片' }),
        )
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
      toast.success(t('grading.markDone', { defaultValue: '批改完成' }))
    } catch (e) {
      toast.error((e as Error).message || t('grading.markFail', { defaultValue: '批改失敗，請再試。' }))
    } finally {
      setMarking(false)
    }
  }

  async function delRecord(id: string) {
    const ok = await confirm({
      title: t('grading.delConfirm', { defaultValue: '刪除呢個批改？' }),
      tone: 'danger',
      confirmText: t('grading.delete', { defaultValue: '刪除' }),
    })
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
      toast.error(t('grading.errNoSummary', { defaultValue: '請輸入學生表現摘要' }))
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
        toast.error((e as Error).message || t('grading.aiFail', { defaultValue: 'AI 失敗，請再試' }))
      }
    } finally {
      setCommenting(false)
    }
  }

  const TABS: { id: 'mark' | 'comment'; label: string; icon: typeof ClipboardCheck }[] = [
    { id: 'mark', label: t('grading.tabMark', { defaultValue: '批改答案' }), icon: ClipboardCheck },
    {
      id: 'comment',
      label: t('grading.tabComment', { defaultValue: '成績表評語' }),
      icon: MessageSquareQuote,
    },
  ]

  return (
    <div className="space-y-5">
      {/* 頁頂 accent hero（統一各功能頁），分頁切換放 hero 內底部 */}
      <PageHero
        guideKey="grading"
        icon={ClipboardCheck}
        kicker={t('grading.kicker', { defaultValue: 'AI Grading' })}
        title={t('grading.title', { defaultValue: 'AI 批改' })}
        description={t('grading.subtitle', {
          defaultValue: '逐科準則結構化批改學生作答（文字 / 相片），逐項打分、標錯處、寫總評；亦可一鍵生成成績表評語。',
        })}
        tabs={
          <>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition',
                  tab === id
                    ? 'bg-white font-semibold text-accent-strong'
                    : 'bg-white/15 font-medium text-white hover:bg-white/25',
                )}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </>
        }
      />

      {/* 教學引導：跟住分頁換內容（同一 storageKey，「知道喇」後兩個都收起） */}
      <FeatureGuide
        storageKey="grading"
        title={
          tab === 'mark'
            ? t('grading.guideMarkTitle', { defaultValue: 'AI 批改點用？' })
            : t('grading.guideCommentTitle', { defaultValue: '成績表評語點用？' })
        }
        steps={tab === 'mark' ? MARK_GUIDE : COMMENT_GUIDE}
      />

      {tab === 'mark' ? (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            {/* 輸入 */}
            <Card className="space-y-3 p-4">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Field
                  label={t('grading.subjectLabel', { defaultValue: '科目（按呢科準則批改）' })}
                  hint={t('grading.subjectHint', {
                    rubric: rubricPreview,
                    defaultValue: `本科準則：${rubricPreview}`,
                  })}
                >
                  <Select value={subject} onChange={(e) => onSubjectChange(e.target.value)}>
                    {SUBJECT_PACKS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.short}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t('grading.totalMarksLabel', { defaultValue: '滿分（選填）' })}>
                  <Input
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(e.target.value)}
                    placeholder={t('grading.totalMarksPlaceholder', { defaultValue: '自動' })}
                    className="w-24"
                  />
                </Field>
              </div>

              {knowledge && activeStrand && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t('grading.strandLabel', { defaultValue: '學習範疇' })}>
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
                  <Field label={t('grading.areaLabel', { defaultValue: '課題範疇' })}>
                    <Select value={areaKey} onChange={(e) => setAreaKey(e.target.value)}>
                      <option value="">{t('grading.areaAll', { defaultValue: '全部（自動判斷）' })}</option>
                      {activeStrand.areas.map((a) => (
                        <option key={a.key} value={a.key}>
                          {a.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              )}

              <Field label={t('grading.questionLabel', { defaultValue: '題目 / 寫作提示（選填）' })}>
                <Textarea
                  rows={2}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t('grading.questionPlaceholder', {
                    defaultValue: '例如：解釋通脹三個成因 / 作文題目',
                  })}
                />
              </Field>

              <Field label={t('grading.rubricLabel', { defaultValue: '自訂評分準則（選填，蓋過本科預設）' })}>
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
                    { id: 'text', label: t('grading.inputText', { defaultValue: '貼文字' }), icon: Type },
                    { id: 'photo', label: t('grading.inputPhoto', { defaultValue: '影相 / 試卷' }), icon: Camera },
                  ]}
                />
                <Tooltip label={t('grading.modelHint', { defaultValue: '快 · 仔細' })}>
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
                  ref={answerRef}
                  rows={6}
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder={t('grading.answerPlaceholder', { defaultValue: '貼上學生作答…' })}
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
                    className="group flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-accent/40 bg-accent-soft/50 px-4 py-8 text-center transition duration-200 hover:border-accent hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] dark:border-accent/40 dark:bg-accent/10"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white">
                      <Camera size={20} />
                    </span>
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      {file ? file.name : t('grading.photoCta', { defaultValue: '影相 / 揀相片（手寫 / 試卷）' })}
                    </span>
                    {!file && (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {t('grading.photoHint', { defaultValue: '影低學生作答，AI 會讀字批改' })}
                      </span>
                    )}
                  </button>
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <CreditMeter source="grading" model={markModel} className="mr-auto" />
                <Button
                  icon={inputMode === 'photo' ? Upload : Sparkles}
                  onClick={runMark}
                  loading={marking}
                  disabled={!hasMarkInput}
                >
                  {marking
                    ? t('grading.marking', { defaultValue: '批改中…' })
                    : t('grading.mark', { defaultValue: '批改' })}
                </Button>
              </div>
            </Card>

            {/* 結果 */}
            <div>
              {current ? (
                <ResultCard rec={current} />
              ) : (
                <Card className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                    <ClipboardCheck size={22} strokeWidth={1.75} />
                  </span>
                  <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
                    {t('grading.markEmptyTitle', { defaultValue: '準備好就批改' })}
                  </p>
                  <p className="max-w-xs text-xs text-slate-400 dark:text-slate-500">
                    {t('grading.markEmptyHint', {
                      subject: profile.label,
                      defaultValue: `AI 會按「${profile.label}」科準則逐項打分、標錯處、寫總評。`,
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (inputMode === 'text') answerRef.current?.focus()
                      else fileRef.current?.click()
                    }}
                    className="mt-1 text-xs font-medium text-accent transition hover:text-accent-strong active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-lg"
                  >
                    {inputMode === 'text'
                      ? t('grading.markEmptyCtaText', { defaultValue: '貼上學生作答 →' })
                      : t('grading.markEmptyCtaPhoto', { defaultValue: '影相 / 揀相片 →' })}
                  </button>
                </Card>
              )}
            </div>
          </div>

          {/* 歷史 */}
          {history.length > 0 && (
            <section>
              <SectionTitle icon={Clock}>
                {t('grading.historyTitle', { defaultValue: '批改記錄' })}
              </SectionTitle>
              <div className="space-y-2">
                {history.map((r) => (
                  <Card
                    key={r.id}
                    hover
                    onClick={() => setCurrent(r)}
                    className={cx(
                      'p-3 transition',
                      current?.id === r.id && 'border-accent/40 ring-1 ring-accent/30',
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Badge tone="accent">{subjectLabel(r.subject)}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                          {r.title}
                        </p>
                        <p className="mt-0.5 text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                          {fmtDate(r.createdAt)} · {r.total}/{r.maxTotal}
                        </p>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <IconButton
                          label={t('grading.delete', { defaultValue: '刪除' })}
                          size="sm"
                          tone="danger"
                          onClick={() => void delRecord(r.id)}
                        >
                          <Trash2 size={14} />
                        </IconButton>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        /* 成績表評語 */
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="space-y-3 p-4">
            <Field label={t('grading.studentName', { defaultValue: '學生姓名（選填）' })}>
              <Input
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder={t('grading.studentNamePlaceholder', { defaultValue: '例如：陳大文' })}
              />
            </Field>
            <Field
              label={t('grading.summaryLabel', { defaultValue: '表現摘要' })}
              hint={t('grading.summaryHint', { defaultValue: '愈具體愈準：分數、課堂表現、出席、欠交等。' })}
            >
              <Textarea
                ref={summaryRef}
                rows={6}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder={t('grading.summaryPlaceholder', {
                  defaultValue: '例如：數學 85（全班第 3）、中文 60、上課積極、偶有欠交功課、出席率 95%',
                })}
              />
            </Field>
            <Field label={t('grading.toneLabel', { defaultValue: '語氣' })}>
              <SegmentedControl<CommentTone>
                value={tone}
                onChange={setTone}
                options={COMMENT_TONES.map((c) => ({ id: c.id, label: c.label }))}
              />
            </Field>
            <div className="flex items-center justify-between gap-2 pt-1">
              <Tooltip label={t('grading.modelHint', { defaultValue: '快 · 仔細' })}>
                <SegmentedControl<AIModel>
                  size="sm"
                  value={commentModel}
                  onChange={setCommentModel}
                  options={MODELS}
                />
              </Tooltip>
              {commenting ? (
                <Button variant="secondary" icon={Square} onClick={stopComment}>
                  {t('grading.stop', { defaultValue: '停止' })}
                </Button>
              ) : (
                <Button icon={Sparkles} onClick={runComment}>
                  {t('grading.generateComment', { defaultValue: '生成評語' })}
                </Button>
              )}
            </div>
          </Card>

          <Card className="flex flex-col p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <MessageSquareQuote size={15} />
                {t('grading.commentResult', { defaultValue: '評語' })}
              </span>
              {comment && !commenting && (
                <IconButton
                  label={t('grading.copy', { defaultValue: '複製' })}
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(comment)
                    toast.success(t('grading.copied', { defaultValue: '已複製' }))
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
              <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-slate-400">
                {t('grading.thinking', { defaultValue: 'AI 思考緊…' })}
              </p>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                  <PenLine size={22} strokeWidth={1.75} />
                </span>
                <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
                  {t('grading.commentEmptyTitle', { defaultValue: '一段成績表評語' })}
                </p>
                <p className="max-w-xs text-xs text-slate-400 dark:text-slate-500">
                  {t('grading.commentEmptyHint', { defaultValue: '填好表現摘要、揀語氣，AI 即時幫你寫。' })}
                </p>
                <button
                  type="button"
                  onClick={() => summaryRef.current?.focus()}
                  className="mt-1 rounded-lg text-xs font-medium text-accent transition hover:text-accent-strong active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  {t('grading.commentEmptyCta', { defaultValue: '填表現摘要 →' })}
                </button>
              </div>
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
  const { t } = useTranslation()
  const toast = useToast()
  const pct = rec.maxTotal > 0 ? Math.round((rec.total / rec.maxTotal) * 100) : 0
  const copyAll = () => {
    const lines = [
      ...rec.scores.map((s) => `${s.criterion}：${s.score}/${s.max} ${s.comment}`),
      '',
      '總評：' + rec.overall,
    ]
    void navigator.clipboard?.writeText(lines.join('\n'))
    toast.success(t('grading.copied', { defaultValue: '已複製' }))
  }
  const dlWord = async () => {
    try {
      await downloadDocx(gradingToDoc(rec))
      toast.success(t('grading.wordDone', { defaultValue: '已下載 Word' }))
    } catch (e) {
      toast.error((e as Error).message || t('grading.downloadFail', { defaultValue: '下載失敗' }))
    }
  }

  return (
    <Card padded className="space-y-4 border-accent/30 ring-1 ring-accent/20">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-semibold tabular-nums slashed-zero text-accent-strong dark:text-accent">
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
            {t('grading.copy', { defaultValue: '複製' })}
          </Button>
          <Button variant="secondary" size="sm" icon={FileText} onClick={dlWord}>
            {t('grading.word', { defaultValue: 'Word' })}
          </Button>
        </div>
      </div>

      {rec.scores.length > 0 && (
        <div className="space-y-1.5">
          {rec.scores.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">{s.criterion}</span>
              <span className="tabular-nums slashed-zero text-accent-strong dark:text-accent">
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
          <p className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {t('grading.issuesHeading', { defaultValue: '錯處標示' })}
          </p>
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
          <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {t('grading.overallHeading', { defaultValue: '總評' })}
          </p>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{rec.overall}</p>
        </div>
      )}
    </Card>
  )
}
