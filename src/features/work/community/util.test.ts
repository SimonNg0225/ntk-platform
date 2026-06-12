import { describe, it, expect } from 'vitest'
import {
  buildDisplayName,
  publicName,
  avgRating,
  validateFile,
  validatePublish,
  matchesFilter,
  sortResources,
  type PublishInput,
} from './util'
import type { CommunityResource } from '../../../lib/community'

// ───────── 身份署名 ─────────

describe('buildDisplayName', () => {
  it('姓 + 稱謂', () => {
    expect(buildDisplayName('陳', '老師')).toBe('陳老師')
    expect(buildDisplayName('黃', 'Sir')).toBe('黃Sir')
  })
  it('空姓回空字串', () => {
    expect(buildDisplayName('  ', '老師')).toBe('')
  })
})

describe('publicName', () => {
  it('匿名 → 匿名老師（唔理學校）', () => {
    expect(publicName({ displayName: '陳老師', school: 'XX中學', showSchool: true, anonymous: true })).toBe('匿名老師')
  })
  it('顯示學校 → 學校 + 署名', () => {
    expect(publicName({ displayName: '陳老師', school: 'XX中學', showSchool: true, anonymous: false })).toBe('XX中學 陳老師')
  })
  it('唔顯示學校 → 淨署名', () => {
    expect(publicName({ displayName: '陳老師', school: 'XX中學', showSchool: false, anonymous: false })).toBe('陳老師')
  })
  it('顯示學校但無學校 → 淨署名', () => {
    expect(publicName({ displayName: '陳老師', school: null, showSchool: true, anonymous: false })).toBe('陳老師')
  })
  it('空署名 fallback 老師', () => {
    expect(publicName({ displayName: '  ', school: null, showSchool: false, anonymous: false })).toBe('老師')
  })
})

describe('avgRating', () => {
  it('未有評分 = 0', () => {
    expect(avgRating({ ratingSum: 0, ratingCount: 0 })).toBe(0)
  })
  it('平均', () => {
    expect(avgRating({ ratingSum: 18, ratingCount: 4 })).toBe(4.5)
  })
})

// ───────── 檔案驗證 ─────────

describe('validateFile', () => {
  it('合格 PDF', () => {
    expect(validateFile({ name: '教案.pdf', size: 1024 }).ok).toBe(true)
  })
  it('唔合格副檔名', () => {
    expect(validateFile({ name: 'virus.exe', size: 1024 }).ok).toBe(false)
  })
  it('太大', () => {
    expect(validateFile({ name: 'a.pdf', size: 26 * 1024 * 1024 }).ok).toBe(false)
  })
  it('空檔', () => {
    expect(validateFile({ name: 'a.pdf', size: 0 }).ok).toBe(false)
  })
})

// ───────── 發佈驗證 ─────────

function pub(over: Partial<PublishInput> = {}): PublishInput {
  return { title: '一份工作紙', type: 'handout', license: 'original', hasFile: true, ...over }
}

describe('validatePublish', () => {
  it('合格（檔案型）', () => {
    expect(validatePublish(pub()).ok).toBe(true)
  })
  it('合格（連結型）', () => {
    expect(validatePublish(pub({ hasFile: false, externalUrl: 'https://example.com/x' })).ok).toBe(true)
  })
  it('缺標題', () => {
    expect(validatePublish(pub({ title: '  ' })).ok).toBe(false)
  })
  it('既無檔又無連結', () => {
    expect(validatePublish(pub({ hasFile: false, externalUrl: '' })).ok).toBe(false)
  })
  it('連結格式錯', () => {
    expect(validatePublish(pub({ hasFile: false, externalUrl: 'not-a-url' })).ok).toBe(false)
  })
  it('標籤過多', () => {
    expect(validatePublish(pub({ tags: Array.from({ length: 13 }, (_, i) => `t${i}`) })).ok).toBe(false)
  })
})

// ───────── 篩選 + 排序 ─────────

function mk(over: Partial<CommunityResource>): CommunityResource {
  return {
    id: 'r', ownerId: 'o', title: '', description: null, subjectPackId: null, topicId: null,
    grade: null, type: 'handout', tags: [], filePath: null, fileName: null, fileMime: null,
    fileSize: null, externalUrl: null, license: 'original', status: 'published',
    downloadCount: 0, saveCount: 0, ratingSum: 0, ratingCount: 0,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  }
}

describe('matchesFilter', () => {
  it('科目唔啱 → false', () => {
    expect(matchesFilter(mk({ subjectPackId: 'econ' }), { subjectPackId: 'bafs' })).toBe(false)
  })
  it('關鍵字比對標題/描述/標籤', () => {
    const r = mk({ title: '供求曲線', tags: ['圖表'] })
    expect(matchesFilter(r, { q: '供求' })).toBe(true)
    expect(matchesFilter(r, { q: '圖表' })).toBe(true)
    expect(matchesFilter(r, { q: '歷史' })).toBe(false)
  })
  it('類型 + 年級', () => {
    const r = mk({ type: 'slides', grade: '中四' })
    expect(matchesFilter(r, { type: 'slides', grade: '中四' })).toBe(true)
    expect(matchesFilter(r, { type: 'paper' })).toBe(false)
  })
})

describe('sortResources', () => {
  const a = mk({ id: 'a', downloadCount: 10, saveCount: 1, ratingSum: 5, ratingCount: 1, createdAt: '2026-01-01T00:00:00Z' })
  const b = mk({ id: 'b', downloadCount: 2, saveCount: 9, ratingSum: 20, ratingCount: 5, createdAt: '2026-03-01T00:00:00Z' })
  it('最多下載', () => {
    expect(sortResources([b, a], 'downloads').map((r) => r.id)).toEqual(['a', 'b'])
  })
  it('最多收藏', () => {
    expect(sortResources([a, b], 'saves').map((r) => r.id)).toEqual(['b', 'a'])
  })
  it('最高評分（avg 4 > 5? b=4, a=5）', () => {
    expect(sortResources([b, a], 'rating').map((r) => r.id)).toEqual(['a', 'b'])
  })
  it('最新', () => {
    expect(sortResources([a, b], 'recent').map((r) => r.id)).toEqual(['b', 'a'])
  })
})
