import { describe, expect, it } from 'vitest'
import { buildInviteLink, isValidInviteEmail, teamInviteErrorMessage } from './team'

describe('團隊邀請', () => {
  it.each(['teacher@school.edu.hk', 'name+subject@example.com'])(
    '接受有效電郵：%s',
    (email) => expect(isValidInviteEmail(email)).toBe(true),
  )

  it.each(['teacher', 'teacher@', '@school.edu.hk', 'a b@school.edu.hk'])(
    '拒絕無效電郵：%s',
    (email) => expect(isValidInviteEmail(email)).toBe(false),
  )

  it('邀請連結直接打開團隊工作區', () => {
    expect(buildInviteLink('a+b', 'https://eziteach.hk')).toBe(
      'https://eziteach.hk/app/work-team?invite=a%2Bb',
    )
  })

  it('把後端邀請錯誤轉成可行動訊息', () => {
    expect(teamInviteErrorMessage('invite email mismatch')).toContain('指定電郵')
    expect(teamInviteErrorMessage('invite expired')).toContain('重新發出')
    expect(teamInviteErrorMessage('seat limit reached')).toContain('增加座位')
  })
})
