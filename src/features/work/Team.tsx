import { useCallback, useEffect, useState } from 'react'
import {
  Users,
  UserPlus,
  Trash2,
  Copy,
  Building2,
  Crown,
  Ticket,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  Button,
  Card,
  Input,
  Badge,
  EmptyState,
  SectionTitle,
  IconButton,
} from '../../ui'
import {
  listMyOrgs,
  createOrg,
  listMembers,
  listPendingInvites,
  inviteMember,
  acceptInvite,
  removeMember,
  startSeatCheckout,
  isSeatBillingConfigured,
  type Org,
  type OrgMember,
  type OrgInvite,
} from '../../lib/team'

// ============================================================
//  團隊 / 多座位（學校 · 科組）
//  ------------------------------------------------------------
//  建立團隊、邀請成員（連結）、管理成員、購買座位。
//  需登入（接 Supabase）；訪客模式顯示提示。
// ============================================================

export default function Team() {
  const { user, configured, signInWithGoogle } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [invites, setInvites] = useState<OrgInvite[]>([])
  const [loading, setLoading] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const org = orgs.find((o) => o.id === orgId) ?? null
  const isOwnerAdmin =
    !!org &&
    members.some(
      (m) => m.user_id === user?.id && (m.role === 'owner' || m.role === 'admin'),
    )

  const reloadOrgs = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listMyOrgs()
      setOrgs(list)
      setOrgId((cur) => cur ?? list[0]?.id ?? null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '載入團隊失敗')
    } finally {
      setLoading(false)
    }
  }, [toast])

  const reloadOrgDetail = useCallback(async (id: string) => {
    try {
      const [m, inv] = await Promise.all([
        listMembers(id),
        listPendingInvites(id),
      ])
      setMembers(m)
      setInvites(inv)
    } catch {
      /* RLS / 權限：靜默 */
    }
  }, [])

  // 首載 + 處理 ?invite=token
  useEffect(() => {
    if (!user) return
    const token = new URLSearchParams(window.location.search).get('invite')
    if (token) {
      acceptInvite(token)
        .then((joinedId) => {
          toast.success('已加入團隊 🎉')
          setOrgId(joinedId)
          // 清走 URL 上嘅 token
          const u = new URL(window.location.href)
          u.searchParams.delete('invite')
          window.history.replaceState({}, '', u.toString())
        })
        .catch((e) =>
          toast.error(e instanceof Error ? e.message : '接受邀請失敗'),
        )
        .finally(() => void reloadOrgs())
    } else {
      void reloadOrgs()
    }
  }, [user, reloadOrgs, toast])

  useEffect(() => {
    if (orgId) void reloadOrgDetail(orgId)
  }, [orgId, reloadOrgDetail])

  // ── 訪客 / 未登入 gate ──
  if (!configured) {
    return (
      <EmptyState
        icon={Building2}
        title="團隊功能需要接好 Supabase"
        hint="團隊 / 多座位靠雲端帳戶運作。設定見 docs/SETUP.md。"
      />
    )
  }
  if (!user) {
    return (
      <EmptyState
        icon={Users}
        title="登入先可以用團隊功能"
        hint="建立學校 / 科組團隊、邀請同事、共用座位。"
        action={
          <Button onClick={() => void signInWithGoogle()}>用 Google 登入</Button>
        }
      />
    )
  }

  async function onCreateOrg() {
    const name = newOrgName.trim()
    if (!name) return
    try {
      setBusy(true)
      const id = await createOrg(name)
      setNewOrgName('')
      await reloadOrgs()
      setOrgId(id)
      toast.success('已建立團隊')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '建立失敗')
    } finally {
      setBusy(false)
    }
  }

  async function onInvite() {
    if (!org) return
    const email = inviteEmail.trim()
    if (!email) return
    if (members.length >= org.seats) {
      toast.error(`座位已滿（${org.seats}）。請先增加座位。`)
      return
    }
    try {
      setBusy(true)
      const link = await inviteMember(org.id, email)
      setInviteEmail('')
      await reloadOrgDetail(org.id)
      await navigator.clipboard.writeText(link).catch(() => {})
      toast.success('已建立邀請連結，並複製到剪貼簿')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '邀請失敗')
    } finally {
      setBusy(false)
    }
  }

  async function onRemove(m: OrgMember) {
    if (!org) return
    if (
      !(await confirm({
        title: `移除 ${m.email}？`,
        message: '佢將會失去此團隊嘅存取權。',
        confirmText: '移除',
        tone: 'danger',
      }))
    )
      return
    try {
      await removeMember(org.id, m.user_id)
      await reloadOrgDetail(org.id)
      toast.success('已移除成員')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '移除失敗')
    }
  }

  async function onAddSeats() {
    if (!org) return
    if (!isSeatBillingConfigured) {
      toast.info('座位收費即將推出（未設定團隊 price）。')
      return
    }
    try {
      setBusy(true)
      await startSeatCheckout(org.id, org.seats + 1)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '開啟付款頁失敗')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 團隊揀選 + 建立 */}
      <Card className="p-5">
        <SectionTitle>我的團隊</SectionTitle>
        {loading && orgs.length === 0 ? (
          <p className="text-sm text-slate-400">載入中…</p>
        ) : orgs.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              仲未有團隊。建立一個學校 / 科組團隊，邀請同事共用。
            </p>
            <div className="flex gap-2">
              <Input
                icon={Building2}
                value={newOrgName}
                placeholder="團隊名稱（例如：聖保羅 商業科）"
                onChange={(e) => setNewOrgName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onCreateOrg()}
              />
              <Button onClick={onCreateOrg} disabled={busy || !newOrgName.trim()}>
                建立
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {orgs.map((o) => (
              <button
                key={o.id}
                onClick={() => setOrgId(o.id)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  o.id === orgId
                    ? 'border-accent bg-accent-soft text-accent-strong dark:bg-accent/20 dark:text-accent'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                {o.name}
              </button>
            ))}
            <div className="ml-auto flex gap-2">
              <Input
                value={newOrgName}
                placeholder="新團隊名稱"
                onChange={(e) => setNewOrgName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onCreateOrg()}
                className="max-w-[12rem]"
              />
              <Button
                variant="secondary"
                onClick={onCreateOrg}
                disabled={busy || !newOrgName.trim()}
              >
                新增
              </Button>
            </div>
          </div>
        )}
      </Card>

      {org && (
        <>
          {/* 座位 */}
          <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <SectionTitle>座位</SectionTitle>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                已用{' '}
                <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                  {members.length}
                </span>{' '}
                / {org.seats} 個座位
              </p>
            </div>
            {isOwnerAdmin && (
              <Button variant="secondary" icon={Ticket} onClick={onAddSeats} disabled={busy}>
                增加座位
              </Button>
            )}
          </Card>

          {/* 邀請 */}
          {isOwnerAdmin && (
            <Card className="p-5">
              <SectionTitle>邀請成員</SectionTitle>
              <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
                輸入同事電郵，產生加入連結（自動複製），傳俾佢開啟即加入。
              </p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    icon={UserPlus}
                    type="email"
                    value={inviteEmail}
                    placeholder="colleague@school.edu.hk"
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onInvite()}
                  />
                </div>
                <Button onClick={onInvite} disabled={busy || !inviteEmail.trim()}>
                  產生邀請
                </Button>
              </div>

              {invites.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {invites.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                    >
                      <Badge tone="amber">待接受</Badge>
                      <span className="flex-1 truncate text-slate-600 dark:text-slate-300">
                        {inv.email}
                      </span>
                      <IconButton
                        label="複製邀請連結"
                        size="sm"
                        onClick={() => {
                          void navigator.clipboard.writeText(
                            `${window.location.origin}/app?invite=${inv.token}`,
                          )
                          toast.success('已複製邀請連結')
                        }}
                      >
                        <Copy size={15} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {/* 成員 */}
          <Card className="p-5">
            <SectionTitle>成員（{members.length}）</SectionTitle>
            <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                    {m.role === 'owner' ? <Crown size={15} /> : <Users size={15} />}
                  </span>
                  <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                    {m.email}
                  </span>
                  <Badge tone={m.role === 'owner' ? 'accent' : 'slate'}>
                    {m.role === 'owner' ? '擁有者' : m.role === 'admin' ? '管理員' : '成員'}
                  </Badge>
                  {isOwnerAdmin && m.role !== 'owner' && m.user_id !== user.id && (
                    <IconButton label="移除成員" size="sm" onClick={() => onRemove(m)}>
                      <Trash2 size={15} />
                    </IconButton>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}
