import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { Button, Card, Field, Input, Select, Textarea, cx } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useSettings } from '../../../context/SettingsContext'
import {
  isCommunityConfigured,
  getMyProfile,
  upsertMyProfile,
  type CommunityProfile,
} from '../../../lib/community'
import { HONORIFICS, buildDisplayName, publicName } from './util'
import { Avatar, Toggle } from './parts'

// 將現有 display_name 拆返「姓 + 稱謂」（尾係已知稱謂先拆，否則當自訂全名）。
function decompose(displayName: string): { surname: string; honorific: string; custom: string } {
  for (const h of HONORIFICS) {
    if (displayName.endsWith(h) && displayName.length > h.length) {
      return { surname: displayName.slice(0, -h.length), honorific: h, custom: '' }
    }
  }
  return { surname: '', honorific: '老師', custom: displayName }
}

const AVATAR_COLORS = ['4F46E5', '0D9488', 'B45309', 'BE185D', '7C3AED', '0369A1']

export default function ProfileTab() {
  const toast = useToast()
  const { displayName: settingsName } = useSettings()
  const seed = decompose(settingsName || '')

  const [surname, setSurname] = useState(seed.surname)
  const [honorific, setHonorific] = useState(seed.honorific)
  const [custom, setCustom] = useState(seed.custom)
  const [school, setSchool] = useState('')
  const [showSchool, setShowSchool] = useState(false)
  const [anonymous, setAnonymous] = useState(false)
  const [bio, setBio] = useState('')
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isCommunityConfigured) return
    getMyProfile()
      .then((p) => {
        if (!p) return
        const d = decompose(p.displayName)
        setSurname(d.surname)
        setHonorific(d.honorific)
        setCustom(d.custom)
        setSchool(p.school ?? '')
        setShowSchool(p.showSchool)
        setAnonymous(p.anonymous)
        setBio(p.bio ?? '')
        setAvatarColor(p.avatarColor ?? AVATAR_COLORS[0])
      })
      .catch(() => {})
  }, [])

  const displayName = custom.trim() || buildDisplayName(surname, honorific)
  const preview: CommunityProfile = {
    id: 'me',
    displayName,
    school: school.trim() || null,
    showSchool,
    anonymous,
    avatarColor,
    bio: bio.trim() || null,
    subjects: [],
  }

  async function save() {
    if (!displayName.trim()) {
      toast.error('請填姓氏（或自訂署名）。')
      return
    }
    if (!isCommunityConfigured) {
      toast.error('示範模式：接 Supabase + 登入後先儲存到。')
      return
    }
    try {
      setBusy(true)
      await upsertMyProfile({
        displayName,
        school: school.trim() || null,
        showSchool,
        anonymous,
        avatarColor,
        bio: bio.trim() || null,
      })
      toast.success('社群身份已儲存')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '儲存失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      {/* 設定 */}
      <Card padded className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">公開身份</h2>
          <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
            其他老師喺資源分享區見到你嘅署名。私隱你話事 —— 唔使露全名同學校。
          </p>
        </div>

        <Toggle
          on={anonymous}
          onChange={setAnonymous}
          label="匿名分享"
          hint="開咗就一律顯示「匿名老師」（管理員仍可追溯帳戶以防濫用）"
        />

        <div className={cx('space-y-4', anonymous && 'pointer-events-none opacity-40')}>
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <Field label="姓氏">
              <Input value={surname} onChange={(e) => setSurname(e.target.value)} placeholder="例：陳" maxLength={4} />
            </Field>
            <Field label="稱謂">
              <Select value={honorific} onChange={(e) => setHonorific(e.target.value)}>
                {HONORIFICS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="自訂署名（選填，會蓋過上面）" hint="想用全名 / 英文名 / 暱稱先填">
            <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="例：Mr Chan" maxLength={24} />
          </Field>

          <Field label="學校">
            <Input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="例：聖文德書院" maxLength={30} />
          </Field>
          <Toggle on={showSchool} onChange={setShowSchool} label="喺署名顯示學校" hint="關咗就淨係顯示你個署名" />

          <Field label="簡介（選填）">
            <Textarea rows={2} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="一兩句介紹你教咩 / 風格" maxLength={120} />
          </Field>

          <Field label="頭像顏色">
            <div className="flex gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAvatarColor(c)}
                  aria-label={`色 ${c}`}
                  className={cx('h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-[color:var(--surface)] transition', avatarColor === c ? 'ring-accent' : 'ring-transparent')}
                  style={{ background: `#${c}` }}
                />
              ))}
            </div>
          </Field>
        </div>

        <Button icon={Save} onClick={save} loading={busy}>
          儲存社群身份
        </Button>
      </Card>

      {/* 即時預覽 */}
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">預覽</p>
        <Card padded className="space-y-3">
          <div className="flex items-center gap-3">
            <Avatar profile={preview} size={44} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{publicName(preview)}</p>
              <p className="text-[11px] text-slate-400">資源上會咁顯示</p>
            </div>
          </div>
          {!anonymous && bio.trim() && (
            <p className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">{bio.trim()}</p>
          )}
          <div className="rounded-lg bg-black/[0.03] p-2.5 text-[11px] leading-relaxed text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
            {anonymous
              ? '匿名：所有分享顯示「匿名老師」。'
              : showSchool && school.trim()
                ? `署名：「${school.trim()} ${publicName({ ...preview, showSchool: false })}」`
                : `署名：「${publicName(preview)}」（唔顯示學校）`}
          </div>
        </Card>
      </div>
    </div>
  )
}
