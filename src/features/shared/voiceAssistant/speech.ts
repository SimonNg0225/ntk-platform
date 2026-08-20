export type VoiceLanguage = 'zh-HK' | 'zh-CN' | 'en-HK'

export const VOICE_LANGUAGES: readonly {
  id: VoiceLanguage
  label: string
  speechLabel: string
}[] = [
  { id: 'zh-HK', label: '廣東話', speechLabel: '廣東話' },
  { id: 'zh-CN', label: '普通話', speechLabel: '普通話' },
  { id: 'en-HK', label: 'English', speechLabel: 'English' },
]

export type SpeechRecognitionResultEvent = Event & {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0?: { transcript?: string }
  }>
}

export type SpeechRecognitionErrorEvent = Event & {
  error?: string
}

export interface BrowserSpeechRecognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: ((event: Event) => void) | null
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: ((event: Event) => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

export function speechRecognitionConstructor(
  target: Window | undefined = typeof window === 'undefined' ? undefined : window,
): SpeechRecognitionConstructor | null {
  if (!target) return null
  const speechWindow = target as SpeechWindow
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return Boolean(speechRecognitionConstructor())
}

export function speechRecognitionErrorMessage(code?: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '未能使用咪高峰。請在瀏覽器設定允許咪高峰權限。'
    case 'audio-capture':
      return '找不到可用的咪高峰，請檢查裝置連接。'
    case 'network':
      return '語音辨識服務暫時連接不到，請稍後再試或直接輸入文字。'
    case 'no-speech':
      return '未聽到清楚語音，請靠近咪高峰再試。'
    case 'aborted':
      return ''
    default:
      return '暫時未能辨識語音，請再試或直接輸入文字。'
  }
}

export function plainTextForSpeech(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, ' 程式碼內容已略過。 ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/[*_~>#|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const NATURAL_VOICE_HINTS = [
  'premium',
  'enhanced',
  'natural',
  'neural',
  'siri',
  'google',
  'sin-ji',
  'ting-ting',
  'mei-jia',
]

export function speechVoiceScore(voice: Pick<SpeechSynthesisVoice, 'default' | 'lang' | 'localService' | 'name'>, language: VoiceLanguage): number {
  const voiceLanguage = voice.lang.toLowerCase()
  const targetLanguage = language.toLowerCase()
  const languageRoot = targetLanguage.split('-')[0]
  let score = 0

  if (voiceLanguage === targetLanguage) score += 100
  else if (voiceLanguage.startsWith(`${languageRoot}-`)) score += 45
  else return -1

  const voiceName = voice.name.toLowerCase()
  if (NATURAL_VOICE_HINTS.some((hint) => voiceName.includes(hint))) score += 24
  if (voice.localService) score += 5
  if (voice.default) score += 2
  return score
}

export function selectSpeechVoice(
  voices: SpeechSynthesisVoice[],
  language: VoiceLanguage,
): SpeechSynthesisVoice | null {
  return (
    voices
      .map((voice, index) => ({ voice, index, score: speechVoiceScore(voice, language) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.voice ?? null
  )
}

export type SpeechQueue = {
  push: (text: string) => void
  finish: () => void
  cancel: () => void
}

let activeSpeechCancel: (() => void) | null = null

function takeSpeakableSentence(buffer: string, flush: boolean): [string, string] | null {
  const sentenceEnd = buffer.search(/[。！？!?；;\n]/)
  if (sentenceEnd >= 0) {
    return [buffer.slice(0, sentenceEnd + 1), buffer.slice(sentenceEnd + 1)]
  }
  if (buffer.length >= 90) {
    const clauseEnd = Math.max(buffer.lastIndexOf('，'), buffer.lastIndexOf(','))
    if (clauseEnd >= 35) return [buffer.slice(0, clauseEnd + 1), buffer.slice(clauseEnd + 1)]
  }
  if (flush && buffer.trim()) return [buffer, '']
  return null
}

export function createSpeechQueue(
  language: VoiceLanguage,
  handlers: { onStart?: () => void; onEnd?: () => void } = {},
): SpeechQueue | null {
  if (
    typeof window === 'undefined' ||
    !('speechSynthesis' in window) ||
    typeof SpeechSynthesisUtterance === 'undefined'
  ) {
    return null
  }

  activeSpeechCancel?.()
  window.speechSynthesis.cancel()

  let buffer = ''
  let queue: string[] = []
  let active = false
  let finished = false
  let cancelled = false
  let started = false
  let ended = false

  const complete = () => {
    if (ended || cancelled || active || queue.length > 0 || !finished) return
    ended = true
    activeSpeechCancel = null
    handlers.onEnd?.()
  }

  const pump = () => {
    if (cancelled || active) return
    const text = queue.shift()
    if (!text) {
      complete()
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = language
    utterance.rate = language === 'en-HK' ? 1.02 : 0.98
    utterance.pitch = 1
    utterance.voice = selectSpeechVoice(window.speechSynthesis.getVoices(), language)
    utterance.onstart = () => {
      if (!started) {
        started = true
        handlers.onStart?.()
      }
    }
    const advance = () => {
      if (cancelled) return
      active = false
      pump()
    }
    utterance.onend = advance
    utterance.onerror = advance
    active = true
    window.speechSynthesis.speak(utterance)
  }

  const drain = (flush: boolean) => {
    let next = takeSpeakableSentence(buffer, flush)
    while (next) {
      const [sentence, remainder] = next
      const cleaned = plainTextForSpeech(sentence)
      if (cleaned) queue.push(cleaned)
      buffer = remainder
      next = takeSpeakableSentence(buffer, flush)
    }
    pump()
  }

  const cancel = () => {
    if (cancelled) return
    cancelled = true
    queue = []
    buffer = ''
    activeSpeechCancel = null
    window.speechSynthesis.cancel()
  }
  activeSpeechCancel = cancel

  return {
    push(text) {
      if (cancelled || finished || !text) return
      buffer += text
      drain(false)
    },
    finish() {
      if (cancelled || finished) return
      finished = true
      drain(true)
      complete()
    },
    cancel,
  }
}

export function speakText(
  input: string,
  language: VoiceLanguage,
  handlers: { onStart?: () => void; onEnd?: () => void } = {},
): boolean {
  const text = plainTextForSpeech(input)
  if (!text) return false
  const queue = createSpeechQueue(language, handlers)
  if (!queue) return false
  queue.push(text)
  queue.finish()
  return true
}

export function stopSpeaking(): void {
  activeSpeechCancel?.()
  activeSpeechCancel = null
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}
