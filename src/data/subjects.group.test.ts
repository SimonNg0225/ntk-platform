import { describe, it, expect } from 'vitest'
import {
  packOfTopicId,
  groupTopicsBySubject,
  missingTopicsForSubjects,
  getSubjectPack,
} from './subjects'
import type { Topic } from './types'

const t = (id: string, topic = id): Topic => ({ id, part: '', area: '', topic, order: 0 })

describe('packOfTopicId', () => {
  it('用最長前綴配對（bafs-acct 唔會誤配去更短前綴）', () => {
    expect(packOfTopicId('bafs-acct-01')?.id).toBe('bafs-acct')
    expect(packOfTopicId('bafs-bm-03')?.id).toBe('bafs-bm')
  })
  it('一般單段前綴', () => {
    expect(packOfTopicId('chin-01')?.id).toBe('chin')
    expect(packOfTopicId('econ-12')?.id).toBe('econ')
    expect(packOfTopicId('m1-02')?.id).toBe('m1')
  })
  it('legacy bafs-NN（冇 plain bafs pack）→ undefined', () => {
    expect(packOfTopicId('bafs-01')).toBeUndefined()
  })
  it('完全未知前綴 → undefined', () => {
    expect(packOfTopicId('zzz-99')).toBeUndefined()
  })
})

describe('groupTopicsBySubject', () => {
  it('按科目分組，保留輸入次序（組同組內）', () => {
    const groups = groupTopicsBySubject([
      t('bafs-acct-01'),
      t('chin-01'),
      t('bafs-acct-02'),
      t('econ-01'),
      t('chin-02'),
    ])
    expect(groups.map((g) => g.key)).toEqual(['bafs-acct', 'chin', 'econ'])
    expect(groups[0].name).toBe('企會財（會計範疇）')
    expect(groups[0].topics.map((x) => x.id)).toEqual(['bafs-acct-01', 'bafs-acct-02'])
    expect(groups[1].topics.map((x) => x.id)).toEqual(['chin-01', 'chin-02'])
  })

  it('legacy bafs-NN → 友善名「企會財（BAFS）」', () => {
    const groups = groupTopicsBySubject([t('bafs-01'), t('bafs-02')])
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('企會財（BAFS）')
    expect(groups[0].topics).toHaveLength(2)
  })

  it('配唔到科目 → 後備組「其他課題」', () => {
    const groups = groupTopicsBySubject([t('zzz-01')])
    expect(groups[0].name).toBe('其他課題')
  })

  it('空輸入 → 空陣列', () => {
    expect(groupTopicsBySubject([])).toEqual([])
  })
})

describe('missingTopicsForSubjects', () => {
  const chin = getSubjectPack('chin')!
  const econ = getSubjectPack('econ')!
  const acct = getSubjectPack('bafs-acct')!

  it('全新科目 → 回該科全部課題', () => {
    expect(missingTopicsForSubjects([], ['chin']).map((t) => t.id)).toEqual(
      chin.topics.map((t) => t.id),
    )
  })

  it('id 已存在 → 唔重覆', () => {
    expect(missingTopicsForSubjects(chin.topics, ['chin'])).toEqual([])
  })

  it('文字去重：legacy bafs-NN 已在 → 載 bafs-acct 唔翻撈（同一批 BAFS 課題）', () => {
    const legacy = acct.topics.map((t, i) => ({
      ...t,
      id: `bafs-${String(i + 1).padStart(2, '0')}`,
    }))
    expect(missingTopicsForSubjects(legacy, ['bafs-acct'])).toEqual([])
  })

  it('未知科目 id → 跳過', () => {
    expect(missingTopicsForSubjects([], ['zzz-唔存在'])).toEqual([])
  })

  it('多科：只補未有嗰啲', () => {
    expect(missingTopicsForSubjects(chin.topics, ['chin', 'econ']).map((t) => t.id)).toEqual(
      econ.topics.map((t) => t.id),
    )
  })
})
