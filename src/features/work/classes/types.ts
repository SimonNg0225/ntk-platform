import { createCollection, type Entity } from '../../../lib/store'

// ============================================================
//  班別管理 — 自家擴充資料型別
//  ------------------------------------------------------------
//  共用 classesCol / studentsCol（Klass / Student）唔可以改，
//  所以「額外」嘅班別 / 學生屬性放呢度自己嘅 collection，
//  以 classId / studentId 對齊共用資料（旁掛式 metadata）。
//  參考真實 SIS（PowerSchool / SEEMIS / Google Classroom 花名冊）：
//  班主任、課室、學年、班社、性別、聯絡、就讀狀態、座位、標籤。
// ============================================================

export type StudentStatus = 'active' | 'transferred' | 'withdrawn'
export type Gender = 'M' | 'F' | 'X'

/** 學生擴充資料（旁掛 studentsCol.id）*/
export interface StudentMeta extends Entity {
  /** = Student.id（一對一）*/
  studentId: string
  gender?: Gender
  /** 英文名（匯入用；中文名存喺共用 Student.name）*/
  nameEn?: string
  /** 學生編號 / 學校註冊編號（可空；同 Student.studentNo「學號」分開）*/
  regNo?: string
  /** 班社 / House（紅黃藍綠…自由填）*/
  house?: string
  guardianName?: string
  guardianPhone?: string
  email?: string
  status: StudentStatus
  /** 座位（一維 index；-1 = 未排）*/
  seat?: number
  tags?: string[]
  notes?: string
  /** 是否班長 / 風紀等職務 */
  role?: string
  updatedAt: string
}

/** 班別擴充資料（旁掛 classesCol.id）*/
export interface ClassMeta extends Entity {
  /** = Klass.id（一對一）*/
  classId: string
  /** 班主任 */
  formTeacher?: string
  room?: string
  /** 學年，例如 2025–26 */
  term?: string
  /** 行事曆色 key（沿用 Badge tone）*/
  color: ClassTone
  /** 座位表欄數（每行幾個座位）*/
  seatCols: number
  notes?: string
  updatedAt: string
}

// 班別色：沿用 UI Badge tone 集合（每色都有 dark: 變體）
export type ClassTone = 'accent' | 'blue' | 'green' | 'amber' | 'rose' | 'slate'

export const CLASS_TONES: { id: ClassTone; label: string; dot: string }[] = [
  { id: 'accent', label: '海軍藍', dot: 'bg-accent' },
  { id: 'blue', label: '藍', dot: 'bg-blue-500' },
  { id: 'green', label: '綠', dot: 'bg-emerald-500' },
  { id: 'amber', label: '橙', dot: 'bg-amber-500' },
  { id: 'rose', label: '紅', dot: 'bg-rose-500' },
  { id: 'slate', label: '灰', dot: 'bg-slate-400' },
]

export const STATUS_META: Record<
  StudentStatus,
  { label: string; tone: ClassTone }
> = {
  active: { label: '在學', tone: 'green' },
  transferred: { label: '已轉班', tone: 'amber' },
  withdrawn: { label: '已離校', tone: 'slate' },
}

export const GENDER_META: Record<Gender, { label: string; tone: ClassTone }> = {
  M: { label: '男', tone: 'blue' },
  F: { label: '女', tone: 'rose' },
  X: { label: '其他', tone: 'slate' },
}

// ───────── 自家持久化 collection（唔掂 data/collections.ts）─────────
export const studentMetaCol = createCollection<StudentMeta>(
  'classes_student_meta',
  [],
)
export const classMetaCol = createCollection<ClassMeta>('classes_class_meta', [])
