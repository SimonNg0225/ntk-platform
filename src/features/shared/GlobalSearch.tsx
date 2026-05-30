import { useState, useMemo } from 'react'
import { useCollection } from '../../lib/store'
import {
  notesCol,
  questionsCol,
  resourcesCol,
  lessonPlansCol,
  meetingNotesCol,
  readingCol,
  journalCol,
  classesCol,
  studentsCol,
} from '../../data/collections'
import { useNav } from '../../context/NavContext'
import type {
  Note,
  Question,
  Resource,
  LessonPlan,
  MeetingNote,
  ReadingItem,
  JournalEntry,
  Klass,
  Student,
} from '../../data/types'

// ============================================================
//  全域搜尋：跨多個資料源即時搵嘢，結果按類別分組
// ============================================================

const MAX_PER_GROUP = 5

// 每組搜尋結果（一個資料源）
interface ResultGroup {
  label: string
  featureId: string
  hits: { id: string; snippet: string }[]
}

// 由原始文字 + 關鍵字整出命中片段（前後留少少上文下理）
function makeSnippet(text: string, lowerKeyword: string): string | null {
  const idx = text.toLowerCase().indexOf(lowerKeyword)
  if (idx === -1) return null
  const start = Math.max(0, idx - 20)
  const end = Math.min(text.length, idx + lowerKeyword.length + 40)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return `${prefix}${text.slice(start, end).trim()}${suffix}`
}

export default function GlobalSearch() {
  const { open } = useNav()
  const [keyword, setKeyword] = useState('')

  // 訂閱所有資料源
  const notes = useCollection(notesCol)
  const questions = useCollection(questionsCol)
  const resources = useCollection(resourcesCol)
  const lessonPlans = useCollection(lessonPlansCol)
  const meetingNotes = useCollection(meetingNotesCol)
  const reading = useCollection(readingCol)
  const journal = useCollection(journalCol)
  const classes = useCollection(classesCol)
  const students = useCollection(studentsCol)

  // 用一個陣列描述每個源（資料、標籤、featureId、攞文字欄位），避免重複邏輯
  const sources = useMemo(
    () => [
      {
        label: '學習筆記',
        featureId: 'learning-notes',
        items: notes,
        getText: (n: Note) => [n.content],
      },
      {
        label: '題庫',
        featureId: 'work-questions',
        items: questions,
        getText: (q: Question) => [q.stem],
      },
      {
        label: '資源',
        featureId: 'work-resources',
        items: resources,
        getText: (r: Resource) => [r.title, r.notes],
      },
      {
        label: '教案',
        featureId: 'work-lesson-plan',
        items: lessonPlans,
        getText: (l: LessonPlan) => [l.title, l.objectives, l.activities],
      },
      {
        label: '會議筆記',
        featureId: 'work-meeting-notes',
        items: meetingNotes,
        getText: (m: MeetingNote) => [m.title, m.content],
      },
      {
        label: '閱讀清單',
        featureId: 'learning-reading',
        items: reading,
        getText: (r: ReadingItem) => [r.title, r.author],
      },
      {
        label: '日誌',
        featureId: 'learning-journal',
        items: journal,
        getText: (j: JournalEntry) => [j.content],
      },
      {
        label: '班別',
        featureId: 'work-classes',
        items: classes,
        getText: (c: Klass) => [c.name, c.subject],
      },
      {
        label: '學生',
        featureId: 'work-gradebook',
        items: students,
        getText: (s: Student) => [s.name],
      },
    ],
    [
      notes,
      questions,
      resources,
      lessonPlans,
      meetingNotes,
      reading,
      journal,
      classes,
      students,
    ],
  )

  const trimmed = keyword.trim()
  const lowerKeyword = trimmed.toLowerCase()

  // 計算每組結果
  const groups = useMemo<ResultGroup[]>(() => {
    if (!lowerKeyword) return []
    return sources.map((source) => {
      const hits: { id: string; snippet: string }[] = []
      for (const item of source.items as { id: string }[]) {
        const fields = (
          source.getText as (i: { id: string }) => (string | undefined)[]
        )(item)
        let snippet: string | null = null
        for (const field of fields) {
          if (!field) continue
          snippet = makeSnippet(field, lowerKeyword)
          if (snippet) break
        }
        if (snippet) hits.push({ id: item.id, snippet })
      }
      return { label: source.label, featureId: source.featureId, hits }
    })
  }, [sources, lowerKeyword])

  const visibleGroups = groups.filter((g) => g.hits.length > 0)
  const totalHits = visibleGroups.reduce((sum, g) => sum + g.hits.length, 0)

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">全域搜尋</h1>
        <p className="mt-1 text-sm text-slate-500">
          一次過喺所有筆記、題庫、資源、教案、班別、學生入面搵嘢（大細楷不分）。
        </p>
      </header>

      {/* 搜尋框 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <label htmlFor="global-search" className="sr-only">
          全域搜尋
        </label>
        <input
          id="global-search"
          autoFocus
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜尋筆記、題庫、資源、班別、學生…"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />

        {trimmed && (
          <p className="mt-3 text-sm text-slate-500">
            共{' '}
            <span className="font-semibold text-accent-strong">{totalHits}</span>{' '}
            項命中
          </p>
        )}
      </div>

      {/* 未輸入提示 */}
      {!trimmed && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          輸入關鍵字即時開始搜尋。
        </div>
      )}

      {/* 有輸入但無結果 */}
      {trimmed && totalHits === 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          搵唔到「<span className="text-slate-600">{trimmed}</span>」嘅結果。
        </div>
      )}

      {/* 有結果 */}
      {trimmed && totalHits > 0 && (
        <div className="mt-4 space-y-4">
          {visibleGroups.map((group) => (
            <section
              key={group.featureId}
              className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
            >
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {group.label}
                </h2>
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-strong">
                  {group.hits.length}
                </span>
              </div>

              <ul className="space-y-2">
                {group.hits.slice(0, MAX_PER_GROUP).map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() => open(group.featureId)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:border-accent hover:bg-accent hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/30"
                    >
                      {hit.snippet}
                    </button>
                  </li>
                ))}
                {group.hits.length > MAX_PER_GROUP && (
                  <li className="px-1 text-xs text-slate-400">
                    仲有 {group.hits.length - MAX_PER_GROUP} 項，撳上面任何一條去
                    {group.label}查看。
                  </li>
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
