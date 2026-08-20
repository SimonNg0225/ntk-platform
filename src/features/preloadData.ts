let preloadPromise: Promise<void> | null = null

/**
 * Register feature-owned collections without loading feature screens.
 * Sync, backup and restore need the stores; they do not need scanners, charts,
 * PDF engines or editor UI in memory.
 */
export function preloadFeatureData(): Promise<void> {
  if (preloadPromise) return preloadPromise
  preloadPromise = Promise.all([
    import('./learning/cardgen/store'),
    import('./learning/dashboard/util'),
    import('./learning/fitness/body/store'),
    import('./learning/fitness/coach/store'),
    import('./learning/fitness/library/store'),
    import('./learning/fitness/nutrition/store'),
    import('./learning/fitness/training/store'),
    import('./learning/flashcards/store'),
    import('./learning/focus/store'),
    import('./learning/goals/types'),
    import('./learning/habits/types'),
    import('./learning/health/store'),
    import('./learning/journal/store'),
    import('./learning/notes/store'),
    import('./learning/reading/types'),
    import('./shared/aiAssistant/store'),
    import('./shared/globalSearch/util'),
    import('./shared/inbox/store'),
    import('./shared/quiz/util'),
    import('./work/budget/util'),
    import('./work/classroomPack/store'),
    import('./work/dashboard/store'),
    import('./work/docDigest/digestStore'),
    import('./work/dse/dseStore'),
    import('./work/lessonPlanner/util'),
    import('./work/meetingNotes/util'),
    import('./work/resourceLibrary/drive/store'),
    import('./work/resourceLibrary/util'),
    import('./work/rubric/rubricStore'),
    import('./work/slides/slideStore'),
    import('./work/teachGuide/guideStore'),
    import('./work/timetable/store'),
    import('./work/todo/store'),
    import('./work/transcribe/transcribeStore'),
  ]).then(() => undefined)
  return preloadPromise
}
