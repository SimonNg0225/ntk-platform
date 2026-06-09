import { useState } from 'react'
import { Download, Upload, FileSpreadsheet } from 'lucide-react'
import { Button, Field, Modal } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { studentsCol } from '../../../data/collections'
import { studentMetaCol, type Gender } from './types'

// 範本 6 欄（表頭要對得返，匯入時按名認欄）
const HEADERS = ['學生中文名字', '英文名字', '學生編號', '班別', '學號', '性別']

function parseGender(v: string): Gender | undefined {
  const s = v.trim().toLowerCase()
  if (!s) return undefined
  if (['m', '男', 'male', 'boy', 'b'].includes(s)) return 'M'
  if (['f', '女', 'female', 'girl', 'g'].includes(s)) return 'F'
  return 'X'
}

interface ImportRow {
  name: string
  nameEn?: string
  regNo?: string
  studentNo?: string
  gender?: Gender
}

// 教師下載範本 → 填好 → 上載，一次過加入學生名單。
// 中文名存共用 Student.name、學號存 Student.studentNo；英文名 / 學生編號 / 性別存旁掛 StudentMeta。
// 除「學生中文名字」外，其餘欄位接受空值。
export default function StudentImport({
  classId,
  className,
  onClose,
}: {
  classId: string
  className: string
  onClose: () => void
}) {
  const toast = useToast()
  const [rows, setRows] = useState<ImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)

  async function downloadTemplate() {
    setBusy(true)
    try {
      const XLSX = await import('xlsx')
      const ws = XLSX.utils.aoa_to_sheet([
        HEADERS,
        ['陳大文', 'Chan Tai Man', 'S1234567', className, '1', '男'],
        ['李小明', 'Lee Siu Ming', '', className, '2', '女'],
      ])
      ws['!cols'] = HEADERS.map((h) => ({ wch: Math.max(12, h.length * 2 + 2) }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '學生名單')
      XLSX.writeFile(wb, '學生名單範本.xlsx')
    } catch (e) {
      toast.error('產生範本失敗：' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function readFile(file: File) {
    setBusy(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const aoa = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        blankrows: false,
        defval: '',
      }) as (string | number)[][]
      if (aoa.length < 2) {
        toast.error('檔案冇資料行（淨係表頭？）')
        return
      }
      const hdr = (aoa[0] || []).map((h) => String(h ?? '').trim())
      const find = (...names: string[]) => {
        for (const n of names) {
          const i = hdr.indexOf(n)
          if (i >= 0) return i
        }
        return -1
      }
      const iName = find('學生中文名字', '中文名字', '中文名', '姓名')
      const iEn = find('英文名字', '英文名', 'English Name')
      const iReg = find('學生編號', '學生證號碼', '編號')
      const iNo = find('學號', '座號', '班號')
      const iGen = find('性別', 'Gender')
      if (iName < 0) {
        toast.error('搵唔到「學生中文名字」欄 — 請用範本格式（表頭唔好改）')
        return
      }
      const get = (row: (string | number)[], i: number) =>
        i >= 0 ? String(row[i] ?? '').trim() : ''
      const out: ImportRow[] = []
      for (let r = 1; r < aoa.length; r++) {
        const row = aoa[r] || []
        const name = get(row, iName)
        if (!name) continue // 中文名必填，空行跳過
        out.push({
          name,
          nameEn: get(row, iEn) || undefined,
          regNo: get(row, iReg) || undefined,
          studentNo: get(row, iNo) || undefined,
          gender: parseGender(get(row, iGen)),
        })
      }
      if (!out.length) {
        toast.error('冇有效資料（每行至少要有「學生中文名字」）')
        return
      }
      setRows(out)
      setFileName(file.name)
    } catch (e) {
      toast.error('讀取失敗：' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function importAll() {
    if (!rows.length) return
    const now = new Date().toISOString()
    rows.forEach((r) => {
      const stu = studentsCol.add({ classId, name: r.name, studentNo: r.studentNo })
      if (r.gender || r.nameEn || r.regNo) {
        studentMetaCol.add({
          studentId: stu.id,
          gender: r.gender,
          nameEn: r.nameEn,
          regNo: r.regNo,
          status: 'active',
          seat: -1,
          updatedAt: now,
        })
      }
    })
    toast.success(`已匯入 ${rows.length} 位學生`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Excel 匯入學生名單"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button icon={Upload} onClick={importAll} disabled={!rows.length}>
            匯入{rows.length ? ` ${rows.length} 位` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* ① 下載範本 */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-700/60 dark:bg-slate-800/40">
          <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
            ① 下載範本，填好學生資料
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
            6 欄：學生中文名字、英文名字、學生編號、班別、學號、性別。除「學生中文名字」外，其餘可留空。
          </p>
          <div className="mt-2">
            <Button variant="secondary" size="sm" icon={Download} onClick={downloadTemplate} loading={busy}>
              下載 Excel 範本
            </Button>
          </div>
        </div>

        {/* ② 上載 */}
        <Field
          label="② 上載填好嘅 Excel"
          hint="按表頭認欄；學號 = 班內座號，學生編號 = 學校編號（可空）。會加入到本班。"
        >
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/[0.12] bg-white px-4 py-6 text-center transition hover:border-accent/40 dark:border-white/[0.12] dark:bg-slate-800/40">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void readFile(f)
                e.target.value = ''
              }}
            />
            <FileSpreadsheet size={20} className="text-accent" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {fileName ? `✓ ${fileName}（${rows.length} 位）` : '揀 Excel 檔（.xlsx）'}
            </span>
          </label>
        </Field>

        {/* 預覽 */}
        {rows.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
              預覽（{rows.length} 位）— 中文名字必填，其餘可空
            </div>
            <div className="max-h-56 divide-y divide-slate-50 overflow-y-auto dark:divide-slate-800">
              {rows.slice(0, 300).map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                  <span className="w-8 shrink-0 tabular-nums text-slate-400">{r.studentNo || '—'}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
                    {r.name}
                    {r.nameEn && <span className="ml-1.5 text-xs text-slate-400">{r.nameEn}</span>}
                  </span>
                  {r.gender && (
                    <span className="shrink-0 text-xs text-slate-400">
                      {r.gender === 'M' ? '男' : r.gender === 'F' ? '女' : '其他'}
                    </span>
                  )}
                  {r.regNo && <span className="shrink-0 text-xs tabular-nums text-slate-400">{r.regNo}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
