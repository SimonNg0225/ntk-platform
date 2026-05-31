import { useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
  Trash2,
  Wallet,
} from 'lucide-react'
import { useCollection } from '../../lib/store'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { transactionsCol, txCategoriesCol } from '../../data/collections'
import type { Transaction, TxCategory, TxKind } from '../../data/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Pills,
  SectionTitle,
  Select,
  StatCard,
  Tabs,
  cx,
} from '../../ui'

// ============================================================
//  收支記帳（個人理財，工作模式）
//  純前端、localStorage + Supabase 自動同步。手寫 div 圖表，零 chart lib。
// ============================================================

// ───────── 純函式（放元件外，避免每 render 重建）─────────

/** Date → 'YYYY-MM' */
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 'YYYY-MM' + delta 個月 → 'YYYY-MM'（用原生 Date 計）*/
function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  return monthKey(new Date(y, m - 1 + delta, 1))
}

/** 'YYYY-MM' → 「2026 年 5 月」 */
function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return `${y} 年 ${m} 月`
}

/** 'YYYY-MM-DD' → 「5月23日」 */
function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${m}月${d}日`
}

/** 金額格式：HK$ + 千分位 + 最多 2 位小數，負數 -HK$123 */
function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  return `${sign}HK$${abs}`
}

/** 由今日回推 n 個 'YYYY-MM'（由舊到新）*/
function recentMonths(n: number): string[] {
  const now = new Date()
  const result: string[] = []
  for (let i = n - 1; i >= 0; i -= 1) {
    result.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)))
  }
  return result
}

/** 交易係咪屬於某月 */
function inMonth(tx: Transaction, key: string): boolean {
  return tx.date.slice(0, 7) === key
}

const KIND_PILLS: { id: TxKind; label: string }[] = [
  { id: 'income', label: '收入' },
  { id: 'expense', label: '支出' },
]

// 分類佔比 bar 循環色（令分類易分）
const SLICE_COLORS = [
  'bg-accent',
  'bg-blue-400',
  'bg-amber-400',
  'bg-emerald-400',
  'bg-rose-400',
  'bg-violet-400',
]

const EMOJI_CHOICES = ['🏷️', '💼', '🍜', '🚇', '🛍️', '🧾', '🎮', '🏠', '💊']

// ───────── 頂層元件 ─────────
export default function BudgetTracker() {
  const txs = useCollection(transactionsCol)
  const cats = useCollection(txCategoriesCol)
  const toast = useToast()
  const confirm = useConfirm()

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [tab, setTab] = useState<'list' | 'analysis' | 'categories'>('list')
  const [fKind, setFKind] = useState<'all' | TxKind>('all')

  // 新增 / 編輯 Modal
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [showForm, setShowForm] = useState(false)

  // 搵分類（fallback「未分類」）
  const catOf = (id: string) => cats.find((c) => c.id === id)

  // ───── 本月過濾 + 三大統計 ─────
  const monthTxs = useMemo(
    () =>
      txs
        .filter((t) => inMonth(t, month))
        .sort((a, b) =>
          a.date !== b.date
            ? a.date < b.date
              ? 1
              : -1
            : a.createdAt < b.createdAt
              ? 1
              : -1,
        ),
    [txs, month],
  )

  const stats = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of monthTxs) {
      if (t.kind === 'income') income += t.amount
      else expense += t.amount
    }
    return { income, expense, balance: income - expense }
  }, [monthTxs])

  // ───── 本月支出分類佔比 ─────
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of monthTxs) {
      if (t.kind !== 'expense') continue
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount)
    }
    const total = stats.expense
    return [...map.entries()]
      .map(([categoryId, amount]) => ({
        categoryId,
        amount,
        pct: total > 0 ? Math.round((amount / total) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [monthTxs, stats.expense])

  // ───── 最近 6 個月收支趨勢 ─────
  const trend = useMemo(() => {
    const months = recentMonths(6)
    const rows = months.map((key) => {
      let income = 0
      let expense = 0
      for (const t of txs) {
        if (!inMonth(t, key)) continue
        if (t.kind === 'income') income += t.amount
        else expense += t.amount
      }
      return { key, income, expense }
    })
    const max = Math.max(
      1,
      ...rows.map((r) => Math.max(r.income, r.expense)),
    )
    const hasData = rows.some((r) => r.income > 0 || r.expense > 0)
    return { rows, max, hasData }
  }, [txs])

  const openAdd = () => {
    setEditing(null)
    setShowForm(true)
  }
  const openEdit = (t: Transaction) => {
    setEditing(t)
    setShowForm(true)
  }

  const removeTx = async (t: Transaction) => {
    const ok = await confirm({
      title: '刪除記錄？',
      message: '此筆收支記錄將永久移除，無法復原。',
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    transactionsCol.remove(t.id)
    toast.success('已刪除記錄')
  }

  const visibleTxs =
    fKind === 'all' ? monthTxs : monthTxs.filter((t) => t.kind === fKind)

  return (
    <div className="space-y-4">
      {/* 月份選擇 + 記一筆 */}
      <div className="flex flex-wrap items-center gap-2">
        <IconButton label="上個月" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
          <ChevronLeft size={20} />
        </IconButton>
        <span className="min-w-[7.5rem] text-center text-base font-semibold tabular-nums text-slate-800 dark:text-slate-100">
          {monthLabel(month)}
        </span>
        <IconButton label="下個月" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
          <ChevronRight size={20} />
        </IconButton>
        <Button className="ml-auto" icon={Plus} onClick={openAdd}>
          記一筆
        </Button>
      </div>

      {/* 三大統計 */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <StatCard label="本月收入" value={fmtMoney(stats.income)} icon={TrendingUp} />
        <StatCard label="本月支出" value={fmtMoney(stats.expense)} icon={TrendingDown} />
        <StatCard
          label="本月結餘"
          value={
            stats.balance < 0 ? (
              <span className="text-rose-600 dark:text-rose-400">
                {fmtMoney(stats.balance)}
              </span>
            ) : (
              fmtMoney(stats.balance)
            )
          }
          icon={Wallet}
          highlight
        />
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'list', label: '記錄' },
          { id: 'analysis', label: '分析' },
          { id: 'categories', label: '分類' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* ───── 記錄頁 ───── */}
      {tab === 'list' && (
        <div className="space-y-3 animate-fade-in">
          <Pills
            options={[
              { id: 'all', label: '全部' },
              { id: 'income', label: '收入' },
              { id: 'expense', label: '支出' },
            ]}
            active={fKind}
            onChange={(v) => setFKind(v as 'all' | TxKind)}
          />

          {visibleTxs.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="呢個月暫時冇記錄"
              hint="撳「記一筆」開始記低你嘅收支。"
              action={<Button icon={Plus} onClick={openAdd}>記一筆</Button>}
            />
          ) : (
            <ul className="space-y-2">
              {visibleTxs.map((t) => {
                const cat = catOf(t.categoryId)
                const income = t.kind === 'income'
                return (
                  <Card key={t.id} className="group p-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg dark:bg-slate-700">
                        {cat?.icon ?? '🏷️'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                            {cat?.name ?? '未分類'}
                          </span>
                          {!cat && <Badge tone="slate">未分類</Badge>}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                          {t.note && (
                            <span className="truncate text-slate-500 dark:text-slate-400">
                              {t.note}
                            </span>
                          )}
                          <span className="tabular-nums text-slate-400">{fmtDate(t.date)}</span>
                        </div>
                      </div>
                      <span
                        className={cx(
                          'ml-auto shrink-0 text-sm font-semibold tabular-nums',
                          income
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400',
                        )}
                      >
                        {income ? '+' : '−'}
                        {fmtMoney(t.amount)}
                      </span>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <IconButton label="編輯記錄" onClick={() => openEdit(t)}>
                          <Pencil size={16} />
                        </IconButton>
                        <IconButton
                          label="刪除記錄"
                          tone="danger"
                          onClick={() => removeTx(t)}
                          className="opacity-0 transition group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* ───── 分析頁 ───── */}
      {tab === 'analysis' && (
        <div className="space-y-4 animate-fade-in">
          {/* 本月支出分類佔比 */}
          <Card className="p-4">
            <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
              本月支出分類
            </p>
            {expenseByCategory.length === 0 ? (
              <p className="text-sm text-slate-400">呢個月暫時冇支出記錄。</p>
            ) : (
              <ul className="space-y-3">
                {expenseByCategory.map((row, i) => {
                  const cat = catOf(row.categoryId)
                  return (
                    <li key={row.categoryId}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          <span>{cat?.icon ?? '🏷️'}</span>
                          {cat?.name ?? '未分類'}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                            {fmtMoney(row.amount)}
                          </span>
                          <span className="tabular-nums text-slate-400">{row.pct}%</span>
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <div
                          className={cx(
                            'h-full rounded-full transition-all',
                            SLICE_COLORS[i % SLICE_COLORS.length],
                          )}
                          style={{ width: `${row.pct}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          {/* 最近 6 個月收支趨勢 */}
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                最近 6 個月收支趨勢
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                  收入
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
                  支出
                </span>
              </div>
            </div>
            {!trend.hasData ? (
              <p className="text-sm text-slate-400">未有足夠資料畫趨勢。</p>
            ) : (
              <div className="flex h-40 items-end gap-2">
                {trend.rows.map((r) => {
                  const [, m] = r.key.split('-').map(Number)
                  return (
                    <div key={r.key} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex w-full flex-1 items-end justify-center gap-1">
                        <div
                          title={`收入 ${fmtMoney(r.income)}`}
                          className="w-1/2 max-w-[1.25rem] rounded-t-md bg-emerald-400 transition-all dark:bg-emerald-500"
                          style={{ height: `${(r.income / trend.max) * 100}%` }}
                        />
                        <div
                          title={`支出 ${fmtMoney(r.expense)}`}
                          className="w-1/2 max-w-[1.25rem] rounded-t-md bg-rose-400 transition-all dark:bg-rose-500"
                          style={{ height: `${(r.expense / trend.max) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400">{m}月</span>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ───── 分類頁 ───── */}
      {tab === 'categories' && (
        <div className="animate-fade-in">
          <CategoryManager txs={txs} cats={cats} />
        </div>
      )}

      {/* 新增 / 編輯 Modal */}
      {showForm && (
        <TxFormModal
          key={editing ? `edit-${editing.id}` : 'add'}
          editing={editing}
          cats={cats}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}

// ───────── 新增 / 編輯交易 Modal ─────────
// 由呼叫端用 key 重建，所以初始值只需喺 useState 初始化一次。
function TxFormModal({
  editing,
  cats,
  onClose,
}: {
  editing: Transaction | null
  cats: TxCategory[]
  onClose: () => void
}) {
  const toast = useToast()
  const today = new Date().toISOString().slice(0, 10)

  const [kind, setKind] = useState<TxKind>(editing?.kind ?? 'expense')
  const [amount, setAmount] = useState(
    editing ? String(editing.amount) : '',
  )
  const [date, setDate] = useState(editing?.date ?? today)
  const [note, setNote] = useState(editing?.note ?? '')

  const kindCats = cats.filter((c) => c.kind === kind)
  const [categoryId, setCategoryId] = useState(
    editing?.categoryId ?? kindCats[0]?.id ?? '',
  )

  // 切換 kind：如當前選中分類唔屬新 kind，reset 去該 kind 第一個。
  const switchKind = (k: TxKind) => {
    setKind(k)
    const next = cats.filter((c) => c.kind === k)
    if (!next.some((c) => c.id === categoryId)) {
      setCategoryId(next[0]?.id ?? '')
    }
  }

  const amountNum = Number(amount)
  const valid = amount !== '' && amountNum > 0 && !!categoryId

  const save = () => {
    if (!valid) return
    const payload = {
      kind,
      amount: amountNum,
      categoryId,
      date,
      note: note.trim() || undefined,
    }
    if (editing) {
      transactionsCol.update(editing.id, payload)
      toast.success('已儲存修改')
    } else {
      transactionsCol.add({ ...payload, createdAt: new Date().toISOString() })
      toast.success('已新增記錄')
    }
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={editing ? '編輯記錄' : '記一筆'}>
      <div className="space-y-3">
        <Pills options={KIND_PILLS} active={kind} onChange={switchKind} />

        <Field label="金額（HK$）">
          <Input
            value={amount}
            onChange={(e) =>
              setAmount(
                e.target.value
                  .replace(/[^0-9.]/g, '')
                  .replace(/(\..*)\./g, '$1'),
              )
            }
            placeholder="0.00"
            inputMode="decimal"
          />
        </Field>

        <Field label="分類">
          {kindCats.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400 dark:border-slate-700">
              呢個類型仲未有分類，請先去「分類」頁新增。
            </p>
          ) : (
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {kindCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ''}
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="日期">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>

        <Field label="備註（可選）">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例如：午餐、出糧…"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save} disabled={!valid}>
            {editing ? '儲存修改' : '新增記錄'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ───────── 分類管理 ─────────
function CategoryManager({
  txs,
  cats,
}: {
  txs: Transaction[]
  cats: TxCategory[]
}) {
  const toast = useToast()
  const confirm = useConfirm()

  const [name, setName] = useState('')
  const [kind, setKind] = useState<TxKind>('expense')
  const [icon, setIcon] = useState(EMOJI_CHOICES[0])

  const countByCat = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of txs) map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + 1)
    return map
  }, [txs])

  const add = () => {
    if (!name.trim()) return
    txCategoriesCol.add({
      name: name.trim(),
      kind,
      icon,
      createdAt: new Date().toISOString(),
    })
    toast.success('已新增分類')
    setName('')
    setIcon(EMOJI_CHOICES[0])
  }

  const remove = async (cat: TxCategory) => {
    const ok = await confirm({
      title: '刪除分類？',
      message: '已用咗呢個分類嘅記錄會變成「未分類」，但唔會被刪。',
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    txCategoriesCol.remove(cat.id)
    toast.success('已刪除分類')
  }

  const renderSection = (sectionKind: TxKind, title: string) => {
    const list = cats.filter((c) => c.kind === sectionKind)
    return (
      <div>
        <SectionTitle>{title}</SectionTitle>
        {list.length === 0 ? (
          <p className="text-sm text-slate-400">仲未有分類。</p>
        ) : (
          <Card>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {list.map((c) => (
                <li key={c.id} className="group flex items-center gap-3 px-4 py-2.5">
                  <span className="text-lg">{c.icon ?? '🏷️'}</span>
                  <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">
                    {c.name}
                  </span>
                  <span className="text-xs tabular-nums text-slate-400">
                    {countByCat.get(c.id) ?? 0} 筆
                  </span>
                  <IconButton
                    label={`刪除分類 ${c.name}`}
                    tone="danger"
                    onClick={() => remove(c)}
                    className="opacity-0 transition group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {renderSection('income', '收入分類')}
      {renderSection('expense', '支出分類')}

      {/* 新增分類 */}
      <Card className="space-y-3 border-accent/30 bg-accent-soft/40 p-4">
        <SectionTitle>新增分類</SectionTitle>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[140px] flex-1">
            <Field label="名稱">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                placeholder="例如：保險"
              />
            </Field>
          </div>
          <div className="w-28">
            <Field label="類型">
              <Select
                value={kind}
                onChange={(e) => setKind(e.target.value as TxKind)}
              >
                <option value="income">收入</option>
                <option value="expense">支出</option>
              </Select>
            </Field>
          </div>
          <Button onClick={add} disabled={!name.trim()}>
            新增
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {EMOJI_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => setIcon(choice)}
              aria-pressed={choice === icon}
              aria-label={`揀 emoji ${choice}`}
              className={cx(
                'flex h-9 w-9 items-center justify-center rounded-xl border text-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                choice === icon
                  ? 'border-accent bg-accent-soft text-accent-strong'
                  : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700',
              )}
            >
              {choice}
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}
