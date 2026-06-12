import { useState } from 'react'
import {
  Button,
  Card,
  Field,
  Input,
  Select,
  Textarea,
  StatCard,
  cx,
} from '../../../../ui'
import { Sparkles, ClipboardList, AlertTriangle, RefreshCw } from 'lucide-react'
import { complete, type AIModel } from '../../../../lib/aiClient'
import { useToast } from '../../../../context/ToastContext'

// ============================================================
//  工具三：體態目標診斷
//  ------------------------------------------------------------
//  表單（身高/體重/目標/訓練年資/受傷史）→ complete() 一次過
//  生成個人化文字建議（重點 bullet + 注意事項）。
//  輕量解析：將回應分「重點」同「注意事項」兩段顯示。
// ============================================================

const GOALS = ['增肌', '減脂', '力量', '體能', '改善體態', '康復重返訓練']
const LEVELS = ['新手（少於半年）', '初階（半年至 2 年）', '中階（2 至 5 年）', '進階（5 年以上）']

interface FormState {
  height: string
  weight: string
  goal: string
  level: string
  injury: string
}

interface Advice {
  bullets: string[]
  cautions: string[]
}

export function num(v: string): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** BMI（缺值/除零守衞）。回 null = 資料不足。 */
export function bmi(heightCm: string, weightKg: string): number | null {
  const h = num(heightCm)
  const w = num(weightKg)
  if (h === null || w === null) return null
  const m = h / 100
  if (m <= 0) return null
  const result = w / (m * m)
  if (!Number.isFinite(result)) return null
  return Math.round(result * 10) / 10
}

export function bmiBand(value: number): { label: string; tone: string } {
  if (value < 18.5) return { label: '偏輕', tone: 'text-sky-500' }
  if (value < 24) return { label: '正常', tone: 'text-emerald-500' }
  if (value < 27) return { label: '過重', tone: 'text-amber-500' }
  return { label: '肥胖', tone: 'text-rose-500' }
}

export function buildPrompt(f: FormState, bmiValue: number | null): string {
  const lines = [
    `身高：${f.height || '未提供'} cm`,
    `體重：${f.weight || '未提供'} kg`,
    bmiValue !== null ? `BMI：${bmiValue}` : '',
    `主要目標：${f.goal}`,
    `訓練年資：${f.level}`,
    `受傷史 / 限制：${f.injury.trim() || '無'}`,
  ].filter(Boolean)
  return [
    '你係一位專業健身教練。根據以下訓練者資料，畀一份個人化建議。',
    '安全為先；如有受傷史，要特別針對性提醒同建議避開高風險動作。',
    '所有文字用繁體中文（可用書面廣東話）。',
    '',
    lines.join('\n'),
    '',
    '只回 JSON、唔好任何解說文字、唔好 markdown code fence。格式：',
    '{"bullets":["訓練重點/方向，5 至 7 點，每點一句具體可行"],"cautions":["注意事項/安全提醒，3 至 5 點"]}',
  ].join('\n')
}

export function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean)
}

export function parseAdvice(raw: string): Advice | null {
  let obj: { bullets?: unknown; cautions?: unknown }
  try {
    // 同 aiJson.stripJsonFence 一致：剝走 code fence
    const s = raw
      .trim()
      .replace(/^```[a-zA-Z]*\s*\n?/, '')
      .replace(/\n?```$/, '')
      .trim()
    obj = JSON.parse(s)
  } catch {
    return null
  }
  const bullets = strArr(obj.bullets)
  const cautions = strArr(obj.cautions)
  if (bullets.length === 0 && cautions.length === 0) return null
  return { bullets, cautions }
}

export default function Assess({ model }: { model: AIModel }) {
  const toast = useToast()
  const [form, setForm] = useState<FormState>({
    height: '',
    weight: '',
    goal: GOALS[0],
    level: LEVELS[0],
    injury: '',
  })
  const [busy, setBusy] = useState(false)
  const [advice, setAdvice] = useState<Advice | null>(null)

  const bmiValue = bmi(form.height, form.weight)
  const band = bmiValue !== null ? bmiBand(bmiValue) : null

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function run() {
    if (busy) return
    setBusy(true)
    setAdvice(null)
    try {
      const raw = await complete({
        messages: [{ role: 'user', content: buildPrompt(form, bmiValue) }],
        model,
        temperature: 0.5,
        source: 'fitness',
      })
      const parsed = parseAdvice(raw)
      if (!parsed) {
        toast.error('AI 回覆格式唔啱，請再試一次或換 Pro 模型')
        return
      }
      setAdvice(parsed)
      toast.success('已生成個人化建議')
    } catch (e) {
      toast.error((e as Error).message || 'AI 出錯，請再試')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <Card padded className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="身高（cm）">
            <Input
              type="number"
              inputMode="numeric"
              min={50}
              max={250}
              placeholder="例如 172"
              value={form.height}
              onChange={(e) => set('height', e.target.value)}
            />
          </Field>
          <Field label="體重（kg）">
            <Input
              type="number"
              inputMode="numeric"
              min={20}
              max={300}
              placeholder="例如 68"
              value={form.weight}
              onChange={(e) => set('weight', e.target.value)}
            />
          </Field>
          <Field label="主要目標">
            <Select value={form.goal} onChange={(e) => set('goal', e.target.value)}>
              {GOALS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="訓練年資">
            <Select value={form.level} onChange={(e) => set('level', e.target.value)}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="受傷史 / 身體限制" hint="例如：膝頭舊患、腰椎間盤、肩膊撞擊（冇就留空）">
          <Textarea
            rows={2}
            placeholder="講低任何傷患或限制，AI 會幫你避開高風險動作"
            value={form.injury}
            onChange={(e) => set('injury', e.target.value)}
          />
        </Field>

        {bmiValue !== null && band && (
          <StatCard
            label="BMI（參考）"
            value={bmiValue}
            hint={`分類：${band.label} · BMI 只作粗略參考，唔反映肌肉量`}
            icon={ClipboardList}
          />
        )}

        <Button fullWidth icon={Sparkles} loading={busy} onClick={() => void run()}>
          {busy ? 'AI 診斷中…' : advice ? '重新診斷' : '生成個人化建議'}
        </Button>
      </Card>

      {advice && (
        <div className="space-y-3" aria-live="polite">
          {advice.bullets.length > 0 && (
            <Card padded>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <Sparkles size={16} className="text-accent-strong dark:text-accent" aria-hidden="true" />
                訓練重點
              </h3>
              <ul className="space-y-2">
                {advice.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-strong dark:bg-accent/15 dark:text-accent" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="min-w-0 break-words leading-relaxed text-slate-700 dark:text-slate-200">
                      {b}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {advice.cautions.length > 0 && (
            <Card
              padded
              className="border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10"
            >
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                <AlertTriangle size={16} aria-hidden="true" />
                注意事項
              </h3>
              <ul className="space-y-2">
                {advice.cautions.map((c, i) => (
                  <li
                    key={i}
                    className={cx(
                      'flex items-start gap-2 text-sm leading-relaxed text-amber-800 dark:text-amber-200',
                    )}
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                    <span className="min-w-0 break-words">{c}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400 dark:text-slate-500">
            <RefreshCw size={12} aria-hidden="true" />
            建議由 AI 生成，僅供參考；如涉痛症或傷患，請諮詢專業醫療人員。
          </p>
        </div>
      )}
    </div>
  )
}
