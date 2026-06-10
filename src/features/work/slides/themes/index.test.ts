import { describe, it, expect } from 'vitest'
import { allThemes, getTheme } from './index'
import { SLIDE_TYPES } from '../types'

describe('slides/themes', () => {
  it('開檔有 4 個樣板', () => {
    expect(allThemes.map((t) => t.id)).toEqual(['academic', 'playful', 'minimal', 'chalk'])
  })

  it('getTheme 無效 id 回退第一個 theme', () => {
    expect(getTheme('nope').id).toBe(allThemes[0].id)
  })

  it('每個 theme 對所有 slide-type 都有 recipe，且 token 完整', () => {
    for (const th of allThemes) {
      expect(th.id).toBeTruthy()
      expect(th.tokens.palette.bg).toBeTruthy()
      expect(th.tokens.fonts.display).toBeTruthy()
      for (const t of SLIDE_TYPES) {
        expect(th.recipe[t], `${th.id} 缺 ${t} recipe`).toBeDefined()
      }
    }
  })
})
