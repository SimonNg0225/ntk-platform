import { describe, expect, it } from 'vitest'
import { isSafeAppReturnPath } from './authReturn'

describe('OAuth 回流路徑', () => {
  it.each(['/app', '/app/work-team?invite=abc', '/app/work-slides'])(
    '接受安全 app 路徑：%s',
    (path) => expect(isSafeAppReturnPath(path)).toBe(true),
  )

  it.each(['/', '/pricing', '//evil.example/app', 'https://evil.example/app'])(
    '拒絕：%s',
    (path) => expect(isSafeAppReturnPath(path)).toBe(false),
  )
})
