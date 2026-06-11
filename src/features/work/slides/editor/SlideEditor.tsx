import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Hash,
  Columns2,
  ListOrdered,
  Quote,
  LayoutGrid,
  List,
  Heading1,
  Plus,
  Trash2,
  Sparkles,
  Undo2,
  Check,
  BarChart3,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button, Field, IconButton, Input, Modal, Select, Textarea, cx } from '../../../../ui'
import { useToast } from '../../../../context/ToastContext'
import type { AIModel } from '../../../../lib/aiClient'
import type {
  Slide,
  SlideChart,
  SlideLayout,
} from '../../../../lib/export/types'
import { convertSlide } from './convert'
import { aiConvertSlide, rewriteSlide } from './slideAi'

// ============================================================
//  逐版編輯器 — 全套控制
//  ------------------------------------------------------------
//  · 版式 chips：規則即時互轉（convert.ts），唔夠料就 toast 唔切換
//  · 按版式 render 對應表單（bullets／stats／compare／steps／quote／cards／section）
//  · 圖表數據表（type／categories／series／unit），value 非數字 disable 儲存
//  · 「AI 重寫呢版」「AI 幫我轉」：成功覆蓋 draft，有一步 undo
// ============================================================

const LAYOUT_OPTS: { id: SlideLayout; label: string; icon: LucideIcon }[] = [
  { id: 'bullets', label: '要點', icon: List },
  { id: 'stats', label: '數據', icon: Hash },
  { id: 'compare', label: '對比', icon: Columns2 },
  { id: 'steps', label: '步驟', icon: ListOrdered },
  { id: 'quote', label: '金句', icon: Quote },
  { id: 'cards', label: '卡片', icon: LayoutGrid },
  { id: 'section', label: '章節', icon: Heading1 },
]

/** 編輯中嘅 chart 文字形態（categories／values 用「、」「,」分隔輸入） */
interface ChartDraft {
  type: 'bar' | 'line' | 'pie'
  unit: string
  categories: string
  seriesName: string
  values: string
}

function chartToDraft(c: SlideChart | undefined): ChartDraft | null {
  if (!c) return null
  return {
    type: c.type,
    unit: c.unit ?? '',
    categories: c.categories.join('、'),
    seriesName: c.series[0]?.name ?? '數據',
    values: (c.series[0]?.values ?? []).join('、'),
  }
}

/** 解析 chart 草稿；values 有非數字回 null（UI 紅框 + disable 儲存）。 */
function draftToChart(d: ChartDraft | null): { chart?: SlideChart; invalid: boolean } {
  if (!d) return { chart: undefined, invalid: false }
  const categories = d.categories.split(/[、,，]/).map((s) => s.trim()).filter(Boolean)
  const rawVals = d.values.split(/[、,，]/).map((s) => s.trim()).filter(Boolean)
  const values = rawVals.map(Number)
  const invalid = categories.length === 0 || rawVals.length === 0 || values.some((v) => !isFinite(v))
  if (invalid) return { chart: undefined, invalid: true }
  return {
    chart: {
      type: d.type,
      categories,
      series: [{ name: d.seriesName.trim() || '數據', values }],
      unit: d.unit.trim() || undefined,
    },
    invalid: false,
  }
}

const effectiveLayout = (s: Slide): SlideLayout =>
  s.layout ?? (s.bullets.length === 0 ? 'section' : 'bullets')

export default function SlideEditor({
  slide,
  index,
  model,
  onSave,
  onClose,
}: {
  slide: Slide
  index: number
  model: AIModel
  onSave: (s: Slide) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [draft, setDraft] = useState<Slide>(() => JSON.parse(JSON.stringify(slide)) as Slide)
  const [prev, setPrev] = useState<Slide | null>(null) // 一步 undo（AI／轉版式前）
  const [chartDraft, setChartDraft] = useState<ChartDraft | null>(() => chartToDraft(slide.chart))
  const [aiNote, setAiNote] = useState('')
  const [aiBusy, setAiBusy] = useState(false)

  const layout = effectiveLayout(draft)
  const { chart, invalid: chartInvalid } = useMemo(() => draftToChart(chartDraft), [chartDraft])

  const patch = (p: Partial<Slide>) => setDraft((d) => ({ ...d, ...p }))
  const snapshot = () => setPrev(JSON.parse(JSON.stringify(draft)) as Slide)

  function switchLayout(target: SlideLayout) {
    if (target === layout) return
    const r = convertSlide(draft, target)
    if (!r.ok) {
      toast.error(r.reason)
      return
    }
    snapshot()
    setDraft(r.slide)
  }

  async function runAi(kind: 'rewrite' | 'convert', target?: SlideLayout) {
    if (aiBusy) return
    setAiBusy(true)
    try {
      const out =
        kind === 'rewrite'
          ? await rewriteSlide(draft, aiNote, model)
          : await aiConvertSlide(draft, target!, model)
      snapshot()
      setDraft(out)
      setChartDraft(chartToDraft(out.chart))
      toast.success(t('slides.aiDone', { defaultValue: 'AI 執好咗，可以再手執' }))
    } catch (e) {
      toast.error((e as Error).message || t('slides.aiFail', { defaultValue: 'AI 失敗，原版唔郁' }))
    } finally {
      setAiBusy(false)
    }
  }

  function undo() {
    if (!prev) return
    setDraft(prev)
    setChartDraft(chartToDraft(prev.chart))
    setPrev(null)
  }

  function save() {
    const title = draft.title.trim() || '（未命名）'
    const bullets = draft.bullets.map((b) => b.trim()).filter(Boolean).slice(0, 6)
    onSave({ ...draft, title, bullets, chart })
  }

  // ───────── 細表單（行列式欄位）─────────

  const listEditor = (
    items: { a: string; b?: string }[],
    labels: [string, string],
    max: number,
    min: number,
    apply: (next: { a: string; b?: string }[]) => void,
  ) => (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input
            value={it.a}
            placeholder={labels[0]}
            onChange={(e) => {
              const next = [...items]
              next[i] = { ...next[i], a: e.target.value }
              apply(next)
            }}
            className="w-32 shrink-0"
          />
          <Input
            value={it.b ?? ''}
            placeholder={labels[1]}
            onChange={(e) => {
              const next = [...items]
              next[i] = { ...next[i], b: e.target.value }
              apply(next)
            }}
            className="min-w-0 flex-1"
          />
          <IconButton
            label={t('slides.removeRow', { defaultValue: '刪行' })}
            size="sm"
            onClick={() => apply(items.filter((_, j) => j !== i))}
            disabled={items.length <= min}
          >
            <Trash2 size={14} />
          </IconButton>
        </div>
      ))}
      {items.length < max && (
        <Button variant="ghost" size="sm" icon={Plus} onClick={() => apply([...items, { a: '' }])}>
          {t('slides.addRow', { defaultValue: '加一行' })}
        </Button>
      )}
    </div>
  )

  return (
    <Modal
      open
      onClose={onClose}
      title={t('slides.editTitle', { defaultValue: '編輯第 {{n}} 版', n: index + 1 })}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="ghost" icon={Undo2} onClick={undo} disabled={!prev}>
            {t('slides.undo', { defaultValue: '復原一步' })}
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t('slides.cancel', { defaultValue: '取消' })}
            </Button>
            <Button icon={Check} onClick={save} disabled={chartInvalid}>
              {t('slides.save', { defaultValue: '儲存呢版' })}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 版式切換 chips */}
        <div className="flex flex-wrap gap-1.5">
          {LAYOUT_OPTS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => switchLayout(o.id)}
              aria-pressed={layout === o.id}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition active:scale-[0.97]',
                layout === o.id
                  ? 'border-accent bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                  : 'border-black/[0.08] text-slate-600 hover:bg-black/[0.03] dark:border-white/10 dark:text-slate-300',
              )}
            >
              <o.icon size={13} /> {o.label}
            </button>
          ))}
        </div>

        <Field label={t('slides.fTitle', { defaultValue: '版面標題' })}>
          <Input value={draft.title} onChange={(e) => patch({ title: e.target.value })} />
        </Field>

        {/* 章節版唔使內容欄位 */}
        {layout !== 'section' && (
          <>
            <Field
              label={t('slides.fBullets', { defaultValue: '要點（每行一點，做後備／講義）' })}
            >
              <Textarea
                rows={4}
                value={draft.bullets.join('\n')}
                onChange={(e) => patch({ bullets: e.target.value.split('\n') })}
              />
            </Field>

            {layout === 'stats' && (
              <Field label={t('slides.fStats', { defaultValue: '大數字（2-4 項）' })}>
                {listEditor(
                  (draft.stats ?? []).map((s) => ({ a: s.value, b: s.label })),
                  [t('slides.statValue', { defaultValue: '數值' }), t('slides.statLabel', { defaultValue: '標籤' })],
                  4,
                  2,
                  (next) =>
                    patch({ stats: next.map((r) => ({ value: r.a, label: r.b ?? '' })) }),
                )}
              </Field>
            )}

            {layout === 'compare' && draft.compare && (
              <div className="grid grid-cols-2 gap-3">
                {(['left', 'right'] as const).map((side) => (
                  <div key={side} className="space-y-1.5">
                    <Input
                      value={side === 'left' ? draft.compare!.leftTitle : draft.compare!.rightTitle}
                      placeholder={t('slides.colTitle', { defaultValue: '欄題' })}
                      onChange={(e) =>
                        patch({
                          compare: {
                            ...draft.compare!,
                            [side === 'left' ? 'leftTitle' : 'rightTitle']: e.target.value,
                          },
                        })
                      }
                    />
                    <Textarea
                      rows={4}
                      value={draft.compare![side].join('\n')}
                      placeholder={t('slides.colItems', { defaultValue: '每行一點（2-4 點）' })}
                      onChange={(e) =>
                        patch({
                          compare: { ...draft.compare!, [side]: e.target.value.split('\n') },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            {layout === 'steps' && (
              <Field label={t('slides.fSteps', { defaultValue: '步驟（2-5 步）' })}>
                {listEditor(
                  (draft.steps ?? []).map((s) => ({ a: s.title, b: s.desc })),
                  [t('slides.stepTitle', { defaultValue: '步驟名' }), t('slides.stepDesc', { defaultValue: '說明（選填）' })],
                  5,
                  2,
                  (next) =>
                    patch({
                      steps: next.map((r) => ({ title: r.a, desc: r.b?.trim() ? r.b : undefined })),
                    }),
                )}
              </Field>
            )}

            {layout === 'quote' && draft.quote && (
              <div className="space-y-2">
                <Field label={t('slides.fQuote', { defaultValue: '金句（≤60 字）' })}>
                  <Textarea
                    rows={2}
                    value={draft.quote.text}
                    onChange={(e) => patch({ quote: { ...draft.quote!, text: e.target.value } })}
                  />
                </Field>
                <Field label={t('slides.fAttribution', { defaultValue: '出處（選填）' })}>
                  <Input
                    value={draft.quote.attribution ?? ''}
                    onChange={(e) =>
                      patch({
                        quote: {
                          ...draft.quote!,
                          attribution: e.target.value.trim() ? e.target.value : undefined,
                        },
                      })
                    }
                  />
                </Field>
              </div>
            )}

            {layout === 'cards' && (
              <Field label={t('slides.fCards', { defaultValue: '分類卡（2-6 張）' })}>
                {listEditor(
                  (draft.cards ?? []).map((c) => ({ a: c.title, b: c.desc })),
                  [t('slides.cardTitle', { defaultValue: '卡題' }), t('slides.cardDesc', { defaultValue: '說明（選填）' })],
                  6,
                  2,
                  (next) =>
                    patch({
                      cards: next.map((r) => ({ title: r.a, desc: r.b?.trim() ? r.b : undefined })),
                    }),
                )}
              </Field>
            )}

            {/* 共通選填欄位 */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('slides.fSubtitle', { defaultValue: '英文對照副題（選填）' })}>
                <Input
                  value={draft.subtitle ?? ''}
                  onChange={(e) => patch({ subtitle: e.target.value.trim() ? e.target.value : undefined })}
                />
              </Field>
              <Field label={t('slides.fImageQuery', { defaultValue: '配相英文搜尋詞（選填）' })}>
                <Input
                  value={draft.imageQuery ?? ''}
                  placeholder="e.g. great wall china"
                  onChange={(e) => patch({ imageQuery: e.target.value.trim() ? e.target.value : undefined })}
                />
              </Field>
            </div>
            <Field label={t('slides.fTakeaway', { defaultValue: '包底重點（選填，≤40 字，會做版底色帶）' })}>
              <Input
                value={draft.takeaway ?? ''}
                onChange={(e) => patch({ takeaway: e.target.value.trim() ? e.target.value : undefined })}
              />
            </Field>
            <Field label={t('slides.fNotes', { defaultValue: '講者備註（選填）' })}>
              <Textarea
                rows={2}
                value={draft.notes ?? ''}
                onChange={(e) => patch({ notes: e.target.value.trim() ? e.target.value : undefined })}
              />
            </Field>

            {/* 圖表 */}
            <div className="space-y-2 rounded-xl border border-black/[0.06] bg-slate-50/60 p-3 dark:border-white/[0.08] dark:bg-slate-800/40">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <BarChart3 size={13} /> {t('slides.fChart', { defaultValue: '數據圖表（選填）' })}
                </span>
                {chartDraft ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => setChartDraft(null)}
                  >
                    {t('slides.removeChart', { defaultValue: '刪除圖表' })}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Plus}
                    onClick={() =>
                      setChartDraft({ type: 'bar', unit: '', categories: '', seriesName: '數據', values: '' })
                    }
                  >
                    {t('slides.addChart', { defaultValue: '加圖表' })}
                  </Button>
                )}
              </div>
              {chartDraft && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={chartDraft.type}
                      onChange={(e) =>
                        setChartDraft({ ...chartDraft, type: e.target.value as ChartDraft['type'] })
                      }
                      className="w-28"
                    >
                      <option value="bar">{t('slides.chartBar', { defaultValue: '棒形' })}</option>
                      <option value="line">{t('slides.chartLine', { defaultValue: '折線' })}</option>
                      <option value="pie">{t('slides.chartPie', { defaultValue: '圓形' })}</option>
                    </Select>
                    <Input
                      value={chartDraft.unit}
                      placeholder={t('slides.chartUnit', { defaultValue: '單位（選填，例 %）' })}
                      onChange={(e) => setChartDraft({ ...chartDraft, unit: e.target.value })}
                      className="w-40"
                    />
                    <Input
                      value={chartDraft.seriesName}
                      placeholder={t('slides.chartSeries', { defaultValue: '系列名' })}
                      onChange={(e) => setChartDraft({ ...chartDraft, seriesName: e.target.value })}
                      className="w-32"
                    />
                  </div>
                  <Field label={t('slides.chartCats', { defaultValue: '標籤（用「、」分隔）' })}>
                    <Input
                      value={chartDraft.categories}
                      placeholder="2021、2022、2023"
                      onChange={(e) => setChartDraft({ ...chartDraft, categories: e.target.value })}
                    />
                  </Field>
                  <Field
                    label={t('slides.chartVals', { defaultValue: '數值（用「、」分隔，要同標籤一樣多）' })}
                    error={chartInvalid ? t('slides.chartInvalid', { defaultValue: '數值要係數字、標籤同數值都唔可以空' }) : undefined}
                  >
                    <Input
                      invalid={chartInvalid}
                      value={chartDraft.values}
                      placeholder="120、150、180"
                      onChange={(e) => setChartDraft({ ...chartDraft, values: e.target.value })}
                    />
                  </Field>
                </div>
              )}
            </div>

            {/* AI 助力 */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/20 bg-accent-soft/40 p-3 dark:bg-accent/10">
              <Input
                value={aiNote}
                placeholder={t('slides.aiHint', { defaultValue: '指示（選填）：例「淺白啲，俾中一學生」' })}
                onChange={(e) => setAiNote(e.target.value)}
                className="min-w-0 flex-1"
              />
              <Button
                variant="secondary"
                icon={Sparkles}
                onClick={() => void runAi('rewrite')}
                loading={aiBusy}
              >
                {t('slides.aiRewrite', { defaultValue: 'AI 重寫呢版' })}
              </Button>
              {layout !== 'bullets' && (
                <Button
                  variant="ghost"
                  icon={Sparkles}
                  onClick={() => void runAi('convert', layout)}
                  loading={aiBusy}
                  title={t('slides.aiConvertHint', { defaultValue: '規則轉完唔靚？交畀 AI 重組做呢個版式' })}
                >
                  {t('slides.aiConvert', { defaultValue: 'AI 幫我轉' })}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
