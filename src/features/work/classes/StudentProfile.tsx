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
    const present = myAtt.filter((r) => r.status === 'present').length
    const attRate = myAtt.length
      ? Math.round((present / myAtt.length) * 100)
      : null
    const lateCount = myAtt.filter((r) => r.status === 'late').length
    const absentCount = myAtt.filter((r) => r.status === 'absent').length

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
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <MiniStat
          icon={GraduationCap}
          label="平均分"
          value={overview.avg == null ? '—' : `${overview.avg}%`}
          hint={`${overview.gradedCount} 個已評分`}
        />
        <MiniStat
          icon={CalendarCheck}
          label="出席率"
          value={overview.attRate == null ? '—' : `${overview.attRate}%`}
          hint={`共 ${overview.attTotal} 日紀錄`}
        />
      </div>

      {overview.attTotal > 0 && (
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>出席表現</span>
            <span className="tabular-nums">
              遲到 {overview.lateCount} · 缺席 {overview.absentCount}
            </span>
          </div>
          <ProgressBar
            value={overview.attRate ?? 0}
            tone={
              (overview.attRate ?? 0) >= 90
                ? 'green'
                : (overview.attRate ?? 0) >= 75
                  ? 'accent'
                  : 'rose'
            }
            showValue
          />
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          <MessageSquare size={13} />
          家長 / 學生溝通（{overview.comms.length}）
        </div>
        {overview.comms.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
            仲未有溝通紀錄
          </p>
        ) : (
          <ul className="space-y-2">
            {overview.comms.slice(0, 5).map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="blue">{c.channel}</Badge>
                  <span className="text-xs tabular-nums text-slate-400">
                    {c.date}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                  {c.summary}
                </p>
                {c.followUp && (
                  <Badge tone="amber" className="mt-1">
                    待跟進
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
          成績、出席、溝通詳情請到對應功能查閱
        </p>
      </div>
    </div>
  )
}

function MiniStat({
  icon: I,
  label,
  value,
  hint,
}: {
  icon: typeof User
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <I size={14} className="text-slate-400" />
        {label}
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
        {value}
      </p>
      <p className="text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>
    </div>
  )
}
