// ============================================================
//  logic.test.ts — TDD：先寫測試，後實現
// ============================================================

import { describe, it, expect } from 'vitest'
import { validateUpload, fileKind, fmtSize, avg, sortOrder } from './logic'

describe('validateUpload', () => {
  it('空標題 → 錯誤', () => {
    expect(validateUpload({ title: '', type: 'handout' })).not.toBeNull()
  })

  it('標題超過 120 字 → 錯誤', () => {
    expect(validateUpload({ title: 'a'.repeat(121), type: 'handout' })).not.toBeNull()
  })

  it('link 類型但無 URL → 錯誤', () => {
    expect(validateUpload({ title: '測試連結', type: 'link' })).not.toBeNull()
  })

  it('link 類型有合法 https URL → 通過', () => {
    expect(validateUpload({ title: '測試連結', type: 'link', externalUrl: 'https://example.com' })).toBeNull()
  })

  it('link 類型有非法 URL → 錯誤', () => {
    expect(validateUpload({ title: '測試連結', type: 'link', externalUrl: 'not-a-url' })).not.toBeNull()
  })

  it('handout 類型無檔案 → 錯誤', () => {
    expect(validateUpload({ title: '測試講義', type: 'handout' })).not.toBeNull()
  })

  it('handout 類型有合法 pdf 檔 → 通過', () => {
    const file = new File(['x'], 'test.pdf', { type: 'application/pdf' })
    expect(validateUpload({ title: '測試講義', type: 'handout', file })).toBeNull()
  })

  it('handout 類型有不允許副檔名 → 錯誤', () => {
    const file = new File(['x'], 'test.exe', { type: 'application/octet-stream' })
    expect(validateUpload({ title: '測試講義', type: 'handout', file })).not.toBeNull()
  })
})

describe('fileKind', () => {
  it('pdf mime → pdf', () => {
    expect(fileKind('application/pdf', 'file.pdf')).toBe('pdf')
  })

  it('image mime → image', () => {
    expect(fileKind('image/jpeg', 'photo.jpg')).toBe('image')
  })

  it('pptx mime → office', () => {
    expect(fileKind('application/vnd.openxmlformats-officedocument.presentationml.presentation', 'slides.pptx')).toBe('office')
  })

  it('ext fallback for pdf → pdf', () => {
    expect(fileKind('application/octet-stream', 'doc.pdf')).toBe('pdf')
  })

  it('unknown mime + ext → other', () => {
    expect(fileKind('application/zip', 'archive.zip')).toBe('other')
  })
})

describe('fmtSize', () => {
  it('bytes range', () => {
    expect(fmtSize(500)).toBe('500 B')
  })

  it('KB range', () => {
    expect(fmtSize(2048)).toBe('2.0 KB')
  })

  it('MB range', () => {
    expect(fmtSize(2.3 * 1024 * 1024)).toMatch(/MB/)
  })
})

describe('avg', () => {
  it('count 0 → 0', () => {
    expect(avg(10, 0)).toBe(0)
  })

  it('正常計算', () => {
    expect(avg(15, 3)).toBe(5)
  })
})

describe('sortOrder', () => {
  it("'new' → created_at desc", () => {
    expect(sortOrder('new')).toEqual({ column: 'created_at', ascending: false })
  })

  it("'popular' → download_count desc", () => {
    expect(sortOrder('popular')).toEqual({ column: 'download_count', ascending: false })
  })
})
