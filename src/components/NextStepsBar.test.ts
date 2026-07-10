import { afterEach, describe, expect, it } from 'vitest'
import { collectionRegistry, type Collection, type Entity } from '../lib/store'
import { hasSavedFeatureOutput } from './NextStepsBar'

const previousQuestions = collectionRegistry.get('questions')

function collectionWith(count: number): Collection<Entity> {
  const items = Array.from({ length: count }, (_, index) => ({ id: String(index) }))
  return {
    get: () => items,
    set: () => undefined,
    add: () => items[0] ?? { id: 'new' },
    update: () => undefined,
    remove: () => undefined,
    subscribe: () => () => undefined,
  }
}

afterEach(() => {
  if (previousQuestions) collectionRegistry.set('questions', previousQuestions)
  else collectionRegistry.delete('questions')
})

describe('下一步成果判斷', () => {
  it('未有儲存成果時不顯示', () => {
    collectionRegistry.set('questions', collectionWith(0))
    expect(hasSavedFeatureOutput('work-generate')).toBe(false)
  })

  it('已有題目成果時顯示', () => {
    collectionRegistry.set('questions', collectionWith(1))
    expect(hasSavedFeatureOutput('work-generate')).toBe(true)
  })

  it('沒有可靠成果來源的功能不顯示', () => {
    expect(hasSavedFeatureOutput('work-tasks')).toBe(false)
  })
})
