import { useEffect, useRef, useState } from 'react'
import { Upload, FileText, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { cx } from '../../../../ui'
import { extractFromFile } from '../../docDigest/extract'

// ============================================================
//  上載教材 → 抽文字（複用 docDigest/extractFromFile）
//  支援 PDF（pdf.js 逐頁）/ Word(.docx) / 純文字。
//  抽好的文字合併後經 onChange 交給 SlideGen 餵 AI 生成。
// ============================================================

type FileStatus = 'reading' | 'done' | 'error'
interface FileState {
  id: string
  name: string
  status: FileStatus
  chars: number
  error?: string
}

const ACCEPT = '.pdf,.docx,.txt,.md,.csv'
const MAX_FILES = 8

export default function UploadDrop({
  onChange,
}: {
  /** 合併文字 + 是否仍有檔案抽取緊（busy 時 disable 下一步） */
  onChange: (text: string, busy: boolean) => void
}): JSX.Element {
  const [files, setFiles] = useState<FileState[]>([])
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const textsRef = useRef<Map<string, string>>(new Map())

  // files / 抽取文字一變 → 合併交返上層
  useEffect(() => {
    const busy = files.some((f) => f.status === 'reading')
    const combined = files
      .filter((f) => f.status === 'done')
      .map((f) => `# ${f.name}\n${textsRef.current.get(f.id) ?? ''}`)
      .join('\n\n')
    onChange(combined, busy)
  }, [files, onChange])

  async function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    const room = MAX_FILES - files.length
    if (room <= 0) return
    const arr = Array.from(list).slice(0, room)
    const incoming: FileState[] = arr.map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      status: 'reading',
      chars: 0,
    }))
    setFiles((prev) => [...prev, ...incoming])

    await Promise.all(
      arr.map(async (file, i) => {
        const id = incoming[i].id
        try {
          const res = await extractFromFile(file)
          const text = (res.text ?? '').trim()
          textsRef.current.set(id, text)
          setFiles((prev) =>
            prev.map((f) =>
              f.id === id
                ? text
                  ? { ...f, status: 'done', chars: text.length }
                  : {
                      ...f,
                      status: 'error',
                      error: '抽不到文字（可改用 PDF / Word / 文字檔）',
                    }
                : f,
            ),
          )
        } catch (e) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === id ? { ...f, status: 'error', error: (e as Error).message || '讀取失敗' } : f,
            ),
          )
        }
      }),
    )
  }

  function remove(id: string) {
    textsRef.current.delete(id)
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const doneCount = files.filter((f) => f.status === 'done').length
  const totalChars = files.reduce((n, f) => (f.status === 'done' ? n + f.chars : n), 0)

  return (
    <div className="space-y-3">
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          void addFiles(e.dataTransfer.files)
        }}
        className={cx(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition',
          drag
            ? 'border-accent bg-accent-soft/60 dark:bg-accent/10'
            : 'border-black/[0.1] hover:border-accent/40 hover:bg-black/[0.02] dark:border-white/15 dark:hover:bg-white/[0.03]',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            void addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
          <Upload size={20} />
        </span>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          拖放教材到這裡，或㩒來選擇檔
        </span>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          支援 PDF · Word(.docx) · 文字檔　最多 {MAX_FILES} 份
        </span>
      </label>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2.5 rounded-xl border border-black/[0.06] bg-slate-50/70 px-3 py-2 dark:border-white/[0.08] dark:bg-slate-800/40"
            >
              <FileText size={15} className="shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-slate-700 dark:text-slate-200">
                  {f.name}
                </p>
                <p
                  className={cx(
                    'text-[11px]',
                    f.status === 'error'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-400 dark:text-slate-500',
                  )}
                >
                  {f.status === 'reading'
                    ? '抽取緊…'
                    : f.status === 'done'
                      ? `約 ${f.chars.toLocaleString()} 字`
                      : (f.error ?? '失敗')}
                </p>
              </div>
              {f.status === 'reading' && <Loader2 size={15} className="shrink-0 animate-spin text-accent" />}
              {f.status === 'done' && <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />}
              {f.status === 'error' && <AlertCircle size={15} className="shrink-0 text-amber-500" />}
              <button
                type="button"
                onClick={() => remove(f.id)}
                aria-label="移除"
                className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-black/5 hover:text-slate-600 dark:hover:bg-white/10"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {doneCount > 0 && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          已抽取 {doneCount} 份 · 合共約 {totalChars.toLocaleString()} 字，可入下一步生成。
        </p>
      )}
    </div>
  )
}
