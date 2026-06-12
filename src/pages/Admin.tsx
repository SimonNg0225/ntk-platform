import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  LayoutDashboard,
  Users,
  Gauge,
  Building2,
  Megaphone,
  RefreshCw,
  Check,
  RotateCcw,
  Trash2,
  Pencil,
  Plus,
} from 'lucide-react'
import {
  Card,
  SectionTitle,
  Badge,
  Button,
  Input,
  Select,
  Field,
  Tabs,
  StatCard,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  EmptyState,
  Modal,
  cx,
} from '../ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import {
  isAdminEmail,
  adminOverview,
  adminListUsers,
  adminSetPlan,
  adminUsage,
  adminListOrgs,
  adminListAnnouncements,
  adminSaveAnnouncement,
  adminDeleteAnnouncement,
  adminListTickets,
  adminSetTicketStatus,
  type AdminOverview,
  type AdminUser,
  type AdminUsage,
  type AdminOrg,
  type Announcement,
  type AdminTicket,
} from '../lib/admin'

// ============================================================
//  後台管理系統（EziTeach Admin）
//  ------------------------------------------------------------
//  四大模組：用戶+訂閱 / 用量+AI成本 / 學校B2B / 內容+支援。
//  只 admin（VITE_ADMIN_EMAILS）顯示；真正權限由 admin Edge Function 驗。
// ============================================================

type TabId = 'overview' | 'users' | 'usage' | 'orgs' | 'content'

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('zh-HK', { year: '2-digit', month: '2-digit', day: '2-digit' }) : '—'
const fmtDateTime = (s: string) => new Date(s).toLocaleString('zh-HK')
const usd = (n: number) => `US$${n.toFixed(2)}`

export default function Admin() {
  const { user } = useAuth()
  const [tab, setTab] = useState<TabId>('overview')
  const isAdmin = isAdminEmail(user?.email)

  if (!isAdmin) {
    return (
      <Card className="p-8">
        <EmptyState icon="🔒" title="冇權限" hint="呢個後台只限管理員存取。" />
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <Tabs<TabId>
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: '概覽' },
          { id: 'users', label: '用戶 + 訂閱' },
          { id: 'usage', label: '用量 + AI 成本' },
          { id: 'orgs', label: '學校 B2B' },
          { id: 'content', label: '內容 + 支援' },
        ]}
        icons={{
          overview: LayoutDashboard,
          users: Users,
          usage: Gauge,
          orgs: Building2,
          content: Megaphone,
        }}
      />
      {tab === 'overview' && <OverviewTab onJump={setTab} />}
      {tab === 'users' && <UsersTab />}
      {tab === 'usage' && <UsageTab />}
      {tab === 'orgs' && <OrgsTab />}
      {tab === 'content' && <ContentTab />}
    </div>
  )
}

// 共用：載入狀態 hook
function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const reload = () => {
    setLoading(true)
    setErr(null)
    fn()
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : '載入失敗'))
      .finally(() => setLoading(false))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, deps)
  return { data, loading, err, reload }
}

function Toolbar({ loading, onReload, children }: { loading: boolean; onReload: () => void; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-1 items-center gap-2">{children}</div>
      <button
        onClick={onReload}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-accent"
      >
        <RefreshCw size={13} className={cx(loading && 'animate-spin')} /> 重新整理
      </button>
    </div>
  )
}

function LoadErr({ loading, err, empty }: { loading: boolean; err: string | null; empty?: boolean }) {
  if (loading) return <p className="py-8 text-center text-sm text-slate-400">載入中…</p>
  if (err) return <p className="py-8 text-center text-sm text-rose-500">{err}</p>
  if (empty) return <EmptyState icon="📭" title="暫時冇資料。" />
  return null
}

// ════════════ 概覽 ════════════
function OverviewTab({ onJump }: { onJump: (t: TabId) => void }) {
  const { data, loading, err, reload } = useAsync<AdminOverview>(adminOverview)
  return (
    <Card className="p-5">
      <SectionTitle right={<RefreshBtn loading={loading} onClick={reload} />}>營運概覽</SectionTitle>
      {!data ? (
        <LoadErr loading={loading} err={err} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard label="總用戶" value={data.users.total} unit="人" icon={Users} onClick={() => onJump('users')} />
            <StatCard label="付費 Pro（生效）" value={data.subs.activePro} unit="人" highlight onClick={() => onJump('users')} />
            <StatCard label="估算 MRR" value={`HK$${data.subs.mrrHkd.toLocaleString()}`} hint="生效 Pro × 月費（估算）" />
            <StatCard label="本月 AI 成本（估）" value={usd(data.ai.estCostUsd)} hint="按呼叫次數估算" onClick={() => onJump('usage')} />
            <StatCard label="今日一般 AI" value={data.ai.genToday} unit="次" onClick={() => onJump('usage')} />
            <StatCard label="本月一般 AI" value={data.ai.genMonth} unit="次" />
            <StatCard label="本月錄音轉文字" value={data.ai.transMonth} unit="次" />
            <StatCard label="學校 / 團隊" value={data.orgs.count} unit="個" onClick={() => onJump('orgs')} />
            <StatCard label="團隊座位" value={data.orgs.seats} unit="席" hint={`已用 ${data.orgs.members} 席`} />
            <StatCard label="待處理客服" value={data.tickets.open} unit="宗" onClick={() => onJump('content')} />
            <StatCard label="生效公告" value={data.announcements.active} unit="則" onClick={() => onJump('content')} />
          </div>
          <p className="mt-4 text-xs text-slate-400">
            ⓘ AI 成本同 MRR 為估算值（Gemini 唔逐次回 token；MRR 假設全部 Pro 按月費）。實數以 Stripe / Google Cloud 帳單為準。
          </p>
        </>
      )}
    </Card>
  )
}

function RefreshBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-accent">
      <RefreshCw size={13} className={cx(loading && 'animate-spin')} /> 重新整理
    </button>
  )
}

// ════════════ 用戶 + 訂閱 ════════════
function UsersTab() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, loading, err, reload } = useAsync(() => adminListUsers(q, page), [page])
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [rows, setRows] = useState<AdminUser[]>([])
  useEffect(() => {
    if (data?.users) setRows(data.users)
  }, [data])

  const setPlan = async (u: AdminUser, plan: 'free' | 'pro') => {
    try {
      setBusy(u.id)
      await adminSetPlan(u.id, plan)
      setRows((cur) =>
        cur.map((x) =>
          x.id === u.id ? { ...x, plan, status: plan === 'pro' ? 'active' : 'inactive' } : x,
        ),
      )
      toast.success(`已將 ${u.email ?? u.id} 設為 ${plan === 'pro' ? 'Pro' : 'Free'}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '更新失敗')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="p-5">
      <Toolbar loading={loading} onReload={reload}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setPage(1)
            reload()
          }}
          className="flex w-full max-w-sm gap-2"
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋 email（當前頁）…" />
          <Button type="submit" variant="secondary">搜尋</Button>
        </form>
      </Toolbar>
      <div className="mt-4">
        <LoadErr loading={loading} err={err} empty={!loading && rows.length === 0} />
        {rows.length > 0 && (
          <Table>
            <Thead>
              <Tr>
                <Th>用戶</Th>
                <Th>方案</Th>
                <Th>狀態</Th>
                <Th>到期</Th>
                <Th>註冊</Th>
                <Th align="right">操作</Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((u) => (
                <Tr key={u.id}>
                  <Td>
                    <div className="font-medium text-slate-800 dark:text-slate-100">{u.email ?? '（無 email）'}</div>
                    <div className="text-[10px] text-slate-400">最後登入 {fmtDate(u.last_sign_in_at)}</div>
                  </Td>
                  <Td>
                    <Badge tone={u.plan === 'pro' ? 'green' : 'slate'}>{u.plan === 'pro' ? 'Pro' : 'Free'}</Badge>
                  </Td>
                  <Td>
                    <span className="text-xs text-slate-500">{u.status}</span>
                  </Td>
                  <Td>{fmtDate(u.current_period_end)}</Td>
                  <Td>{fmtDate(u.created_at)}</Td>
                  <Td align="right">
                    {u.plan === 'pro' ? (
                      <Button size="sm" variant="ghost" disabled={busy === u.id} onClick={() => setPlan(u, 'free')}>
                        降為 Free
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" disabled={busy === u.id} onClick={() => setPlan(u, 'pro')}>
                        設為 Pro
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span>第 {page} 頁 · 每頁 50</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              上一頁
            </Button>
            <Button size="sm" variant="ghost" disabled={!data?.hasMore || loading} onClick={() => setPage((p) => p + 1)}>
              下一頁
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          ⓘ 手動改方案只覆寫後台 subscriptions（緊急 / 補償用）；正常付費仍由 Stripe webhook 驅動。
        </p>
      </div>
    </Card>
  )
}

// ════════════ 用量 + AI 成本 ════════════
function UsageTab() {
  const { data, loading, err, reload } = useAsync<AdminUsage>(adminUsage)
  return (
    <Card className="p-5">
      <SectionTitle right={<RefreshBtn loading={loading} onClick={reload} />}>
        AI 用量 + 成本（{data?.month ?? '本月'}）
      </SectionTitle>
      {!data ? (
        <LoadErr loading={loading} err={err} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="一般 AI" value={data.genMonth} unit="次" />
            <StatCard label="錄音轉文字" value={data.transMonth} unit="次" />
            <StatCard label="估算總成本" value={usd(data.estCostUsd)} highlight hint="按呼叫次數 × 單價" />
            <StatCard label="單價（每次）" value={usd(data.costPerCall)} hint={`轉文字 ${usd(data.costPerTranscribe)}/次`} />
          </div>
          <p className="mb-2 mt-5 text-sm font-medium text-slate-600 dark:text-slate-300">本月用量 Top 20</p>
          {data.top.length === 0 ? (
            <EmptyState icon="📊" title="本月暫無 AI 用量。" />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>用戶</Th>
                  <Th align="right">一般</Th>
                  <Th align="right">轉文字</Th>
                  <Th align="right">合計</Th>
                  <Th align="right">估算成本</Th>
                </Tr>
              </Thead>
              <Tbody>
                {data.top.map((t) => (
                  <Tr key={t.user_id}>
                    <Td>{t.email ?? t.user_id.slice(0, 8)}</Td>
                    <Td numeric>{t.general}</Td>
                    <Td numeric>{t.transcribe}</Td>
                    <Td numeric>{t.total}</Td>
                    <Td numeric>{usd(t.estCostUsd)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
          <p className="mt-3 text-xs text-slate-400">
            ⓘ 成本為估算（單價可喺 Edge Function 環境變數 AI_COST_PER_CALL_USD / AI_COST_PER_TRANSCRIBE_USD 調整）。實數以 Google Cloud 帳單為準。
          </p>
        </>
      )}
    </Card>
  )
}

// ════════════ 學校 B2B ════════════
function OrgsTab() {
  const { data, loading, err, reload } = useAsync<AdminOrg[]>(adminListOrgs)
  return (
    <Card className="p-5">
      <SectionTitle right={<RefreshBtn loading={loading} onClick={reload} />}>學校 / 團隊（B2B）</SectionTitle>
      {!data ? (
        <LoadErr loading={loading} err={err} />
      ) : data.length === 0 ? (
        <EmptyState icon="🏫" title="暫時未有團隊。" hint="老師喺「團隊」建立學校 / 科組後會喺度顯示。" />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>團隊</Th>
              <Th>擁有者</Th>
              <Th align="right">座位</Th>
              <Th align="right">成員</Th>
              <Th>付費</Th>
              <Th>建立</Th>
            </Tr>
          </Thead>
          <Tbody>
            {data.map((o) => (
              <Tr key={o.id}>
                <Td>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{o.name}</span>
                </Td>
                <Td>{o.owner_email ?? '—'}</Td>
                <Td numeric>{o.seats}</Td>
                <Td numeric>
                  <span className={cx(o.members > o.seats && 'text-rose-500')}>
                    {o.members}/{o.seats}
                  </span>
                </Td>
                <Td>
                  <Badge tone={o.paid ? 'green' : 'slate'}>{o.paid ? '已付費' : '未付費'}</Badge>
                </Td>
                <Td>{fmtDate(o.created_at)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </Card>
  )
}

// ════════════ 內容 + 支援 ════════════
function ContentTab() {
  return (
    <div className="space-y-5">
      <AnnouncementsCard />
      <TicketsCard />
    </div>
  )
}

const EMPTY_ANN: Partial<Announcement> = { title: '', body: '', level: 'info', active: true }

function AnnouncementsCard() {
  const { data, loading, err, reload } = useAsync<Announcement[]>(adminListAnnouncements)
  const toast = useToast()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<Partial<Announcement> | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!editing) return
    if (!editing.title?.trim()) {
      toast.error('請輸入標題')
      return
    }
    try {
      setSaving(true)
      await adminSaveAnnouncement(editing)
      setEditing(null)
      reload()
      toast.success('已儲存公告')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const del = async (a: Announcement) => {
    if (!(await confirm({ title: '刪除公告？', message: `「${a.title}」會即時消失。`, confirmText: '刪除', tone: 'danger' }))) return
    try {
      await adminDeleteAnnouncement(a.id)
      reload()
      toast.success('已刪除')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '刪除失敗')
    }
  }

  return (
    <Card className="p-5">
      <SectionTitle
        right={
          <div className="flex items-center gap-3">
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => setEditing({ ...EMPTY_ANN })}>
              新公告
            </Button>
            <RefreshBtn loading={loading} onClick={reload} />
          </div>
        }
      >
        <span className="inline-flex items-center gap-1.5">
          <Megaphone size={16} /> 全站公告
        </span>
      </SectionTitle>
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">生效中嘅公告會喺所有登入用戶頂部顯示橫額。</p>
      {!data ? (
        <LoadErr loading={loading} err={err} />
      ) : data.length === 0 ? (
        <EmptyState icon="📣" title="未有公告。" />
      ) : (
        <ul className="space-y-2">
          {data.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-2 rounded-xl border border-[color:var(--border)] p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{a.title}</span>
                  <Badge tone={a.level === 'warning' ? 'amber' : a.level === 'success' ? 'green' : 'blue'}>{a.level}</Badge>
                  <Badge tone={a.active ? 'green' : 'slate'}>{a.active ? '生效' : '關閉'}</Badge>
                </div>
                {a.body && <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{a.body}</p>}
                <p className="mt-1 text-[10px] text-slate-400">
                  {a.created_by ?? '—'} · {fmtDateTime(a.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(a)}>
                  改
                </Button>
                <Button size="sm" variant="ghost" icon={Trash2} onClick={() => del(a)}>
                  刪
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? '編輯公告' : '新公告'}>
        {editing && (
          <div className="space-y-3">
            <Field label="標題">
              <Input value={editing.title ?? ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="例如：6 月 20 日系統維護" />
            </Field>
            <Field label="內容">
              <textarea
                value={editing.body ?? ''}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 dark:text-slate-100"
                placeholder="詳情（選填）"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="級別">
                <Select
                  value={editing.level ?? 'info'}
                  onChange={(e) => setEditing({ ...editing, level: e.target.value as Announcement['level'] })}
                >
                  <option value="info">資訊（藍）</option>
                  <option value="success">成功（綠）</option>
                  <option value="warning">警告（黃）</option>
                </Select>
              </Field>
              <Field label="狀態">
                <Select
                  value={editing.active === false ? 'off' : 'on'}
                  onChange={(e) => setEditing({ ...editing, active: e.target.value === 'on' })}
                >
                  <option value="on">生效</option>
                  <option value="off">關閉</option>
                </Select>
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                取消
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? '儲存中…' : '儲存'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}

function TicketsCard() {
  const { data, loading, err, reload } = useAsync<AdminTicket[]>(adminListTickets)
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [rows, setRows] = useState<AdminTicket[]>([])
  useEffect(() => {
    if (data) setRows(data)
  }, [data])
  const open = useMemo(() => rows.filter((t) => t.status !== 'closed').length, [rows])

  const setStatus = async (t: AdminTicket, status: 'open' | 'closed') => {
    try {
      setBusy(t.id)
      await adminSetTicketStatus(t.id, status)
      setRows((cur) => cur.map((x) => (x.id === t.id ? { ...x, status } : x)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '更新失敗')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="p-5">
      <SectionTitle right={<RefreshBtn loading={loading} onClick={reload} />}>
        <span className="inline-flex items-center gap-1.5">
          客服收件箱 {open > 0 && <Badge tone="amber">{open} 待處理</Badge>}
        </span>
      </SectionTitle>
      {!data ? (
        <LoadErr loading={loading} err={err} empty={rows.length === 0} />
      ) : rows.length === 0 ? (
        <EmptyState icon="📭" title="暫時未有查詢。" />
      ) : (
        <ul className="space-y-2">
          {rows.map((t) => (
            <li key={t.id} className="rounded-xl border border-[color:var(--border)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{t.subject}</span>
                    <Badge tone={t.status === 'closed' ? 'green' : 'amber'}>{t.status === 'closed' ? '已處理' : '待處理'}</Badge>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">{t.message}</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {t.email ?? '（無 email）'} · <span className="tabular-nums">{fmtDateTime(t.created_at)}</span>
                  </p>
                </div>
                {t.status === 'closed' ? (
                  <Button size="sm" variant="ghost" icon={RotateCcw} disabled={busy === t.id} onClick={() => setStatus(t, 'open')}>
                    重開
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" icon={Check} disabled={busy === t.id} onClick={() => setStatus(t, 'closed')}>
                    標記處理
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
