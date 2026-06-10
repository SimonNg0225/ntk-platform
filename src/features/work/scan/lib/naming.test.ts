import { describe, it, expect } from 'vitest'
import { outputFilenames } from './naming'

describe('outputFilenames', () => {
  it('合併模式：單一檔名', () => {
    expect(outputFilenames('掃描', 'merged', 3)).toEqual(['掃描.pdf'])
  })
  it('逐張分檔：每頁加序號（補零）', () => {
    expect(outputFilenames('功課', 'perPage', 3)).toEqual([
      '功課-01.pdf', '功課-02.pdf', '功課-03.pdf',
    ])
  })
  it('空白名 fallback 做「掃描」', () => {
    expect(outputFilenames('   ', 'merged', 1)).toEqual(['掃描.pdf'])
  })
  it('清走唔合法檔名字元', () => {
    expect(outputFilenames('a/b:c', 'merged', 1)).toEqual(['a b c.pdf'])
  })
})
