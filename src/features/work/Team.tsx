import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Users,
  UserPlus,
  Trash2,
  Copy,
  Building2,
  Crown,
  Ticket,
  Link2,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  Button,
  Input,
  Badge,
  EmptyState,
  IconButton,
  FeatureGuide,
  PageHero,
  type FeatureGuideStep,
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

// ───────── 團隊教學引導（FeatureGuide：3 步「點用」）─────────
const TEAM_GUIDE: FeatureGuideStep[] = [
  {
    title: '建立團隊',
    desc: '改個名（例如「聖保羅 商業科」），開一個學校／科組團隊。',
  },
  {
    title: '邀請同事',
    desc: '入同事電郵產生加入連結（自動複製），傳俾佢開啟即加入。',
  },
  {
    title: '管理座位同成員',
    desc: '座位用盡可加購；隨時喺成員清單調整或移除。',
  },
]

export default function Team() {
  const { t } = useTranslation()
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
        title={t('team.gateNoSupabaseTitle', {
          defaultValue: '團隊功能需要接好 Supabase',
        })}
        hint={t('team.gateNoSupabaseHint', {
          defaultValue: '團隊 / 多座位靠雲端帳戶運作。設定見 docs/SETUP.md。',
        })}
      />
    )
  }
  if (!user) {
    return (
      <EmptyState
        icon={Users}
        title={t('team.gateSignInTitle', { defaultValue: '登入先可以用團隊功能' })}
        hint={t('team.gateSignInHint', {
          defaultValue: '建立學校 / 科組團隊、邀請同事、共用座位一齊備課。',
        })}
        action={
          <Button onClick={() => void signInWithGoogle()}>
            {t('team.gateSignInCta', { defaultValue: '用 Google 登入' })}
          </Button>
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

  const seatsUsed = members.length
  const seatsTotal = org?.seats ?? 0
  const seatsFull = !!org && seatsUsed >= seatsTotal
  const seatTone = !org
    ? 'accent'
    : seatsFull
      ? 'rose'
      : seatsUsed / Math.max(seatsTotal, 1) >= 0.75
        ? 'amber'
        : 'emerald'
  const seatToneChip: Record<string, string> = {
    accent: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
    emerald:
      'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  }
  const seatToneVal: Record<string, string> = {
    accent: 'text-accent',
    amber: 'text-amber-500',
    emerald: 'text-emerald-500',
    rose: 'text-rose-500',
  }

  return (
    <div className="space-y-5">
      <PageHero
        icon={Users}
        kicker={t('team.kicker', { defaultValue: '學校・科組協作' })}
        title={t('team.title', { defaultValue: '團隊與座位' })}
        description={
          org
            ? t('team.subtitleWithOrg', {
                defaultValue: '{{name}}・{{used}} / {{total}} 座位',
                name: org.name,
                used: seatsUsed,
                total: seatsTotal,
              })
            : t('team.subtitleDefault', {
                defaultValue: '建立學校或科組團隊，用連結邀請同事，共用座位一齊備課。',
              })
        }
      />

      <FeatureGuide
        storageKey="team"
        title={t('team.guideTitle', { defaultValue: '團隊點用？' })}
        steps={TEAM_GUIDE}
      />

      {loading && orgs.length === 0 ? (
        // ── 載入中 ──
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
          <p className="text-sm text-slate-400 dark:text-slate-500">
            {t('team.loading', { defaultValue: '載入中…' })}
          </p>
        </section>
      ) : orgs.length === 0 ? (
        // ── 引導式空狀態：開第一個團隊 ──
        <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/60 px-6 py-10 text-center dark:border-slate-700/60 dark:bg-slate-800/40">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
            <Building2 size={22} strokeWidth={1.75} />
          </span>
          <h2 className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
            {t('team.emptyTitle', { defaultValue: '開你第一個團隊' })}
          </h2>
          <p className="mt-1 max-w-xs text-xs text-slate-400 dark:text-slate-500">
            {t('team.emptyHint', {
              defaultValue: '改個名，跟住就可以用連結邀請同事，共用座位一齊備課。',
            })}
          </p>
          <div className="mt-4 flex w-full max-w-sm gap-2">
            <Input
              icon={Building2}
              value={newOrgName}
              placeholder={t('team.orgNamePlaceholder', {
                defaultValue: '團隊名稱（例如：聖保羅 商業科）',
              })}
              onChange={(e) => setNewOrgName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onCreateOrg()}
            />
            <Button onClick={onCreateOrg} disabled={busy || !newOrgName.trim()}>
              {t('team.createCta', { defaultValue: '建立' })}
            </Button>
          </div>
        </section>
      ) : (
        // ── 團隊揀選列 + 新增 ──
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
          <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Building2 size={14} className="shrink-0" />
            {t('team.switcherTitle', { defaultValue: '我的團隊' })}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {orgs.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setOrgId(o.id)}
                aria-pressed={o.id === orgId}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] ${
                  o.id === orgId
                    ? 'border-accent bg-accent-soft text-accent-strong dark:bg-accent/20 dark:text-accent'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800/60'
                }`}
              >
                {o.name}
              </button>
            ))}
            <div className="ml-auto flex gap-2">
              <Input
                value={newOrgName}
                placeholder={t('team.newOrgPlaceholder', {
                  defaultValue: '新團隊名稱',
                })}
                onChange={(e) => setNewOrgName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onCreateOrg()}
                className="max-w-[12rem]"
              />
              <Button
                variant="secondary"
                onClick={onCreateOrg}
                disabled={busy || !newOrgName.trim()}
              >
                {t('team.addOrgCta', { defaultValue: '新增' })}
              </Button>
            </div>
          </div>
        </section>
      )}

      {org && (
        <>
          {/* 座位（統計磚樣式） */}
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${seatToneChip[seatTone]}`}
              >
                <Ticket size={20} />
              </span>
              <div>
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                  {t('team.seatsLabel', { defaultValue: '座位使用' })}
                </p>
                <p className="mt-0.5 flex items-baseline gap-1">
                  <span
                    className={`text-3xl font-semibold tabular-nums slashed-zero ${seatToneVal[seatTone]}`}
                  >
                    {seatsUsed}
                  </span>
                  <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
                    / {seatsTotal} {t('team.seatsUnit', { defaultValue: '個' })}
                  </span>
                </p>
                {seatsFull && (
                  <p className="mt-0.5 text-[11px] text-rose-500">
                    {t('team.seatsFullHint', {
                      defaultValue: '座位已滿，加購先可以再邀請。',
                    })}
                  </p>
                )}
              </div>
            </div>
            {isOwnerAdmin && (
              <Button
                variant="secondary"
                icon={Ticket}
                onClick={onAddSeats}
                disabled={busy}
              >
                {t('team.addSeatCta', { defaultValue: '增加座位' })}
              </Button>
            )}
          </section>

          {/* 邀請 */}
          {isOwnerAdmin && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800 sm:p-5">
              <h2 className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <UserPlus size={14} className="shrink-0" />
                {t('team.inviteTitle', { defaultValue: '邀請成員' })}
              </h2>
              <p className="mb-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t('team.inviteHint', {
                  defaultValue:
                    '輸入同事電郵，產生加入連結（自動複製），傳俾佢開啟即加入。',
                })}
              </p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    icon={UserPlus}
                    type="email"
                    value={inviteEmail}
                    placeholder={t('team.invitePlaceholder', {
                      defaultValue: 'colleague@school.edu.hk',
                    })}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onInvite()}
                  />
                </div>
                <Button
                  icon={Link2}
                  onClick={onInvite}
                  disabled={busy || !inviteEmail.trim() || seatsFull}
                >
                  {t('team.inviteCta', { defaultValue: '產生邀請' })}
                </Button>
              </div>

              {invites.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-slate-400 dark:text-slate-500">
                    {t('team.pendingTitle', {
                      defaultValue: '待接受邀請（{{count}}）',
                      count: invites.length,
                    })}
                  </p>
                  <ul className="space-y-1.5">
                    {invites.map((inv) => (
                      <li
                        key={inv.id}
                        className="flex items-center gap-2 rounded-xl border border-slate-200/80 px-3 py-2 text-sm dark:border-slate-700/60"
                      >
                        <Badge tone="amber">
                          {t('team.pendingBadge', { defaultValue: '待接受' })}
                        </Badge>
                        <span className="flex-1 truncate text-slate-600 dark:text-slate-300">
                          {inv.email}
                        </span>
                        <IconButton
                          label={t('team.copyInviteLabel', {
                            defaultValue: '複製邀請連結',
                          })}
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
                </div>
              ) : (
                <p className="mt-3 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                  <ArrowRight size={13} className="shrink-0" />
                  {t('team.invitesEmptyHint', {
                    defaultValue: '未有待接受邀請。產生連結後會喺呢度顯示。',
                  })}
                </p>
              )}
            </section>
          )}

          {/* 成員 */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800 sm:p-5">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Users size={14} className="shrink-0" />
              {t('team.membersTitle', {
                defaultValue: '成員（{{count}}）',
                count: members.length,
              })}
            </h2>
            {members.length === 0 ? (
              <div className="mt-3 flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-50/60 py-8 text-center dark:bg-slate-800/40">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                  <UserPlus size={22} strokeWidth={1.75} />
                </span>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  {t('team.membersEmptyTitle', { defaultValue: '齊人開工' })}
                </p>
                <p className="max-w-xs text-xs text-slate-400 dark:text-slate-500">
                  {t('team.membersEmptyHint', {
                    defaultValue: '用上面嘅邀請連結叫同事加入，名單就會喺呢度出現。',
                  })}
                </p>
              </div>
            ) : (
              <ul className="mt-2 divide-y divide-slate-200/70 dark:divide-slate-700/60">
                {members.map((m) => (
                  <li
                    key={m.user_id}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                        m.role === 'owner'
                          ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300'
                          : 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                      }`}
                    >
                      {m.role === 'owner' ? (
                        <Crown size={16} />
                      ) : m.role === 'admin' ? (
                        <ShieldCheck size={16} />
                      ) : (
                        <Users size={16} />
                      )}
                    </span>
                    <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                      {m.email}
                    </span>
                    <Badge tone={m.role === 'owner' ? 'accent' : 'slate'}>
                      {m.role === 'owner'
                        ? t('team.roleOwner', { defaultValue: '擁有者' })
                        : m.role === 'admin'
                          ? t('team.roleAdmin', { defaultValue: '管理員' })
                          : t('team.roleMember', { defaultValue: '成員' })}
                    </Badge>
                    {isOwnerAdmin && m.role !== 'owner' && m.user_id !== user.id && (
                      <IconButton
                        label={t('team.removeMemberLabel', {
                          defaultValue: '移除成員',
                        })}
                        size="sm"
                        onClick={() => onRemove(m)}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
