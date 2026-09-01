import { describe, expect, it } from 'vitest'
import {
  float32ToPcm16Base64,
  mergeLiveTranscript,
  normalizedAudioLevel,
  pcm16Base64ToFloat32,
  resampleFloat32,
} from './liveVoice'

describe('即時語音音訊轉換', () => {
  it('把浮點聲音轉成 PCM16 後可還原主要振幅', () => {
    const source = new Float32Array([-1, -0.5, 0, 0.5, 1])
    const restored = pcm16Base64ToFloat32(float32ToPcm16Base64(source))
    expect(Array.from(restored)).toEqual(
      expect.arrayContaining([
        expect.closeTo(-1, 3),
        expect.closeTo(-0.5, 3),
        expect.closeTo(0, 3),
        expect.closeTo(0.5, 3),
        expect.closeTo(1, 3),
      ]),
    )
  })

  it('把瀏覽器音訊重採樣成 Gemini Live 要求的 16 kHz', () => {
    const source = new Float32Array(4_800).fill(0.5)
    const resampled = resampleFloat32(source, 48_000, 16_000)
    expect(resampled).toHaveLength(1_600)
    expect(resampled[0]).toBeCloseTo(0.5)
    expect(resampled.at(-1)).toBeCloseTo(0.5)
  })

  it('把咪高峰振幅正規化成可供介面使用的 0 至 1 音量', () => {
    expect(normalizedAudioLevel(new Float32Array(32))).toBe(0)
    expect(normalizedAudioLevel(new Float32Array(32).fill(0.05))).toBeGreaterThan(0)
    expect(normalizedAudioLevel(new Float32Array(32).fill(1))).toBe(1)
  })
})

describe('即時逐字稿合併', () => {
  it('接受累積式逐字稿而不重複文字', () => {
    expect(mergeLiveTranscript('我想整', '我想整一份簡報')).toBe('我想整一份簡報')
  })

  it('合併分段逐字稿並補上空格', () => {
    expect(mergeLiveTranscript('Please prepare', 'a worksheet')).toBe(
      'Please prepare a worksheet',
    )
  })
})
