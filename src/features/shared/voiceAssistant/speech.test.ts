import { describe, expect, it } from 'vitest'
import {
  plainTextForSpeech,
  selectSpeechVoice,
  speechRecognitionErrorMessage,
  speechVoiceScore,
} from './speech'
import { resolveVoiceIntent } from './intent'

describe('語音助手文字處理', () => {
  it('朗讀前移除 Markdown 標記但保留正文', () => {
    expect(plainTextForSpeech('## 重點\n- **形成性評估**\n- [參考](https://example.com)')).toBe(
      '重點 形成性評估 參考',
    )
  })

  it('把咪高峰權限錯誤轉成普通狀態訊息', () => {
    expect(speechRecognitionErrorMessage('not-allowed')).toContain('允許咪高峰權限')
    expect(speechRecognitionErrorMessage('aborted')).toBe('')
  })

  it('同語言時優先選用自然或增強聲線', () => {
    const basic = {
      default: true,
      lang: 'zh-HK',
      localService: true,
      name: 'Sinji',
      voiceURI: 'basic',
    } as SpeechSynthesisVoice
    const natural = {
      default: false,
      lang: 'zh-HK',
      localService: false,
      name: 'Natural Cantonese',
      voiceURI: 'natural',
    } as SpeechSynthesisVoice

    expect(speechVoiceScore(natural, 'zh-HK')).toBeGreaterThan(
      speechVoiceScore(basic, 'zh-HK'),
    )
    expect(selectSpeechVoice([basic, natural], 'zh-HK')).toBe(natural)
  })
})

describe('語音指令分流', () => {
  it('製作簡報會直接前往簡報工作室', () => {
    expect(resolveVoiceIntent('幫我整一份中二百分比簡報')).toMatchObject({
      kind: 'tool',
      route: { featureId: 'work-slides' },
    })
  })

  it('一般教學問題留在語音助手回答', () => {
    expect(resolveVoiceIntent('什麼是形成性評估？')).toEqual({ kind: 'assistant' })
  })
})
