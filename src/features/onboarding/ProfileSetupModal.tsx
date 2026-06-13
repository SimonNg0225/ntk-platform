import { useEffect, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Modal, Button, Field, Input, Select, Textarea, Avatar, cx } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useSettings } from '../../context/SettingsContext'
import { SUBJECT_PACKS } from '../../data/subjects'
import { HONORIFICS, buildDisplayName } from '../work/community/util'
import {
  completeRegistration,
  getMyAppProfile,
  isProfileConfigured,
  type RegistrationInput,
  type TeacherRole,
  type SchoolBand,
} from '../../lib/profile'
import { ROLES, BANDS, validateRegistration } from './logic'
import { PERSONAS_BY_GENDER, type PersonaGender } from '../../lib/personas'

// ============================================================
//  新用戶註冊 — 首次登入嘅個人資料登記表單（硬 gate，填好先入到 app）。
//  必填：署名、身份、任教科目、同意條款。其餘選填。
//  寫一份去 profiles（lib/profile），論壇 / 資源分享區共用。
// ============================================================

const AVATAR_COLORS = ['4F46E5', '0D9488', 'B45309', 'BE185D', '7C3AED', '0369A1']

/** 將 display_name 拆返「姓 + 稱謂」（尾係已知稱謂先拆，否則當自訂全名）。 */
function decompose(displayName: string): { surname: string; honorific: string; custom: string } {
  for (const h of HONORIFICS) {
    if (displayName.endsWith(h) && displayName.length > h.length) {
      return { surname: displayName.slice(0, -h.length), honorific: h, custom: '' }
    }
  }
  return { surname: '', honorific: '老師', custom: displayName }
}

/** 描邊膠囊選項（單選 / 多選共用）。 */
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        'rounded-full border px-3 py-1.5 text-sm font-medium transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        on
          ? 'border-accent bg-accent text-white shadow-sm'
          : 'border-black/[0.1] bg-white text-slate-600 hover:bg-black/[0.03] dark:border-white/15 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-white/[0.06]',
      )}
    >
      {children}
    </button>
  )
}

/** 單個 persona 頭像揀掣（顯示喺已揀底色上，揀中描邊）。 */
function PersonaTile({
  id,
  selected,
  color,
  onPick,
}: {
  id: string
  selected: boolean
  color: string
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      aria-label={`頭像 ${id}`}
      className={cx(
        'rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        selected
          ? 'ring-2 ring-accent ring-offset-2 ring-offset-[color:var(--surface)]'
          : 'ring-1 ring-black/[0.06] hover:ring-black/20 dark:ring-white/10 dark:hover:ring-white/25',
      )}
    >
      <Avatar preset={id} color={color} size="md" />
    </button>
  )
}

const PERSONA_GROUPS: { g: PersonaGender; label: string }[] = [
  { g: 'male', label: '男老師' },
  { g: 'female', label: '女老師' },
]

export default function ProfileSetupModal({
  open,
  onDone,
}: {
  open: boolean
  onDone: () => void
}) {
  const toast = useToast()
  const { setDisplayName, setSubjectPackId } = useSettings()

  const [surname, setSurname] = useState('')
  const [honorific, setHonorific] = useState<string>('老師')
  const [custom, setCustom] = useState('')
  const [role, setRole] = useState<TeacherRole | ''>('')
  const [subjects, setSubjects] = useState<string[]>([])
  const [bands, setBands] = useState<SchoolBand[]>([])
  const [school, setSchool] = useState('')
  const [showSchool, setShowSchool] = useState(false)
  const [bio, setBio] = useState('')
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0])
  const [avatarPreset, setAvatarPreset] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)

  // 已有 profile（0014 前嘅舊用戶 / 喺資源分享區填過）→ 預填，免重新輸入。
  useEffect(() => {
    if (!open || !isProfileConfigured) return
    let cancelled = false
    getMyAppProfile()
      .then((p) => {
        if (cancelled || !p) return
        const d = decompose(p.displayName ?? '')
        setSurname(d.surname)
        setHonorific(d.honorific)
        setCustom(d.custom)
        if (p.role) setRole(p.role)
        if (p.subjects.length) setSubjects(p.subjects)
        if (p.bands.length) setBands(p.bands)
        setSchool(p.school ?? '')
        setShowSchool(p.showSchool)
        setBio(p.bio ?? '')
        if (p.avatarColor) setAvatarColor(p.avatarColor)
        setAvatarPreset(p.avatarPreset)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open])

  const displayName = (custom.trim() || buildDisplayName(surname, honorific)).trim()

  const toggle = <T extends string>(list: T[], set: (v: T[]) => void, id: T) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  async function submit() {
    const v = validateRegistration({ displayName, role, subjects }, agreed)
    if (!v.ok) {
      toast.error(v.error ?? '請檢查資料。')
      return
    }
    if (!isProfileConfigured) {
      toast.error('示範模式：接 Supabase + 登入後先用得。')
      return
    }
    const input: RegistrationInput = {
      displayName,
      role: role as TeacherRole,
      subjects,
      bands,
      school: school.trim() || null,
      showSchool,
      bio: bio.trim() || null,
      avatarColor,
      avatarPreset,
    }
    try {
      setBusy(true)
      await completeRegistration(input)
      setDisplayName(displayName)
      // 揀咗科目 → 順手將主科設做課題大綱嘅預設（之後設定仍可改）。
      if (subjects[0]) setSubjectPackId(subjects[0])
      toast.success('歡迎加入！個人資料已建立 🎉')
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '建立失敗，請再試。')
    } finally {
      setBusy(false)
    }
  }

  // 硬 gate：onClose / 背景撳一律唔關，填好撳掣先走。
  return (
    <Modal open={open} onClose={() => {}} closeOnBackdrop={false} size="lg" ariaLabel="新用戶登記">
      <div className="space-y-5">
        {/* 標題 */}
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white shadow-sm">
            E
          </span>
          <div>
            <h2
              data-modal-title
              className="text-[17px] font-semibold tracking-tight text-slate-800 dark:text-slate-100"
            >
              建立你嘅老師檔案
            </h2>
            <p className="mt-0.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              花一分鐘填好，資源分享區同論壇就會用呢個身份。<span className="text-rose-500">*</span> 為必填。
            </p>
          </div>
        </div>

        {/* 署名 */}
        <Field label="署名" required hint={displayName ? `顯示為：${displayName}` : '姓氏 + 稱謂，例：陳老師'}>
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <Input value={surname} onChange={(e) => setSurname(e.target.value)} placeholder="姓氏，例：陳" maxLength={4} />
            <Select value={honorific} onChange={(e) => setHonorific(e.target.value)}>
              {HONORIFICS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </Select>
          </div>
        </Field>
        <Field label="自訂署名（選填，會蓋過上面）" hint="想用全名 / 英文名 / 暱稱先填">
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="例：Mr Chan" maxLength={24} />
        </Field>

        {/* 身份 */}
        <Field label="你嘅身份" required>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <Chip key={r.id} on={role === r.id} onClick={() => setRole(r.id)}>
                {r.label}
              </Chip>
            ))}
          </div>
        </Field>

        {/* 任教科目 */}
        <Field label="任教科目" required hint="可揀多科">
          <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto rounded-xl border border-[color:var(--border)] p-2.5">
            {SUBJECT_PACKS.map((p) => (
              <Chip key={p.id} on={subjects.includes(p.id)} onClick={() => toggle(subjects, setSubjects, p.id)}>
                {p.short}
              </Chip>
            ))}
          </div>
        </Field>

        {/* 任教學制（選填） */}
        <Field label="任教學制 / 年級（選填）">
          <div className="flex flex-wrap gap-2">
            {BANDS.map((b) => (
              <Chip key={b.id} on={bands.includes(b.id)} onClick={() => toggle(bands, setBands, b.id)}>
                {b.label}
              </Chip>
            ))}
          </div>
        </Field>

        {/* 學校（選填） */}
        <Field label="學校（選填）">
          <Input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="例：聖文德書院" maxLength={30} />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={showSchool}
            onChange={(e) => setShowSchool(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/40 dark:border-slate-600 dark:bg-slate-700"
          />
          喺署名顯示學校（預設唔顯示，保障私隱）
        </label>

        {/* 簡介（選填） */}
        <Field label="簡介（選填）">
          <Textarea rows={2} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="一兩句介紹你教咩 / 風格" maxLength={120} />
        </Field>

        {/* 揀頭像（教師形象 persona） */}
        <Field label="頭像">
          <div className="flex items-start gap-4">
            <div className="flex shrink-0 flex-col items-center gap-1">
              <Avatar preset={avatarPreset} color={avatarColor} name={displayName} size="xl" />
              <span className="text-[11px] text-slate-400">預覽</span>
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              {PERSONA_GROUPS.map(({ g, label }) => (
                <div key={g}>
                  <p className="mb-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PERSONAS_BY_GENDER[g].map((p) => (
                      <PersonaTile
                        key={p.id}
                        id={p.id}
                        selected={avatarPreset === p.id}
                        color={avatarColor}
                        onPick={() => setAvatarPreset(p.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setAvatarPreset(null)}
                className="text-xs font-medium text-slate-500 underline underline-offset-2 transition hover:text-accent dark:text-slate-400"
              >
                唔用形象 · 用文字頭像（署名首字）
              </button>
            </div>
          </div>
        </Field>

        {/* 頭像顏色 */}
        <Field label="頭像顏色">
          <div className="flex gap-2">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAvatarColor(c)}
                aria-label={`頭像色 ${c}`}
                aria-pressed={avatarColor === c}
                className={cx(
                  'h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-[color:var(--surface)] transition',
                  avatarColor === c ? 'ring-accent' : 'ring-transparent',
                )}
                style={{ background: `#${c}` }}
              />
            ))}
          </div>
        </Field>

        {/* 同意條款（連結開新分頁，唔會誤觸 checkbox） */}
        <div className="flex items-start gap-2 rounded-xl bg-[color:var(--surface-2)] p-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          <input
            id="reg-agree"
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-accent focus:ring-accent/40 dark:border-slate-600 dark:bg-slate-700"
          />
          <span>
            <label htmlFor="reg-agree" className="cursor-pointer">我已閱讀並同意</label>
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="mx-0.5 font-medium text-accent underline underline-offset-2 hover:text-accent-strong"
            >
              服務條款
            </a>
            與
            <a
              href="/guidelines"
              target="_blank"
              rel="noopener noreferrer"
              className="mx-0.5 font-medium text-accent underline underline-offset-2 hover:text-accent-strong"
            >
              社群守則
            </a>
            <label htmlFor="reg-agree" className="cursor-pointer">
              {' '}—— 尊重版權、友善交流，唔上載侵權或不當內容。
            </label>
          </span>
        </div>

        <Button icon={Check} onClick={submit} loading={busy} fullWidth size="lg">
          完成登記，開始使用
        </Button>
      </div>
    </Modal>
  )
}
