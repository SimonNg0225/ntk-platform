import { useRef, useState } from 'react'
import { decksCol, cardsCol } from '../../../data/collections'
import { useToast } from '../../../context/ToastContext'
import { todayStr } from '../../../lib/srs'
import { Button, Modal, Select, Textarea } from '../../../ui'
import { Download, Upload } from 'lucide-react'
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

  return (
    <Modal open={open} onClose={onClose} title="匯入 / 匯出" size="lg">
      <div className="mb-4 flex w-full gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800/80">
        <button
          type="button"
          aria-pressed={tab === 'export'}
          onClick={() => setTab('export')}
          className={tabCls(tab === 'export')}
        >
          <Download size={15} /> 匯出
        </button>
        <button
          type="button"
          aria-pressed={tab === 'import'}
          onClick={() => setTab('import')}
          className={tabCls(tab === 'import')}
        >
          <Upload size={15} /> 匯入
        </button>
      </div>

      {tab === 'export' ? (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              牌組
            </label>
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
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              格式
            </label>
            <Select
              value={exportFmt}
              onChange={(e) => setExportFmt(e.target.value as 'csv' | 'json')}
              aria-label="匯出格式"
            >
              <option value="csv">CSV（正面, 背面, 標籤）— Excel 開得</option>
              <option value="json">JSON（連排程進度 + 中繼，可完整還原）</option>
            </Select>
          </div>
          <Button onClick={doExport} icon={Download} fullWidth disabled={!exportDeckId}>
            下載
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              匯入去
            </label>
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
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              貼上內容（CSV / TSV：每行「正面,背面,標籤」；或 JSON）
            </label>
            <Textarea
              rows={6}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={'光合作用係咩?,植物用光造養分,生物;DSE\n需求定律,價跌量升,經濟'}
              className="font-mono text-xs"
              aria-label="貼上匯入內容（CSV / TSV 或 JSON）"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={doImportText} icon={Upload} disabled={!importText.trim()}>
              匯入文字
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
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

function tabCls(active: boolean): string {
  return [
    'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition',
    active
      ? 'bg-white text-slate-800 shadow-xs dark:bg-slate-700 dark:text-slate-100'
      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
  ].join(' ')
}
