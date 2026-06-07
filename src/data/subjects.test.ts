import { describe, it, expect } from 'vitest'
import {
  SUBJECT_PACKS,
  getSubjectPack,
  packTopics,
  DEFAULT_SUBJECT_PACK_ID,
} from './subjects'
import { BAFS_TOPICS } from './bafs'

describe('subjects — 科目包', () => {
  it('每個包嘅 id 唯一', () => {
    const ids = SUBJECT_PACKS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('每個包內 topic id 唯一，且以包 id 為前綴', () => {
    for (const pack of SUBJECT_PACKS) {
      const ids = pack.topics.map((t) => t.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const t of pack.topics) {
        expect(t.id.startsWith(`${pack.id}-`)).toBe(true)
      }
    }
  })

  it('topic order 由 1 連續遞增', () => {
    for (const pack of SUBJECT_PACKS) {
      pack.topics.forEach((t, i) => expect(t.order).toBe(i + 1))
    }
  })

  it('每個 topic 都有 part / area / topic', () => {
    for (const pack of SUBJECT_PACKS) {
      for (const t of pack.topics) {
        expect(t.part).toBeTruthy()
        expect(t.area).toBeTruthy()
        expect(t.topic).toBeTruthy()
      }
    }
  })

  it('BAFS 包直接重用 BAFS_TOPICS（預設種子不變）', () => {
    const bafs = getSubjectPack('bafs')
    expect(bafs).toBeDefined()
    expect(bafs!.topics).toBe(BAFS_TOPICS)
    expect(packTopics(bafs!)).toBe(BAFS_TOPICS)
  })

  it('預設包 id 對應一個存在嘅包', () => {
    expect(getSubjectPack(DEFAULT_SUBJECT_PACK_ID)).toBeDefined()
  })

  it('「自訂」包係空課題', () => {
    expect(getSubjectPack('custom')!.topics).toHaveLength(0)
  })

  it('getSubjectPack 對不存在 id 回 undefined', () => {
    expect(getSubjectPack('nope')).toBeUndefined()
  })
})
