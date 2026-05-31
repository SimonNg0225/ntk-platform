import { useEffect, useMemo, useState } from 'react'
import { Sparkles, Star, Tag } from 'lucide-react'
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
      <div className="space-y-4">
        {/* 日期 + 精選 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="日子" hint={longDate(draft.date)}>
              <Input
                type="date"
                value={draft.date}
                max={todayKey()}
                onChange={(e) => set('date', e.target.value || todayKey())}
              />
            </Field>
          </div>
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

        {dupDate && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            呢一日已經有日誌，新建呢篇會同日並存（你亦可改返做其他日子）。
          </p>
        )}

        {/* 標題 */}
        <Field label="標題（選填）">
          <Input
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="例如：終於搞清楚供求曲線"
            maxLength={80}
          />
        </Field>

        {/* 心情 + 天氣 */}
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
                    onClick={() => set('mood', on ? '' : m.emoji)}
                    className={
                      'flex h-10 flex-1 items-center justify-center rounded-lg border text-lg transition ' +
                      (on
                        ? 'border-accent bg-accent-soft dark:border-accent/50 dark:bg-accent/15'
                        : 'border-slate-200 opacity-50 hover:opacity-100 dark:border-slate-700')
                    }
                  >
                    {m.emoji}
                  </button>
                )
              })}
            </div>
          </Field>
          <Field label="天氣">
            <div className="flex flex-wrap gap-1.5">
              {WEATHER.map((w) => {
                const on = draft.weather === w
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => set('weather', on ? '' : w)}
                    className={
                      'flex h-10 w-10 items-center justify-center rounded-lg border text-lg transition ' +
                      (on
                        ? 'border-accent bg-accent-soft dark:border-accent/50 dark:bg-accent/15'
                        : 'border-slate-200 opacity-50 hover:opacity-100 dark:border-slate-700')
                    }
                  >
                    {w}
                  </button>
                )
              })}
            </div>
          </Field>
        </div>

        {/* 內文 */}
        <Field
          label="今日反思"
          hint={`提示：${promptOfDay(draft.date)}　·　用 #標籤 分類`}
        >
          <Textarea
            value={draft.content}
            onChange={(e) => set('content', e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
            }}
            rows={7}
            autoFocus={!editing}
            placeholder="寫低今日學到嘅嘢、突破、困難…（⌘/Ctrl + Enter 儲存）"
          />
        </Field>

        {/* 字數 + 標籤預覽 */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Sparkles size={12} />
            {words} 字
          </span>
          {tags.length > 0 && (
            <span className="inline-flex flex-wrap items-center gap-1">
              <Tag size={12} />
              {tags.map((t) => (
                <Badge key={t} tone="accent">
                  #{t}
                </Badge>
              ))}
            </span>
          )}
        </div>

        {/* 感恩 */}
        <Field label="今日感恩（選填）" hint="一句話，記低一件值得感恩嘅小事">
          <Input
            value={draft.gratitude}
            onChange={(e) => set('gratitude', e.target.value)}
            placeholder="例如：多謝同學耐心同我解釋難題 🙏"
            maxLength={120}
          />
        </Field>
      </div>
    </Modal>
  )
}
