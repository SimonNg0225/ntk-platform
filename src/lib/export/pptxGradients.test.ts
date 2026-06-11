import { test, expect } from 'vitest'
import { resetGradients, gradLinear, gradRadial, injectGradients } from './pptxGradients'

function fakeZip(initial: Record<string, string>) {
  const files: Record<string, string> = { ...initial }
  return {
    files,
    file(name: string, data?: string) {
      if (data !== undefined) {
        files[name] = data
        return undefined
      }
      return name in files ? { asText: () => files[name] } : null
    },
  }
}

test('gradLinear 回 FE-sentinel；injectGradients 換成 gradFill', () => {
  resetGradients()
  const s = gradLinear(90, [
    { pos: 0, color: 'FF0000' },
    { pos: 100, color: '0000FF' },
  ])
  expect(s).toMatch(/^FE[0-9A-F]{4}$/)
  const zip = fakeZip({ 'ppt/slides/slide1.xml': `<p:sp><a:solidFill><a:srgbClr val="${s}"/></a:solidFill></p:sp>` })
  const n = injectGradients(zip)
  expect(n).toBe(1)
  const out = zip.files['ppt/slides/slide1.xml']
  expect(out).toContain('<a:gradFill')
  expect(out).toContain('<a:lin ang="5400000"') // 90° = 上→下
  expect(out).toContain('<a:gs pos="0"><a:srgbClr val="FF0000"></a:srgbClr></a:gs>')
  expect(out).not.toContain(s) // sentinel 已換走
})

test('gradRadial → path="circle"', () => {
  resetGradients()
  const s = gradRadial([
    { pos: 0, color: 'FFFFFF' },
    { pos: 100, color: '000000' },
  ])
  const zip = fakeZip({ 'ppt/slides/slide1.xml': `<a:solidFill><a:srgbClr val="${s}"/></a:solidFill>` })
  injectGradients(zip)
  expect(zip.files['ppt/slides/slide1.xml']).toContain('path="circle"')
})

test('reset 後冇登記 → 唔郁 XML', () => {
  resetGradients()
  const zip = fakeZip({ 'ppt/slides/slide1.xml': '<x/>' })
  expect(injectGradients(zip)).toBe(0)
  expect(zip.files['ppt/slides/slide1.xml']).toBe('<x/>')
})
