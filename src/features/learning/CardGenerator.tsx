import { useState } from 'react'
import { Bot, Lock, Sparkles, Brain, Plus, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { complete, isAIConfigured, type AIModel } from '../../lib/aiClient'
import { parseJsonArray } from '../../lib/aiJson'
import { decksCol, cardsCol } from '../../data/collections'
import { useCollection, uid } from '../../lib/store'
import { todayStr } from '../../lib/srs'
import {
  Button,
  Input,
  Textarea,
  Select,
  Field,
  Card,
  Badge,
  SectionTitle,
  EmptyState,
  Tabs,
  IconButton,
  cx,
} from '../../ui'

// ============================================================
//  AI 生成知識卡 → 直接入牌組
//  ------------------------------------------------------------
//  貼上主題 / 筆記 → 揀數量 → complete() 要 Gemini 回 JSON
//  陣列 → 經 aiJson.parseJsonArray 安全解析 → 可編輯 / 可剔選
//  預覽 → 揀現有 / 新牌組一鍵寫入 cardsCol（SRS 初始排程）。
//  零新 collection、零新 type，完全重用 decksCol / cardsCol。
// ============================================================

// 預覽用嘅本地輔助型別（唔 export；寫入 cardsCol 時唔帶 id，
// 由 cardsCol.add 自動生成）。
type DraftCard = { id: string; front: string; back: string; include: boolean }

const MODELS: { id: AIModel; label: string }[] = [
  { id: 'gemini-2.5-flash', label: 'Flash（快）' },
  { id: 'gemini-2.5-pro', label: 'Pro（強）' },
]

const COUNTS = [5, 8, 10, 15]

const SYSTEM_PROMPT =
  '你係一個幫人製作知識卡（flashcards）嘅助手。請根據用家提供嘅主題或筆記，' +
  '生成指定數量嘅知識卡。淨係輸出一個 JSON 陣列，陣列每一項係 ' +
  '{"front":"問題","back":"答案"}，front 同 back 都係繁體中文字串，' +
  'front 為簡短問題或提示、back 為清晰答案。唔好輸出任何解說文字、' +
  '唔好用 markdown、唔好加 ```，淨係回個 JSON 陣列。'

// 目標牌組 tab
type DeckTab = 'existing' | 'new'

export default function CardGenerator() {
  const { user } = useAuth()
  const toast = useToast()
  const decks = useCollection(decksCol)

  // 設定
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(8)
  const [model, setModel] = useState<AIModel>('gemini-2.5-flash')
  const [busy, setBusy] = useState(false)

  // 預覽
  const [drafts, setDrafts] = useState<DraftCard[]>([])

  // 目標牌組
  const [deckTab, setDeckTab] = useState<DeckTab>(
    decks.length > 0 ? 'existing' : 'new',
  )
  const [chosenDeckId, setChosenDeckId] = useState<string>('')
  const [newDeckName, setNewDeckName] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedCount = drafts.filter((d) => d.include).length

  // ── 守門：未啟用 / 未登入 ──────────────────────────────────
  if (!isAIConfigured) {
    return (
      <EmptyState
        icon={Bot}
        title="AI 助手未啟用"
        hint="要設定好 Supabase 並部署 gemini Edge Function 先用到。步驟見 docs/SETUP.md。"
      />
    )
  }
  if (!user) {
    return (
      <EmptyState
        icon={Lock}
        title="請先登入先可以用 AI"
        hint="喺左下角用 Google 登入後就用得。"
      />
    )
  }

  // ── 生成 ──────────────────────────────────────────────────
  async function generate() {
    const t = topic.trim()
    if (!t || busy) return
    setBusy(true)
    try {
      const raw = await complete({
        messages: [
          {
            role: 'user',
            content: `主題 / 筆記：\n${t}\n\n請生成 ${count} 張知識卡。`,
          },
        ],
        system: SYSTEM_PROMPT,
        model,
      })

      const parsed = parseJsonArray<{ front?: unknown; back?: unknown }>(raw)
      if (!parsed) {
        toast.error('AI 回覆格式唔啱，請再試或換 Pro 模型')
        return
      }

      // 逐項 runtime 驗證：要係 object、有非空 string front + back
      const valid: DraftCard[] = parsed
        .filter(
          (c): c is { front: string; back: string } =>
            !!c &&
            typeof c === 'object' &&
            typeof (c as { front?: unknown }).front === 'string' &&
            typeof (c as { back?: unknown }).back === 'string' &&
            (c as { front: string }).front.trim() !== '' &&
            (c as { back: string }).back.trim() !== '',
        )
        .map((c) => ({
          id: uid(),
          front: c.front.trim(),
          back: c.back.trim(),
          include: true,
        }))

      if (valid.length === 0) {
        toast.error('AI 回覆格式唔啱，請再試或換 Pro 模型')
        return
      }

      setDrafts(valid)
      toast.success(`生成咗 ${valid.length} 張，下面校對下就可以入牌組`)
    } catch (e) {
      const err = e as Error
      if (err.name !== 'AbortError') toast.error(err.message || 'AI 出錯')
    } finally {
      setBusy(false)
    }
  }

  // ── 預覽操作 ──────────────────────────────────────────────
  function patchDraft(id: string, patch: Partial<DraftCard>) {
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }
  function removeDraft(id: string) {
    setDrafts((ds) => ds.filter((d) => d.id !== id))
  }
  function clearDrafts() {
    setDrafts([])
  }

  // ── 寫入牌組 ──────────────────────────────────────────────
  function save() {
    const chosen = drafts.filter((d) => d.include)
    if (chosen.length === 0 || saving) return

    let deckId: string
    let deckName: string

    if (deckTab === 'new') {
      const name = newDeckName.trim()
      if (!name) return
      const deck = decksCol.add({
        name,
        createdAt: new Date().toISOString(),
      })
      deckId = deck.id
      deckName = deck.name
    } else {
      if (!chosenDeckId) return
      const deck = decks.find((d) => d.id === chosenDeckId)
      if (!deck) return
      deckId = deck.id
      deckName = deck.name
    }

    setSaving(true)
    try {
      for (const d of chosen) {
        cardsCol.add({
          deckId,
          front: d.front.trim(),
          back: d.back.trim(),
          ease: 2.5,
          intervalDays: 0,
          repetitions: 0,
          dueDate: todayStr(),
          createdAt: new Date().toISOString(),
        })
      }
      toast.success(`已加入 ${chosen.length} 張卡到「${deckName}」`)
      // 清空預覽以便再生成；保留設定方便再嚟一轉
      setDrafts([])
      setNewDeckName('')
    } finally {
      setSaving(false)
    }
  }

  const canSave =
    selectedCount > 0 &&
    !saving &&
    (deckTab === 'new' ? newDeckName.trim() !== '' : chosenDeckId !== '')

  return (
    <div className="space-y-4">
      {/* ① 生成設定 */}
      <Card className="space-y-3 p-4">
        <SectionTitle>① 生成設定</SectionTitle>

        <Field
          label="主題 / 筆記內容"
          hint="貼上你想做成知識卡嘅內容，越具體越好。"
        >
          <Textarea
            rows={6}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={busy}
            placeholder="例如：市場營銷 4P：產品、價格、地點、推廣…"
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          <Field label="卡片數量">
            <Select
              className="w-auto"
              value={String(count)}
              onChange={(e) => setCount(Number(e.target.value))}
              disabled={busy}
            >
              {COUNTS.map((n) => (
                <option key={n} value={n}>
                  {n} 張
                </option>
              ))}
            </Select>
          </Field>

          <Field label="模型">
            <Select
              className="w-auto"
              value={model}
              onChange={(e) => setModel(e.target.value as AIModel)}
              disabled={busy}
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => void generate()}
            disabled={!topic.trim() || busy}
            loading={busy}
            icon={Sparkles}
          >
            {busy ? '生成中…' : '生成知識卡'}
          </Button>
          {busy && (
            <span className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              AI 思考緊…
            </span>
          )}
        </div>
      </Card>

      {/* ② 預覽 / 編輯 */}
      {drafts.length > 0 && (
        <Card className="space-y-3 p-4">
          <SectionTitle
            right={
              <Badge tone="accent">
                已揀 <span className="nums">{selectedCount} / {drafts.length}</span> 張
              </Badge>
            }
          >
            ② 預覽 / 編輯
          </SectionTitle>

          <ul className="space-y-2">
            {drafts.map((d) => (
              <li
                key={d.id}
                className={cx(
                  'group flex items-start gap-2 rounded-xl border p-3 transition',
                  d.include
                    ? 'border-accent/30 bg-accent-soft/40 dark:border-accent/40 dark:bg-accent/10'
                    : 'border-slate-200 bg-white opacity-60 dark:border-slate-700 dark:bg-slate-800',
                )}
              >
                <input
                  type="checkbox"
                  checked={d.include}
                  onChange={(e) => patchDraft(d.id, { include: e.target.checked })}
                  aria-label="是否加入呢張"
                  className="mt-1.5 h-4 w-4 shrink-0 cursor-pointer accent-accent"
                />

                <div className="min-w-0 flex-1 space-y-2">
                  <Field label="正面（問題）">
                    <Input
                      value={d.front}
                      onChange={(e) => patchDraft(d.id, { front: e.target.value })}
                      placeholder="問題"
                    />
                  </Field>
                  <Field label="背面（答案）">
                    <Textarea
                      rows={2}
                      value={d.back}
                      onChange={(e) => patchDraft(d.id, { back: e.target.value })}
                      placeholder="答案"
                    />
                  </Field>
                </div>

                <IconButton
                  label="移除呢張"
                  tone="danger"
                  onClick={() => removeDraft(d.id)}
                  className="opacity-0 transition group-hover:opacity-100"
                >
                  <X size={18} strokeWidth={2} />
                </IconButton>
              </li>
            ))}
          </ul>

          {/* ③ 目標牌組 + 寫入 */}
          <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-700">
            <SectionTitle>③ 加入邊個牌組</SectionTitle>

            <Tabs<DeckTab>
              tabs={[
                { id: 'existing', label: '現有牌組' },
                { id: 'new', label: '新牌組' },
              ]}
              active={deckTab}
              onChange={setDeckTab}
            />

            {deckTab === 'existing' ? (
              decks.length > 0 ? (
                <Select
                  value={chosenDeckId}
                  onChange={(e) => setChosenDeckId(e.target.value)}
                  aria-label="揀現有牌組"
                >
                  <option value="">（揀一個牌組）</option>
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  仲未有牌組，切去「新牌組」起一個。
                </p>
              )
            ) : (
              <Input
                value={newDeckName}
                onChange={(e) => setNewDeckName(e.target.value)}
                placeholder="新牌組名稱（例如 市場營銷）"
              />
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" onClick={clearDrafts}>
                重新生成
              </Button>
              <Button onClick={save} disabled={!canSave} icon={Plus}>
                加入牌組（<span className="nums">{selectedCount}</span> 張）
              </Button>
            </div>

            <p className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              <Brain size={14} className="shrink-0" />
              加入後去「知識卡 + 複習」即刻溫。
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
