import { describe, expect, it } from 'vitest'
import type { Feature } from '../features/types'
import { sidebarGroupPreview } from './Sidebar'

function feature(id: string): Feature {
  return {
    id,
    modes: ['work'],
    name: id,
    description: id,
    icon: 'x',
    group: '教學',
    status: 'ready',
  }
}

describe('側欄分類預覽', () => {
  it('先顯示目前功能，再顯示相關工具', () => {
    const items = [
      'work-lesson-plan',
      'work-generate',
      'work-questions',
      'work-rubric',
      'work-slides',
      'work-resources',
    ].map(feature)

    expect(sidebarGroupPreview(items, 'work-generate').map((item) => item.id)).toEqual([
      'work-generate',
      'work-questions',
      'work-rubric',
      'work-lesson-plan',
      'work-slides',
    ])
  })

  it('沒有目前功能時只顯示首五項', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'].map(feature)
    expect(sidebarGroupPreview(items, null).map((item) => item.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ])
  })
})
