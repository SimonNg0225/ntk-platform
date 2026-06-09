import { useRef, useState } from 'react'
import { decksCol, cardsCol } from '../../../data/collections'
import { useToast } from '../../../context/ToastContext'
import { todayStr } from '../../../lib/srs'
import { Button, Field, Modal, Select, Textarea, cx } from '../../../ui'
import { Archive, Download, FileText, FolderInput, Inbox, Layers } from 'lucide-react'
import { cardMetaCol, upsertMeta } from './store'
import type { Card, Deck } from '../../../data/types'
import type { CardMeta } from './types'

// ============================================================
//  匯入 / 匯出（Anki import/export 級）
//  - 匯出：CSV（正面,背面,標籤）或 JSON（連排程 + 中繼）
//  - 匯入：貼 CSV / TSV 文字，或揀 .csv/.json 檔
//    CSV 格式：每行「正面,背面,可選標籤(以 ; 分隔)」
// ============================================================

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

// 簡易 CSV 一行解析（支援引號 + 逗號/Tab 分隔）
function parseLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQ = false
      } else cur += ch
    } else if (ch === '"') inQ = true
    else if (ch === ',' || ch === '\t') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

export default function ImportExport({
  decks,
  open,
  onClose,
}: {
  decks: Deck[]
  open: boolean
  onClose: () => void
}) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<'export' | 'import'>('export')

  // 匯出
  const [exportDeckId, setExportDeckId] = useState<string>(decks[0]?.id ?? '')
  const [exportFmt, setExportFmt] = useState<'csv' | 'json'>('csv')

  // 匯入
  const [importDeckId, setImportDeckId] = useState<string>('__new__')
  const [importText, setImportText] = useState('')

  const doExport = () => {
    const cards = cardsCol.get().filter((c) => c.deckId === exportDeckId)
    if (cards.length === 0) {
      toast.error('呢個牌組冇卡')
      return
    }
    const deck = decks.find((d) => d.id === exportDeckId)
    const metas = cardMetaCol.get()
    const metaById = new Map(metas.map((m) => [m.id, m]))
    const safeName = (deck?.name ?? 'deck').replace(/[^\w一-龥]+/g, '_')

    let blob: Blob
    let filename: string
    if (exportFmt === 'csv') {
      const lines = ['正面,背面,標籤']
      for (const c of cards) {
        const tags = (metaById.get(c.id)?.tags ?? []).join(';')
        lines.push(
          [csvEscape(c.front), csvEscape(c.back), csvEscape(tags)].join(','),
        )
      }
      blob = new Blob(['﻿' + lines.join('\n')], {
        type: 'text/csv;charset=utf-8',
      })
      filename = `${safeName}.csv`
    } else {
      const payload = {
        deck: deck?.name,
        exportedAt: new Date().toISOString(),
        cards: cards.map((c) => ({
          ...c,
          meta: metaById.get(c.id),
        })),
      }
      blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      filename = `${safeName}.json`
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`已匯出 ${cards.length} 張（${exportFmt.toUpperCase()}）`)
  }

  const resolveDeck = (): string => {
    if (importDeckId !== '__new__') return importDeckId
    const name = `匯入 ${todayStr()}`
    const deck = decksCol.add({ name, createdAt: new Date().toISOString() })
    return deck.id
  }

  const importCsvText = (text: string) => {
    const rows = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (rows.length === 0) {
      toast.error('冇內容')
      return
    }
    // 跳過標頭（如果第一行似「正面,背面」）
    const first = parseLine(rows[0])
    const startIdx =
      first[0] === '正面' || first[0]?.toLowerCase() === 'front' ? 1 : 0

    const deckId = resolveDeck()
    let count = 0
    for (let i = startIdx; i < rows.length; i++) {
      const cols = parseLine(rows[i])
      const front = cols[0]?.trim()
      const back = cols[1]?.trim()
      if (!front || !back) continue
      const tags = (cols[2] ?? '')
        .split(/[;，、]/)
        .map((t) => t.trim())
        .filter(Boolean)
      const newCard = cardsCol.add({
        deckId,
        front,
        back,
        ease: 2.5,
        intervalDays: 0,
        repetitions: 0,
        dueDate: todayStr(),
        createdAt: new Date().toISOString(),
      })
      if (tags.length > 0) upsertMeta(newCard.id, { tags })
      count++
    }
    if (count === 0) {
      toast.error('解析唔到任何卡（格式：正面,背面,標籤）')
      return
    }
    toast.success(`已匯入 ${count} 張`)
    setImportText('')
    onClose()
  }

  const importJsonText = (text: string) => {
    try {
      const parsed = JSON.parse(text) as {
        deck?: string
        cards?: (Partial<Card> & { meta?: Partial<CardMeta> })[]
      }
      const cards = Array.isArray(parsed.cards) ? parsed.cards : []
      if (cards.length === 0) {
        toast.error('JSON 入面冇 cards')
        return
      }
      const deckId =
        importDeckId !== '__new__'
          ? importDeckId
          : decksCol.add({
              name: parsed.deck || `匯入 ${todayStr()}`,
              createdAt: new Date().toISOString(),
            }).id
      let count = 0
      for (const c of cards) {
        if (!c.front || !c.back) continue
        const newCard = cardsCol.add({
          deckId,
          front: String(c.front),
          back: String(c.back),
          ease: typeof c.ease === 'number' ? c.ease : 2.5,
          intervalDays: typeof c.intervalDays === 'number' ? c.intervalDays : 0,
          repetitions: typeof c.repetitions === 'number' ? c.repetitions : 0,
          dueDate: typeof c.dueDate === 'string' ? c.dueDate : todayStr(),
          createdAt: new Date().toISOString(),
        })
        if (c.meta?.tags && Array.isArray(c.meta.tags)) {
          upsertMeta(newCard.id, { tags: c.meta.tags as string[] })
        }
        count++
      }
      toast.success(`已匯入 ${count} 張`)
      setImportText('')
      onClose()
    } catch {
      toast.error('JSON 格式唔啱')
    }
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      if (file.name.endsWith('.json')) importJsonText(text)
      else importCsvText(text)
    }
    reader.readAsText(file)
  }

  const doImportText = () => {
    const t = importText.trim()
    if (!t) {
      toast.error('貼啲內容先')
      return
    }
    if (t.startsWith('{') || t.startsWith('[')) importJsonText(t)
    else importCsvText(t)
  }

  const exportCount = cardsCol.get().filter((c) => c.deckId === exportDeckId).length

  return (
    <Modal open={open} onClose={onClose} title="匯入 / 匯出" size="lg">
      {/* 卡盒檔案標題區：kicker + serif，呼應實體卡盒「歸檔 / 入盒」 */}
      <div className="-mt-1 mb-4 border-l-2 border-rose-300/70 pl-3 dark:border-rose-500/40">
        <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.28em] text-accent/70">
          <Archive size={12} />
          卡盒檔案室
        </p>
        <p className="mt-1 text-lg font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100">
          備份卡盒，或者入一批新卡
        </p>
      </div>

      {/* 抽屜分頁：兩格索引卡標籤（active 帶紅脊 + 紙面） */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(
          [
            { id: 'export', label: '備份匯出', sub: '整疊存落本機', icon: Download },
            { id: 'import', label: '匯入入盒', sub: '貼或揀檔加入', icon: Inbox },
          ] as const
        ).map((t) => {
          const active = tab === t.id
          const I = t.icon
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={active}
              onClick={() => setTab(t.id)}
              className={cx(
                'group relative overflow-hidden rounded-xl border bg-white px-3 py-2.5 text-left transition dark:bg-slate-800',
                active
                  ? 'border-accent/40 shadow-xs dark:border-accent/40'
                  : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600',
              )}
            >
              {/* 索引卡紅margin線（active 變 accent） */}
              <span
                aria-hidden="true"
                className={cx(
                  'absolute inset-y-0 left-0 w-1',
                  active ? 'bg-accent' : 'bg-rose-200/70 dark:bg-rose-500/25',
                )}
              />
              <span className="flex items-center gap-2 pl-1.5">
                <span
                  className={cx(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition',
                    active
                      ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                      : 'bg-slate-100 text-slate-400 group-hover:text-slate-500 dark:bg-slate-700/60 dark:text-slate-400',
                  )}
                >
                  <I size={15} />
                </span>
                <span className="min-w-0">
                  <span
                    className={cx(
                      'block text-sm font-semibold',
                      active
                        ? 'text-accent-strong dark:text-accent'
                        : 'text-slate-700 dark:text-slate-200',
                    )}
                  >
                    {t.label}
                  </span>
                  <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                    {t.sub}
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {tab === 'export' ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            揀個牌組備份落本機——CSV 方便用 Excel 開，JSON 連埋排程進度。
          </p>
          <Field label="牌組">
            <Select
              value={exportDeckId}
              onChange={(e) => setExportDeckId(e.target.value)}
              aria-label="匯出牌組"
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="格式">
            <Select
              value={exportFmt}
              onChange={(e) => setExportFmt(e.target.value as 'csv' | 'json')}
              aria-label="匯出格式"
            >
              <option value="csv">CSV（正面, 背面, 標籤）— Excel 開得</option>
              <option value="json">JSON（連排程進度 + 中繼，可完整還原）</option>
            </Select>
          </Field>

          {/* 出貨單：將要備份嘅一疊卡（serif 大數字 + 紅脊） */}
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-slate-700/60 dark:bg-slate-800">
            <span aria-hidden="true" className="block h-1 w-full bg-rose-300/70 dark:bg-rose-500/30" />
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                <Layers size={20} strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  即將備份
                </p>
                <p className="flex items-baseline gap-1.5 leading-none">
                  <span className="text-2xl font-semibold tabular-nums slashed-zero text-slate-800 dark:text-slate-100">
                    {exportCount}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    張卡 · {exportFmt.toUpperCase()}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <Button onClick={doExport} icon={Download} fullWidth disabled={!exportDeckId || exportCount === 0}>
            下載這疊卡
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            貼上 CSV / TSV 或 JSON，亦可以揀檔——一次過入一批卡。
          </p>
          <Field label="匯入去">
            <Select
              value={importDeckId}
              onChange={(e) => setImportDeckId(e.target.value)}
              aria-label="匯入去邊個牌組"
            >
              <option value="__new__">＋ 新牌組</option>
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="貼上內容（CSV / TSV：每行「正面,背面,標籤」；或 JSON）">
            {/* 貼卡台：紅margin線 + Q/A 行頭提示，呼應一張張索引卡 */}
            <div className="overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700">
              <div className="flex items-center gap-2 border-b border-slate-200/80 bg-slate-50/80 px-3 py-1.5 dark:border-slate-700/60 dark:bg-slate-800/60">
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <FileText size={11} /> 每行一張
                </span>
                <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                  <span className="text-accent/70">正面</span>,
                  <span className="text-accent/70">背面</span>,標籤
                </span>
              </div>
              <Textarea
                rows={6}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={'光合作用係咩?,植物用光造養分,生物;DSE\n需求定律,價跌量升,經濟'}
                className="rounded-none border-0 font-mono text-base shadow-none focus:ring-0 sm:text-xs"
                aria-label="貼上匯入內容（CSV / TSV 或 JSON）"
              />
            </div>
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={doImportText} icon={Inbox} disabled={!importText.trim()}>
              入盒
            </Button>
            <Button variant="secondary" icon={FolderInput} onClick={() => fileRef.current?.click()}>
              選 .csv / .json 檔
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt,.json"
              className="hidden"
              aria-label="選擇 CSV 或 JSON 檔匯入"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
                e.target.value = ''
              }}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
