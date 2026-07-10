import { describe, expect, it } from 'vitest'
import { appRouteId } from './lib/appRoute'

describe('App 深連結', () => {
  it.each([
    ['/app', null],
    ['/app/work-slides', 'work-slides'],
    ['/app/work/work-grade-analytics', 'work-grade-analytics'],
    ['/app/settings', '__settings__'],
    ['/app/admin', '__admin__'],
    ['/app/not-a-feature', null],
  ])('%s', (pathname, expected) => {
    expect(appRouteId(pathname)).toBe(expected)
  })
})
