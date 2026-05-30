import type { Card } from '../data/types'

// ============================================================
//  間隔重複排程（SM-2 精簡版）
// ============================================================

export type Rating = 'again' | 'hard' | 'good' | 'easy'

export const RATING_LABEL: Record<Rating, string> = {
  again: '😵 唔記得',
  hard: '😓 有啲難',
  good: '🙂 記得',
  easy: '😎 好易',
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function isDue(card: Card): boolean {
  return card.dueDate <= todayStr()
}

/** 計出複習後嘅新排程（回傳要 update 落卡嘅欄位） */
export function schedule(card: Card, rating: Rating): Partial<Card> {
  let ease = card.ease
  let intervalDays = card.intervalDays
  let repetitions = card.repetitions

  if (rating === 'again') {
    repetitions = 0
    ease = Math.max(1.3, ease - 0.2)
    intervalDays = 0
  } else {
    if (rating === 'hard') ease = Math.max(1.3, ease - 0.15)
    if (rating === 'easy') ease = ease + 0.15
    repetitions += 1

    if (repetitions === 1) intervalDays = rating === 'easy' ? 3 : 1
    else if (repetitions === 2) intervalDays = rating === 'easy' ? 8 : 6
    else {
      const factor =
        rating === 'hard' ? 1.2 : rating === 'easy' ? ease * 1.3 : ease
      intervalDays = Math.max(1, Math.round(intervalDays * factor))
    }
  }

  const due = new Date()
  due.setDate(due.getDate() + intervalDays)

  return {
    ease: Math.round(ease * 100) / 100,
    intervalDays,
    repetitions,
    dueDate: due.toISOString().slice(0, 10),
    lastReviewed: new Date().toISOString(),
  }
}
