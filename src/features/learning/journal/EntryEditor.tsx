import { useEffect, useMemo, useState } from 'react'
import { BookText, Quote, Sparkles, Star, Tag } from 'lucide-react'
import { Badge, Button, Field, Input, Modal, Textarea } from '../../../ui'
import {
  MOODS,
  WEATHER,
  countWords,
  longDate,
  parseTags,
  promptOfDay,
  todayKey,
  type JournalDoc,
} from './util'

// ============================================================
//  學習日誌 — 條目編輯器（新建 / 編輯共用一個 Modal）
// ============================================================

export interface EntryDraft {
  date: string
  title: string
  content: string
  mood: string
  weather: string
  gratitude: string
  favorite: boolean
}

function blankDraft(date: string): EntryDraft {
  return { date, title: '', content: '', mood: '', weather: '', gratitude: '', favorite: false }
}

// 天氣 emoji 嘅可讀名（無障礙標籤用）
const WEATHER_LABEL: Record<string, string> = {
  '☀️': '晴天',
  '⛅': '多雲',
  '☁️': '陰天',
  '🌧️': '落雨',
  '⛈️': '雷雨',
  '❄️': '落雪',
  '🌫️': '有霧',
}

export function draftFromDoc(doc: JournalDoc): EntryDraft {
  return {
    date: doc.date,
    title: doc.title ?? '',
    content: doc.content,
    mood: doc.mood ?? '',
    weather: doc.weather ?? '',
    gratitude: doc.gratitude ?? '',
    favorite: doc.favorite ?? false,
  }
}

export function EntryEditor({
  open,
  initial,
  initialDate,
  existingDates,
  onClose,
  onSave,
}: {
  open: boolean
  /** 有 = 編輯模式；無 = 新建 */
  initial?: JournalDoc
  /** 新建時預設日子 */
  initialDate?: string
  /** 已有日誌嘅日子集合（提示同日已有紀錄） */
  existingDates: Set<string>
  onClose: () => void
  onSave: (draft: EntryDraft) => void
}) {
  const [draft, setDraft] = useState<EntryDraft>(() =>
    initial ? draftFromDoc(initial) : blankDraft(initialDate ?? todayKey()),
  )

  // 每次開 modal 重設 draft
  useEffect(() => {
    if (!open) return
    setDraft(initial ? draftFromDoc(initial) : blankDraft(initialDate ?? todayKey()))
  }, [open, initial, initialDate])

  const set = <K extends keyof EntryDraft>(k: K, v: EntryDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }))

  const words = useMemo(() => countWords(draft.content), [draft.content])
  const tags = useMemo(() => parseTags(draft.content), [draft.content])
  const canSave = draft.content.trim().length > 0
  const editing = Boolean(initial)
  const dupDate =
    !editing && existingDates.has(draft.date) ? draft.date : null

  const submit = () => {
    if (!canSave) return
    onSave({ ...draft, content: draft.content.trim(), title: draft.title.trim(), gratitude: draft.gratitude.trim() })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? '編輯日誌' : '寫新日誌'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={!canSave}>
            {editing ? '儲存修改' : '儲存日誌'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* ───────── 日記扉頁 dateline：kicker + serif 長日期，呼應主畫面 masthead。
             日期 input 同精選戳收喺右側細控件，唔搶 serif 標題 ───────── */}
        <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-slate-200/80 pb-4 dark:border-slate-700/60">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
              <BookText size={13} className="shrink-0" />
              {editing ? '日記 · Journal' : '新一頁 · New Entry'}
            </p>
            <p className="mt-1 text-xl font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100 sm:text-[22px]">
              {longDate(draft.date)}
            </p>
          </div>
          <div className="flex shrink-0 items-end gap-2">
            <label className="block w-[8.5rem] sm:w-[9.5rem]">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                日子
              </span>
              <Input
                type="date"
                value={draft.date}
                max={todayKey()}
                onChange={(e) => set('date', e.target.value || todayKey())}
                aria-label="日誌日子"
                className="h-[38px]"
              />
            </label>
            {/* 精選＝書頁角上嘅蠟印（press-toggle） */}
            <button
              type="button"
              onClick={() => set('favorite', !draft.favorite)}
              className={
                'inline-flex h-[38px] items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition ' +
                (draft.favorite
                  ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800')
              }
              aria-pressed={draft.favorite}
            >
              <Star size={15} className={draft.favorite ? 'fill-amber-400 text-amber-400' : ''} />
              精選
            </button>
          </div>
        </header>

        {dupDate && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            呢一日已經有日誌，新建呢篇會同日並存（你亦可改返做其他日子）。
          </p>
        )}

        {/* 標題：日誌嘅標頭，serif 寫出書頁標題感。只加/字重（唔掂字級，
             保留共用 FIELD 嘅手機 16px → 唔觸發 iOS zoom） */}
        <Field label="標題（選填）">
          <Input
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="例如：終於搞清楚供求曲線"
            maxLength={80}
            className="font-semibold tracking-tight placeholder:font-sans placeholder:font-normal"
          />
        </Field>

        {/* 心情 + 天氣：兩格「戳印」選擇 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="今日心情">
            <div className="flex gap-1.5">
              {MOODS.map((m) => {
                const on = draft.mood === m.emoji
                return (
                  <button
                    key={m.emoji}
                    type="button"
                    title={m.label}
                    aria-label={m.label}
                    aria-pressed={on}
                    onClick={() => set('mood', on ? '' : m.emoji)}
                    className={
                      'flex h-10 flex-1 items-center justify-center rounded-lg border text-lg transition ' +
                      (on
                        ? 'border-accent bg-accent-soft dark:border-accent/50 dark:bg-accent/15'
                        : 'border-slate-200 opacity-50 hover:opacity-100 dark:border-slate-700')
                    }
                  >
                    <span aria-hidden="true">{m.emoji}</span>
                  </button>
                )
              })}
            </div>
          </Field>
          <Field label="天氣">
            <div className="flex flex-wrap gap-1.5">
              {WEATHER.map((w) => {
                const on = draft.weather === w
                const label = WEATHER_LABEL[w] ?? '天氣'
                return (
                  <button
                    key={w}
                    type="button"
                    title={label}
                    aria-label={label}
                    aria-pressed={on}
                    onClick={() => set('weather', on ? '' : w)}
                    className={
                      'flex h-10 w-10 items-center justify-center rounded-lg border text-lg transition ' +
                      (on
                        ? 'border-accent bg-accent-soft dark:border-accent/50 dark:bg-accent/15'
                        : 'border-slate-200 opacity-50 hover:opacity-100 dark:border-slate-700')
                    }
                  >
                    <span aria-hidden="true">{w}</span>
                  </button>
                )
              })}
            </div>
          </Field>
        </div>

        {/* ───────── 今日反思：稿紙寫作面。serif 標頭 + 每日提示做 serif 引文，
             textarea 加舒適行距；底部 colophon 行（serif italic 字數）+ 標籤戳 ───────── */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-base font-semibold tracking-tight text-slate-700 dark:text-slate-200">
              今日反思
            </span>
            <span className="text-[11px] italic text-slate-400 dark:text-slate-500">
              用 #標籤 分類
            </span>
          </div>

          {/* 每日提示：serif 引文（呼應主畫面邀請卡） */}
          <p className="mb-2.5 flex items-start gap-1.5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
            <Quote size={13} className="mt-0.5 shrink-0 text-accent/60" aria-hidden="true" />
            <span className="italic">「{promptOfDay(draft.date)}」</span>
          </p>

          <Textarea
            value={draft.content}
            onChange={(e) => set('content', e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
            }}
            rows={7}
            autoFocus={!editing}
            placeholder="寫低今日學到嘅嘢、突破、困難…（⌘/Ctrl + Enter 儲存）"
            className="leading-relaxed"
          />

          {/* colophon：字數（serif）+ 即時標籤戳 */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="inline-flex items-center gap-1 text-xs tabular-nums text-slate-400 dark:text-slate-500">
              <Sparkles size={12} aria-hidden="true" />
              {words} 字
            </span>
            {tags.length > 0 && (
              <span className="inline-flex flex-wrap items-center gap-1">
                <Tag size={12} className="text-slate-400 dark:text-slate-500" aria-hidden="true" />
                {tags.map((t) => (
                  <Badge key={t} tone="accent">
                    #{t}
                  </Badge>
                ))}
              </span>
            )}
          </div>
        </div>

        {/* ───────── 今日感恩：emerald 紙籤框，呼應日誌卡嘅感恩條（input 用回共用樣式） ───────── */}
        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/50 p-3.5 dark:border-emerald-500/25 dark:bg-emerald-500/5">
          <Field
            label="今日感恩（選填）"
            hint="一句話，記低一件值得感恩嘅小事"
          >
            <Input
              value={draft.gratitude}
              onChange={(e) => set('gratitude', e.target.value)}
              placeholder="例如：多謝同學耐心同我解釋難題 🙏"
              maxLength={120}
            />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
