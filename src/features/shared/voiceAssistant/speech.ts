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

export function speakText(
  input: string,
  language: VoiceLanguage,
  handlers: { onStart?: () => void; onEnd?: () => void } = {},
): boolean {
  if (
    typeof window === 'undefined' ||
    !('speechSynthesis' in window) ||
    typeof SpeechSynthesisUtterance === 'undefined'
  ) {
    return false
  }

  const text = plainTextForSpeech(input)
  if (!text) return false

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = language
  utterance.rate = language === 'en-HK' ? 1 : 0.96
  const voices = window.speechSynthesis.getVoices()
  const exactVoice = voices.find((voice) => voice.lang.toLowerCase() === language.toLowerCase())
  const languageRoot = language.split('-')[0].toLowerCase()
  utterance.voice =
    exactVoice ?? voices.find((voice) => voice.lang.toLowerCase().startsWith(languageRoot)) ?? null
  utterance.onstart = () => handlers.onStart?.()
  utterance.onend = () => handlers.onEnd?.()
  utterance.onerror = () => handlers.onEnd?.()
  window.speechSynthesis.speak(utterance)
  return true
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}
