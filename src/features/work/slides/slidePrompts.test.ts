import { describe, it, expect } from 'vitest'
import { buildSlideSystem, parseDeck } from './slidePrompts'

describe('buildSlideSystem', () => {
  it('注入科目同版數', () => {
    const s = buildSlideSystem('經濟', 8)
    expect(s).toContain('經濟')
    expect(s).toContain('8')
    expect(s).toContain('slides')
  })

  it('有 layout 同配圖指引', () => {
    const s = buildSlideSystem(undefined, 6)
    expect(s).toContain('"layout"')
    expect(s).toContain('"stats"')
    expect(s).toContain('"compare"')
    expect(s).toContain('"steps"')
    expect(s).toContain('"quote"')
    expect(s).toContain('"imageQuery"')
    expect(s).toContain('"coverImageQuery"')
  })

  it('版數夠 8 先提章節分隔版', () => {
    expect(buildSlideSystem('中史', 8)).toContain('章節分隔')
    expect(buildSlideSystem('中史', 6)).not.toContain('章節分隔')
  })

  it('pack-aware：按 pack 注入版式偏好（缺省唔加）', () => {
    expect(buildSlideSystem('地理', 8)).not.toContain('版式風格')
    // 月台 transit 偏好流程 + 大數字
    const transit = buildSlideSystem('地理', 8, 'transit')
    expect(transit).toContain('版式風格')
    expect(transit).toContain('路線旅程')
    expect(transit).toContain('流程')
    expect(transit).toContain('大數字')
    // 方格 grid 偏好對比 + 大數字
    const grid = buildSlideSystem('數學', 8, 'grid')
    expect(grid).toContain('對比')
    expect(grid).toContain('數理精準')
  })

  it('pack-aware 進階：密度／雙語按 pack 調', () => {
    // dawn 初小：少字大圖 + 唔出英文副題
    const dawn = buildSlideSystem('常識', 8, 'dawn')
    expect(dawn).toContain('寧少而精')
    expect(dawn).toContain('唔好出英文對照')
    // press 報章：較密
    expect(buildSlideSystem('通識', 8, 'press')).toContain('較密')
    // ivy 學院：高雙語
    expect(buildSlideSystem('英文', 8, 'ivy')).toContain('英文對照')
    // inkwell 無調密度／雙語（注意：base prompt 本身有「雙語課堂」字眼，故只斷言冇加 guidance line）
    const inkwell = buildSlideSystem('中文', 8, 'inkwell')
    expect(inkwell).not.toContain('內容密度')
    expect(inkwell).not.toContain('- 雙語：')
  })
})

/** 砌一個齊 title 嘅 deck JSON（slides + deck 級額外欄位） */
function wrap(slides: unknown[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ title: 'T', slides, ...extra })
}

describe('parseDeck', () => {
  const good = {
    title: '供求理論',
    subtitle: '經濟 · 中四',
    slides: [
      { title: '咩係供求', bullets: ['供應', '需求'], notes: '由生活例子入手' },
      { title: '均衡價格', bullets: ['交叉點'] },
    ],
  }

  it('解析純 JSON', () => {
    const d = parseDeck(JSON.stringify(good), 'X')
    expect(d.title).toBe('供求理論')
    expect(d.subtitle).toBe('經濟 · 中四')
    expect(d.slides).toHaveLength(2)
    expect(d.slides[0].notes).toBe('由生活例子入手')
    expect(d.slides[1].notes).toBeUndefined()
  })

  it('解析帶 fence', () => {
    const d = parseDeck('```json\n' + JSON.stringify(good) + '\n```', 'X')
    expect(d.slides).toHaveLength(2)
  })

  it('缺 title 用 fallback', () => {
    const d = parseDeck(JSON.stringify({ slides: [{ title: 'A', bullets: ['x'] }] }), '後備標題')
    expect(d.title).toBe('後備標題')
  })

  it('過濾空版同非字串 bullet', () => {
    const d = parseDeck(
      JSON.stringify({
        title: 'T',
        slides: [{ title: '', bullets: [] }, { title: '保留', bullets: ['ok', 1, ''] }],
      }),
      'X',
    )
    expect(d.slides).toHaveLength(1)
    expect(d.slides[0].bullets).toEqual(['ok'])
  })

  it('冇 slides 會 throw', () => {
    expect(() => parseDeck(JSON.stringify({ title: 'T', slides: [] }), 'X')).toThrow()
    expect(() => parseDeck('唔係 JSON', 'X')).toThrow()
  })

  it('舊格式（無新欄位）照舊 parse', () => {
    const d = parseDeck(JSON.stringify(good), 'X')
    expect(d.coverImageQuery).toBeUndefined()
    expect(d.slides[0].layout).toBeUndefined()
    expect(d.slides[0].stats).toBeUndefined()
    expect(d.slides[0].imageQuery).toBeUndefined()
  })

  // ───────── 每款 layout 解析成功 ─────────

  it('解析 stats 版式', () => {
    const d = parseDeck(
      wrap([
        {
          title: '關鍵數字',
          bullets: ['合格率 75%', '滿分 100'],
          layout: 'stats',
          stats: [
            { value: ' 75% ', label: ' 合格率 ' },
            { value: '1842', label: '南京條約年份' },
          ],
        },
      ]),
      'X',
    )
    expect(d.slides[0].layout).toBe('stats')
    expect(d.slides[0].stats).toEqual([
      { value: '75%', label: '合格率' },
      { value: '1842', label: '南京條約年份' },
    ])
    expect(d.slides[0].bullets).toEqual(['合格率 75%', '滿分 100'])
  })

  it('解析 compare 版式', () => {
    const d = parseDeck(
      wrap([
        {
          title: '供 vs 求',
          bullets: ['供應上升', '需求下降'],
          layout: 'compare',
          compare: {
            leftTitle: '供應',
            left: ['價格升供應升', '生產成本影響'],
            rightTitle: '需求',
            right: ['價格升需求跌', '收入影響'],
          },
        },
      ]),
      'X',
    )
    expect(d.slides[0].layout).toBe('compare')
    expect(d.slides[0].compare?.leftTitle).toBe('供應')
    expect(d.slides[0].compare?.right).toHaveLength(2)
  })

  it('解析 steps 版式（desc 選填）', () => {
    const d = parseDeck(
      wrap([
        {
          title: '實驗步驟',
          bullets: ['準備', '加熱', '記錄'],
          layout: 'steps',
          steps: [
            { title: '準備器材', desc: '量筒、酒精燈' },
            { title: '加熱' },
            { title: '記錄結果', desc: ' ' },
          ],
        },
      ]),
      'X',
    )
    expect(d.slides[0].layout).toBe('steps')
    expect(d.slides[0].steps).toHaveLength(3)
    expect(d.slides[0].steps?.[0].desc).toBe('量筒、酒精燈')
    expect(d.slides[0].steps?.[1].desc).toBeUndefined()
    expect(d.slides[0].steps?.[2].desc).toBeUndefined()
  })

  it('解析 quote 版式', () => {
    const d = parseDeck(
      wrap([
        {
          title: '名言',
          bullets: ['知與行'],
          layout: 'quote',
          quote: { text: '知之為知之，不知為不知，是知也。', attribution: '《論語》' },
        },
      ]),
      'X',
    )
    expect(d.slides[0].layout).toBe('quote')
    expect(d.slides[0].quote).toEqual({ text: '知之為知之，不知為不知，是知也。', attribution: '《論語》' })
  })

  it('解析 cards 版式（desc 選填）', () => {
    const d = parseDeck(
      wrap([
        {
          title: '三件工具',
          bullets: ['工具一', '工具二', '工具三'],
          layout: 'cards',
          cards: [
            { title: '會計等式', desc: '即時診斷交易影響' },
            { title: '試算表偵錯' },
            { title: '概念教練', desc: '逐個概念拆解' },
          ],
        },
      ]),
      'X',
    )
    expect(d.slides[0].layout).toBe('cards')
    expect(d.slides[0].cards).toHaveLength(3)
    expect(d.slides[0].cards?.[1].desc).toBeUndefined()
  })

  it('解析每版 subtitle 同 takeaway', () => {
    const d = parseDeck(
      wrap([
        {
          title: '會計等式練習場',
          subtitle: 'Accounting Equation Playground',
          bullets: ['判斷增減', '即時對照'],
          takeaway: '資產 = 負債 + 資本，永遠平衡。',
        },
      ]),
      'X',
    )
    expect(d.slides[0].subtitle).toBe('Accounting Equation Playground')
    expect(d.slides[0].takeaway).toBe('資產 = 負債 + 資本，永遠平衡。')
  })

  it('顯式 section 會清空 bullets', () => {
    const d = parseDeck(
      wrap([{ title: '第二章 均衡', bullets: ['呢啲應該被清走'], layout: 'section' }]),
      'X',
    )
    expect(d.slides[0].layout).toBe('section')
    expect(d.slides[0].bullets).toEqual([])
  })

  it('空 bullets 版照保留（推斷做章節）', () => {
    const d = parseDeck(wrap([{ title: '第一章 概念', bullets: [] }]), 'X')
    expect(d.slides).toHaveLength(1)
    expect(d.slides[0].layout).toBeUndefined()
    expect(d.slides[0].bullets).toEqual([])
  })

  // ───────── 唔合格 → 靜默回退要點版 ─────────

  it('stats 得 1 項回退要點版', () => {
    const d = parseDeck(
      wrap([{ title: 'A', bullets: ['x'], layout: 'stats', stats: [{ value: '75%', label: '合格率' }] }]),
      'X',
    )
    expect(d.slides[0].layout).toBeUndefined()
    expect(d.slides[0].stats).toBeUndefined()
    expect(d.slides[0].bullets).toEqual(['x'])
  })

  it('stats 5 項回退要點版', () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ value: `${i}`, label: `項目${i}` }))
    const d = parseDeck(wrap([{ title: 'A', bullets: ['x'], layout: 'stats', stats: five }]), 'X')
    expect(d.slides[0].layout).toBeUndefined()
    expect(d.slides[0].stats).toBeUndefined()
  })

  it('compare 缺一邊回退要點版', () => {
    const d = parseDeck(
      wrap([
        {
          title: 'A',
          bullets: ['x'],
          layout: 'compare',
          compare: { leftTitle: '供應', left: ['一', '二'] },
        },
      ]),
      'X',
    )
    expect(d.slides[0].layout).toBeUndefined()
    expect(d.slides[0].compare).toBeUndefined()
  })

  it('steps 空陣列回退要點版', () => {
    const d = parseDeck(wrap([{ title: 'A', bullets: ['x'], layout: 'steps', steps: [] }]), 'X')
    expect(d.slides[0].layout).toBeUndefined()
    expect(d.slides[0].steps).toBeUndefined()
  })

  it('quote 非 object 回退要點版', () => {
    const d = parseDeck(wrap([{ title: 'A', bullets: ['x'], layout: 'quote', quote: '一句嘢' }]), 'X')
    expect(d.slides[0].layout).toBeUndefined()
    expect(d.slides[0].quote).toBeUndefined()
  })

  it('未知 layout 值當普通要點版', () => {
    const d = parseDeck(wrap([{ title: 'A', bullets: ['x'], layout: 'fancy' }]), 'X')
    expect(d.slides[0].layout).toBeUndefined()
  })

  it('cards 得 1 張回退要點版', () => {
    const d = parseDeck(
      wrap([{ title: 'A', bullets: ['x'], layout: 'cards', cards: [{ title: '一張卡' }] }]),
      'X',
    )
    expect(d.slides[0].layout).toBeUndefined()
    expect(d.slides[0].cards).toBeUndefined()
  })

  it('cards 7 張回退要點版', () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({ title: `卡${i}` }))
    const d = parseDeck(wrap([{ title: 'A', bullets: ['x'], layout: 'cards', cards: seven }]), 'X')
    expect(d.slides[0].layout).toBeUndefined()
    expect(d.slides[0].cards).toBeUndefined()
  })

  it('imageQuery 非字串會被剷走', () => {
    const d = parseDeck(wrap([{ title: 'A', bullets: ['x'], imageQuery: 42 }]), 'X')
    expect(d.slides[0].imageQuery).toBeUndefined()
  })

  it('subtitle／takeaway 非字串或空白會被剷走', () => {
    const d = parseDeck(
      wrap([{ title: 'A', bullets: ['x'], subtitle: 7, takeaway: '   ' }]),
      'X',
    )
    expect(d.slides[0].subtitle).toBeUndefined()
    expect(d.slides[0].takeaway).toBeUndefined()
  })

  it('takeaway 超長會截斷', () => {
    const d = parseDeck(wrap([{ title: 'A', bullets: ['x'], takeaway: '長'.repeat(60) }]), 'X')
    expect(d.slides[0].takeaway).toHaveLength(46)
    expect(d.slides[0].takeaway?.endsWith('…')).toBe(true)
  })

  // ───────── 截長 + 搜尋詞清理 ─────────

  it('超長字段會截斷', () => {
    const longBullet = '長'.repeat(70)
    const d = parseDeck(
      wrap([
        {
          title: 'A',
          bullets: Array.from({ length: 8 }, () => longBullet),
          layout: 'stats',
          stats: [
            { value: '一二三四五六七八九十', label: '標'.repeat(25) },
            { value: '75%', label: '合格率' },
          ],
        },
        {
          title: 'B',
          bullets: ['x'],
          layout: 'quote',
          quote: { text: '句'.repeat(70) },
        },
      ]),
      'X',
    )
    // bullets：最多 6 點、每點 ≤60 字
    expect(d.slides[0].bullets).toHaveLength(6)
    expect(d.slides[0].bullets[0]).toHaveLength(60)
    expect(d.slides[0].bullets[0].endsWith('…')).toBe(true)
    // stats：value ≤8 字、label ≤20 字
    expect(d.slides[0].stats?.[0].value).toHaveLength(8)
    expect(d.slides[0].stats?.[0].label).toHaveLength(20)
    // quote：text ≤60 字
    expect(d.slides[1].quote?.text).toHaveLength(60)
  })

  it('steps 同 compare 字段都會截長', () => {
    const d = parseDeck(
      wrap([
        {
          title: 'A',
          bullets: ['x'],
          layout: 'steps',
          steps: [
            { title: '步'.repeat(15), desc: '述'.repeat(50) },
            { title: '完成' },
          ],
        },
        {
          title: 'B',
          bullets: ['y'],
          layout: 'compare',
          compare: {
            leftTitle: '甲',
            left: ['點'.repeat(35), '短點'],
            rightTitle: '乙',
            right: ['一', '二'],
          },
        },
      ]),
      'X',
    )
    expect(d.slides[0].steps?.[0].title).toHaveLength(12)
    expect(d.slides[0].steps?.[0].desc).toHaveLength(40)
    expect(d.slides[1].compare?.left[0]).toHaveLength(30)
  })

  it('imageQuery 清理空白並最多 4 個字', () => {
    const d = parseDeck(
      wrap([{ title: 'A', bullets: ['x'], imageQuery: '  great   wall of china sunset  ' }], {
        coverImageQuery: ' hong kong harbour skyline night ',
      }),
      'X',
    )
    expect(d.slides[0].imageQuery).toBe('great wall of china')
    expect(d.coverImageQuery).toBe('hong kong harbour skyline')
  })
})
