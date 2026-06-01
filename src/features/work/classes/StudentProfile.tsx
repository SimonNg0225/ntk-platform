import { useMemo, useState } from 'react'
import {
  CalendarCheck,
  GraduationCap,
  Mail,
  MessageSquare,
  Phone,
  Save,
  Tag,
  Trash2,
  User,
} from 'lucide-react'
import type { ParentComm, Score, Student } from '../../../data/types'
import {
  assessmentsCol,
  attendanceCol,
  parentCommsCol,
  scoresCol,
  studentsCol,
} from '../../../data/collections'
import {
  Avatar,
  Badge,
  Button,
  Field,
  Input,
  Modal,
  ProgressBar,
  SegmentedControl,
  Separator,
  Textarea,
  cx,
} from '../../../ui'
import { useCollection } from '../../../lib/store'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import {
  GENDER_META,
  STATUS_META,
  studentMetaCol,
  type Gender,
  type StudentMeta,
  type StudentStatus,
} from './types'
import { metaFor } from './util'

// ============================================================
//  學生檔案抽屜（Modal）
//  - 編輯：學號、性別、班社、職務、監護人、電郵、狀態、標籤、備註
//  - 唯讀彙整（跨功能讀，唔寫）：成績平均、出席率、家長溝通次數
//    成績 / 出席 / 溝通各自有專屬功能，呢度只做 360° 概覽。
// ============================================================

export default function StudentProfile({
  student,
  className,
  onClose,
}: {
  student: Student
  className: string
  onClose: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const metas = useCollection(studentMetaCol)
  const scores = useCollection(scoresCol)
  const assessments = useCollection(assessmentsCol)
  const attendance = useCollection(attendanceCol)
  const comms = useCollection(parentCommsCol)

  const existing = metaFor(student.id, metas)
  const [tab, setTab] = useState<'info' | 'overview'>('info')

  // 表單狀態
  const [name, setName] = useState(student.name)
  const [studentNo, setStudentNo] = useState(student.studentNo ?? '')
  const [gender, setGender] = useState<Gender | ''>(existing.gender ?? '')
  const [house, setHouse] = useState(existing.house ?? '')
  const [role, setRole] = useState(existing.role ?? '')
  const [guardianName, setGuardianName] = useState(existing.guardianName ?? '')
  const [guardianPhone, setGuardianPhone] = useState(existing.guardianPhone ?? '')
  const [email, setEmail] = useState(existing.email ?? '')
  const [status, setStatus] = useState<StudentStatus>(existing.status)
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(existing.tags ?? [])
  const [notes, setNotes] = useState(existing.notes ?? '')

  const save = () => {
    if (!name.trim()) {
      toast.error('學生姓名唔可以空白')
      return
    }
    // 共用 Student（只改 name / studentNo 兩個既有欄位）
    // 透過 studentsCol 公開 API 更新，唔掂 data/collections.ts
    studentsCol.update(student.id, {
      name: name.trim(),
      studentNo: studentNo.trim() || undefined,
    })
    const patch: Omit<StudentMeta, 'id'> = {
      studentId: student.id,
      gender: gender || undefined,
      house: house.trim() || undefined,
      role: role.trim() || undefined,
      guardianName: guardianName.trim() || undefined,
      guardianPhone: guardianPhone.trim() || undefined,
      email: email.trim() || undefined,
      status,
      seat: existing.seat ?? -1,
      tags: tags.length ? tags : undefined,
      notes: notes.trim() || undefined,
      updatedAt: new Date().toISOString(),
    }
    if (existing.id) studentMetaCol.update(existing.id, patch)
    else studentMetaCol.add(patch)
    toast.success('已儲存學生檔案')
    onClose()
  }

  const remove = async () => {
    const ok = await confirm({
      title: '刪除學生？',
      message: `「${student.name}」將會由名冊移除。佢喺成績 / 出席等紀錄可能仍然殘留歷史資料。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    if (existing.id) studentMetaCol.remove(existing.id)
    studentsCol.remove(student.id)
    toast.success('已刪除學生')
    onClose()
  }

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput('')
  }

  // ── 唯讀彙整 ──
  const overview = useMemo(() => {
    const sIds = new Set(assessments.map((a) => a.id))
    const myScores = scores.filter(
      (s: Score) => s.studentId === student.id && sIds.has(s.assessmentId),
    )
    const pcts: number[] = []
    for (const sc of myScores) {
      if (sc.score == null) continue
      const a = assessments.find((x) => x.id === sc.assessmentId)
      if (!a || a.maxScore <= 0) continue
      pcts.push((sc.score / a.maxScore) * 100)
    }
    const avg = pcts.length
      ? Math.round(pcts.reduce((s, x) => s + x, 0) / pcts.length)
      : null

    const myAtt = attendance.filter((r) => r.studentId === student.id)
    const lateCount = myAtt.filter((r) => r.status === 'late').length
    const absentCount = myAtt.filter((r) => r.status === 'absent').length
    // 出席率：present + late 皆算「到」（對齊點名 / 工作儀表板定義），缺席唔算
    const attended = myAtt.length - absentCount
    const attRate = myAtt.length
      ? Math.round((attended / myAtt.length) * 100)
      : null

    const myComms = comms
      .filter((c: ParentComm) => c.studentId === student.id)
      .sort((a, b) => b.date.localeCompare(a.date))

    return {
      avg,
      gradedCount: pcts.length,
      attRate,
      attTotal: myAtt.length,
      lateCount,
      absentCount,
      comms: myComms,
    }
  }, [scores, assessments, attendance, comms, student.id])

  return (
    <Modal
      open
      onClose={onClose}
      title={`${student.name} · ${className}`}
      size="lg"
      footer={
        tab === 'info' ? (
          <>
            <Button variant="danger" icon={Trash2} onClick={remove}>
              刪除
            </Button>
            <div className="flex-1" />
            <Button variant="secondary" onClick={onClose}>
              取消
            </Button>
            <Button icon={Save} onClick={save}>
              儲存
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            關閉
          </Button>
        )
      }
    >
      {/* 檔案頭：頭像 + 主要身分 chips */}
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-slate-700/60 dark:bg-slate-800/40">
        <Avatar name={name || student.name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-base font-bold text-slate-800 dark:text-slate-100">
            {name || student.name}
            {studentNo.trim() && (
              <span className="text-xs font-medium tabular-nums text-slate-400">
                #{studentNo.trim()}
              </span>
            )}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={STATUS_META[status].tone} dot>
              {STATUS_META[status].label}
            </Badge>
            {gender && (
              <Badge tone={GENDER_META[gender].tone}>{GENDER_META[gender].label}</Badge>
            )}
            {house.trim() && <Badge tone="slate">{house.trim()}</Badge>}
            {role.trim() && <Badge tone="accent">{role.trim()}</Badge>}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { id: 'info', label: '資料', icon: User },
            { id: 'overview', label: '概覽', icon: GraduationCap },
          ]}
        />
      </div>

      {tab === 'info' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="姓名" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="學號">
              <Input
                value={studentNo}
                onChange={(e) => setStudentNo(e.target.value)}
                placeholder="例如 12"
                className="tabular-nums"
              />
            </Field>
          </div>

          <Field label="性別">
            <div className="flex gap-2">
              {(['M', 'F', 'X'] as Gender[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(gender === g ? '' : g)}
                  className={cx(
                    'flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition',
                    gender === g
                      ? 'border-accent bg-accent text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                  )}
                >
                  {GENDER_META[g].label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="班社 / House" hint="例如 紅社、藍社">
              <Input value={house} onChange={(e) => setHouse(e.target.value)} />
            </Field>
            <Field label="職務" hint="例如 班長、風紀">
              <Input value={role} onChange={(e) => setRole(e.target.value)} />
            </Field>
          </div>

          <Separator label="監護人 / 聯絡" />

          <div className="grid grid-cols-2 gap-3">
            <Field label="監護人姓名">
              <Input
                icon={User}
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
              />
            </Field>
            <Field label="聯絡電話">
              <Input
                icon={Phone}
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                className="tabular-nums"
              />
            </Field>
          </div>
          <Field label="電郵">
            <Input
              icon={Mail}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="就讀狀態">
            <div className="flex gap-2">
              {(['active', 'transferred', 'withdrawn'] as StudentStatus[]).map(
                (st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatus(st)}
                    className={cx(
                      'flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition',
                      status === st
                        ? 'border-accent bg-accent text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                    )}
                  >
                    {STATUS_META[st].label}
                  </button>
                ),
              )}
            </div>
          </Field>

          <Field label="標籤" hint="例如 SEN、需關注、英文輔導">
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong dark:bg-accent/15 dark:text-accent"
                >
                  {t}
                  <button
                    type="button"
                    aria-label={`移除標籤 ${t}`}
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                    className="rounded hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-1.5 flex gap-2">
              <Input
                icon={Tag}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
                placeholder="輸入後 Enter 加入"
              />
              <Button variant="secondary" size="sm" onClick={addTag}>
                加入
              </Button>
            </div>
          </Field>

          <Field label="備註">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="個別學習計劃、家庭背景、注意事項…"
            />
          </Field>
        </div>
      ) : (
        <Overview overview={overview} />
      )}
    </Modal>
  )
}

// ───────── 唯讀概覽 ─────────
function Overview({
  overview,
}: {
  overview: {
    avg: number | null
    gradedCount: number
    attRate: number | null
    attTotal: number
    lateCount: number
    absentCount: number
    comms: ParentComm[]
  }
}) {
  const attTone =
    (overview.attRate ?? 0) >= 90
      ? 'green'
      : (overview.attRate ?? 0) >= 75
        ? 'accent'
        : 'rose'
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <MiniStat
          icon={GraduationCap}
          tone="accent"
          label="平均分"
          value={overview.avg == null ? '—' : `${overview.avg}%`}
          hint={`${overview.gradedCount} 個已評分`}
        />
        <MiniStat
          icon={CalendarCheck}
          tone="emerald"
          label="出席率"
          value={overview.attRate == null ? '—' : `${overview.attRate}%`}
          hint={`共 ${overview.attTotal} 日紀錄`}
        />
      </div>

      {overview.attTotal > 0 && (
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-slate-700/60 dark:bg-slate-800/40">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium">出席表現</span>
            <span className="tabular-nums">
              遲到 {overview.lateCount} · 缺席 {overview.absentCount}
            </span>
          </div>
          <ProgressBar value={overview.attRate ?? 0} tone={attTone} showValue />
        </div>
      )}

      <div>
        <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          <MessageSquare size={13} />
          家長 / 學生溝通
          <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium tabular-nums normal-case tracking-normal text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {overview.comms.length}
          </span>
        </div>
        {overview.comms.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 py-7 text-center dark:border-slate-700 dark:bg-slate-800/40">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              <MessageSquare size={18} />
            </span>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              仲未有同呢位學生 / 家長嘅溝通紀錄
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {overview.comms.slice(0, 5).map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 transition-colors hover:border-slate-300 dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="blue">{c.channel}</Badge>
                    {c.followUp && <Badge tone="amber" dot>待跟進</Badge>}
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-slate-400">
                    {c.date}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                  {c.summary}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2.5 text-center text-[11px] text-slate-400 dark:text-slate-500">
          成績、出席、溝通詳情請到對應功能查閱
        </p>
      </div>
    </div>
  )
}

type MiniTone = 'accent' | 'emerald'
const MINI_TONE: Record<MiniTone, string> = {
  accent: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
}

function MiniStat({
  icon: I,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof User
  label: string
  value: string
  hint: string
  tone: MiniTone
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <span className={cx('flex h-7 w-7 items-center justify-center rounded-lg', MINI_TONE[tone])}>
          <I size={14} />
        </span>
      </div>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>
    </div>
  )
}
