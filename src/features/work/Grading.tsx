import { useRef, useState, type ReactNode } from 'react'
import {
  ClipboardCheck,
  ImagePlus,
  X,
  Square,
  Copy,
  Sparkles,
  MessageSquareQuote,
} from 'lucide-react'
import {
  Button,
  Card,
  Input,
  Textarea,
  SegmentedControl,
  EmptyState,
  IconButton,
  cx,
} from '../../ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useSettings } from '../../context/SettingsContext'
import { getSubjectPack } from '../../data/subjects'
import {
  streamChat,
  isAIConfigured,
  type AIModel,
  type AIImage,
} from '../../lib/aiClient'
import { Markdown } from '../shared/aiAssistant/markdown'
import {
  buildGradingSystem,
  buildGradingPrompt,
  buildCommentSystem,
  buildCommentPrompt,
  COMMENT_TONES,
  type CommentTone,
} from './grading/prompts'

// ============================================================
//  AI 批改（教學 AI 工具）
//  ------------------------------------------------------------
//  ① 批改答案：題目 + 準則 + 學生答案（文字 / 相片）→ 分數 + 評語
//  ② 成績表評語：學生表現摘要 + 語氣 → 一段評語
//  經 gemini Edge Function（受 AI 額度 / Pro 白名單管制）。
// ============================================================

const MODELS = [
  { id: 'gemini-2.5-flash', label: '快' },
  { id: 'gemini-2.5-pro', label: '仔細' },
]

export default function Grading() {
  const { user, configured, signInWithGoogle } = useAuth()
  const toast = useToast()
  const { subjectPackId } = useSettings()
  const subjectName =
    subjectPackId !== 'custom'
      ? getSubjectPack(subjectPackId)?.name
      : undefined

  const [tab, setTab] = useState<'mark' | 'comment'>('mark')
  const [model, setModel] = useState<AIModel>('gemini-2.5-flash')

  // 批改
  const [question, setQuestion] = useState('')
  const [totalMarks, setTotalMarks] = useState('')
  const [scheme, setScheme] = useState('')
  const [answer, setAnswer] = useState('')
  const [image, setImage] = useState<AIImage | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  // 評語
  const [studentName, setStudentName] = useState('')
  const [summary, setSummary] = useState('')
  const [tone, setTone] = useState<CommentTone>('encouraging')

  const [busy, setBusy] = useState(false)
  const [output, setOutput] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── gate ──
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

  function onPhoto(file: File) {
    const reader = new FileReader()
    reader.onerror = () => toast.error('讀唔到相，請再試')
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const comma = dataUrl.indexOf(',')
      const semi = dataUrl.indexOf(';')
      const data = comma >= 0 ? dataUrl.slice(comma + 1) : ''
      const mimeType = semi > 5 ? dataUrl.slice(5, semi) : 'image/jpeg'
      if (!data) {
        toast.error('讀唔到相，請再試')
        return
      }
      setImage({ mimeType, data })
      setPreview(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  function stop() {
    abortRef.current?.abort()
    setBusy(false)
  }

  async function run(system: string, content: string, images?: AIImage[]) {
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setOutput('')
    try {
      for await (const chunk of streamChat({
        system,
        messages: [{ role: 'user', content, images }],
        model,
        signal: controller.signal,
        source: 'grading',
      })) {
        setOutput((o) => o + chunk)
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        toast.error((e as Error).message || 'AI 失敗，請再試')
      }
    } finally {
      setBusy(false)
    }
  }

  function runMark() {
    if (!question.trim()) {
      toast.error('請輸入題目')
      return
    }
    if (!answer.trim() && !image) {
      toast.error('請輸入學生答案或上載相片')
      return
    }
    void run(
      buildGradingSystem(subjectName),
      buildGradingPrompt({
        question,
        scheme,
        totalMarks,
        answer,
        hasImage: !!image,
      }),
      image ? [image] : undefined,
    )
  }

  function runComment() {
    if (!summary.trim()) {
      toast.error('請輸入學生表現摘要')
      return
    }
    void run(
      buildCommentSystem(subjectName),
      buildCommentPrompt({ studentName, summary, tone }),
    )
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
            onClick={() => {
              setTab(tb.id)
              setOutput('')
            }}
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

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 輸入 */}
        <Card className="space-y-3 p-4">
          {tab === 'mark' ? (
            <>
              <Field label="題目">
                <Textarea
                  rows={2}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="例如：解釋通脹嘅三個成因"
                />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="滿分（選填）">
                  <Input
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(e.target.value)}
                    placeholder="10"
                  />
                </Field>
                <div className="col-span-2">
                  <Field label="評分準則（選填）">
                    <Input
                      value={scheme}
                      onChange={(e) => setScheme(e.target.value)}
                      placeholder="每個成因 2 分…"
                    />
                  </Field>
                </div>
              </div>
              <Field label="學生答案">
                <Textarea
                  rows={5}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="貼上學生作答；或用下面上載手寫 / 試卷相片"
                />
              </Field>
              {preview ? (
                <div className="relative inline-block">
                  <img
                    src={preview}
                    alt="學生答案"
                    className="max-h-40 rounded-lg border border-[color:var(--border)]"
                  />
                  <button
                    onClick={() => {
                      setImage(null)
                      setPreview(null)
                    }}
                    aria-label="移除相片"
                    className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-white transition hover:bg-slate-800 active:scale-[0.98]"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  icon={ImagePlus}
                  onClick={() => fileRef.current?.click()}
                >
                  上載答案相片（手寫 / 試卷）
                </Button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onPhoto(f)
                  e.target.value = ''
                }}
              />
            </>
          ) : (
            <>
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
            </>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <SegmentedControl<AIModel>
              size="sm"
              value={model}
              onChange={setModel}
              options={MODELS as { id: AIModel; label: string }[]}
            />
            {busy ? (
              <Button variant="secondary" icon={Square} onClick={stop}>
                停止
              </Button>
            ) : (
              <Button
                icon={Sparkles}
                onClick={tab === 'mark' ? runMark : runComment}
              >
                {tab === 'mark' ? '批改' : '生成評語'}
              </Button>
            )}
          </div>
        </Card>

        {/* 輸出 */}
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {tab === 'mark' ? '批改結果' : '評語'}
            </span>
            {output && !busy && (
              <IconButton
                label="複製"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(output)
                  toast.success('已複製')
                }}
              >
                <Copy size={15} />
              </IconButton>
            )}
          </div>
          {output ? (
            <div className="prose-sm max-w-none">
              <Markdown text={output} />
              {busy && <span className="ml-0.5 animate-pulse">▍</span>}
            </div>
          ) : busy ? (
            <p className="py-10 text-center text-sm text-slate-400">AI 思考緊…</p>
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">
              {tab === 'mark'
                ? '輸入題目同學生答案，撳「批改」。'
                : '輸入學生表現摘要，撳「生成評語」。'}
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}

// 細 Field（同 ui Field 一致但唔想 import 多個；簡化）
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}
      </span>
      {children}
    </label>
  )
}
