import { describe, it, expect, vi, afterEach } from 'vitest'
import { csvEscape, downloadCsv } from './csv'

// ───────── csvEscape：RFC-ish CSV 欄位轉義 ─────────
describe('csvEscape', () => {
  it('普通字串原樣返回', () => {
    expect(csvEscape('plain')).toBe('plain')
    expect(csvEscape('abc')).toBe('abc')
  })
  it('數字轉字串', () => {
    expect(csvEscape(42)).toBe('42')
    expect(csvEscape(0)).toBe('0')
    expect(csvEscape(-5)).toBe('-5')
  })
  it('含逗號要加引號', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
  })
  it('含引號要 double 並加引號', () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
    expect(csvEscape('a"b')).toBe('"a""b"')
  })
  it('含換行要加引號', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')
  })
  it('空字串原樣', () => {
    expect(csvEscape('')).toBe('')
  })
  it('lone \\r 唔觸發引號（與原 work 模組行為一致）', () => {
    expect(csvEscape('a\rb')).toBe('a\rb')
  })
})

// ───────── downloadCsv：BOM + \r\n + Blob 下載 ─────────
describe('downloadCsv', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function setup() {
    const blobParts: BlobPart[][] = []
    const blobOpts: (BlobPropertyBag | undefined)[] = []
    class FakeBlob {
      constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
        blobParts.push(parts)
        blobOpts.push(opts)
      }
    }
    const anchor = {
      href: '',
      download: '',
      click: vi.fn(),
    }
    const createObjectURL = vi.fn(() => 'blob:fake-url')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('Blob', FakeBlob as unknown as typeof Blob)
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
    })
    return { blobParts, blobOpts, anchor, createObjectURL, revokeObjectURL }
  }

  it('用 \\r\\n 連行、逗號連欄，並逐欄轉義', () => {
    const { blobParts } = setup()
    downloadCsv('x.csv', [
      ['a', 'b'],
      ['c,d', 'e'],
    ])
    const text = String(blobParts[0][0])
    // 去掉開頭 BOM 再比對 CSV 主體
    expect(text.slice(1)).toBe('a,b\r\n"c,d",e')
  })

  it('開頭含 UTF-8 BOM（U+FEFF）令 Excel 正確讀中文', () => {
    const { blobParts } = setup()
    downloadCsv('x.csv', [['中文']])
    const text = String(blobParts[0][0])
    expect(text.charCodeAt(0)).toBe(0xfeff)
    expect(text.slice(1)).toBe('中文')
  })

  it('Blob mime 為 text/csv;charset=utf-8;', () => {
    const { blobOpts } = setup()
    downloadCsv('x.csv', [['a']])
    expect(blobOpts[0]).toEqual({ type: 'text/csv;charset=utf-8;' })
  })

  it('設定 anchor.download 檔名、click 一次、最後 revoke URL', () => {
    const { anchor, createObjectURL, revokeObjectURL } = setup()
    downloadCsv('成績.csv', [['a']])
    expect(anchor.download).toBe('成績.csv')
    expect(anchor.href).toBe('blob:fake-url')
    expect(anchor.click).toHaveBeenCalledTimes(1)
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
  })
})
