import { isSupabaseConfigured, supabase } from '../../../lib/supabase'
import type { VoiceLanguage } from './speech'

export type LiveVoiceStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error'

export type LiveTranscriptUpdate = {
  id: string
  role: 'user' | 'model'
  text: string
  final: boolean
}

export type LiveToolCall = {
  id: string
  name: string
  args: Record<string, unknown>
}

type LiveVoiceCallbacks = {
  onStatus: (status: LiveVoiceStatus) => void
  onInputLevel: (level: number) => void
  onTranscript: (update: LiveTranscriptUpdate) => void
  onToolCall: (call: LiveToolCall) => Promise<unknown>
  onError: (message: string, code?: string) => void
}

type LiveTokenResponse = {
  token: string
  setup: Record<string, unknown>
  apiVersion?: 'v1alpha' | 'v1beta'
}

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext
}

type LiveServerMessage = {
  setupComplete?: Record<string, never>
  serverContent?: {
    generationComplete?: boolean
    interrupted?: boolean
    turnComplete?: boolean
    inputTranscription?: { text?: string }
    outputTranscription?: { text?: string }
    modelTurn?: {
      parts?: Array<{
        inlineData?: { data?: string; mimeType?: string }
        inline_data?: { data?: string; mime_type?: string }
      }>
    }
  }
  toolCall?: {
    functionCalls?: Array<{
      id?: string
      name?: string
      args?: Record<string, unknown>
    }>
  }
}

const LIVE_SOCKET_BASE =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage'
const LIVE_INPUT_SAMPLE_RATE = 16_000
const MAX_SESSION_MS = 10 * 60 * 1000

export class LiveVoiceError extends Error {
  constructor(message: string, readonly code = 'unavailable') {
    super(message)
    this.name = 'LiveVoiceError'
  }
}

function audioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  const audioWindow = window as AudioWindow
  return window.AudioContext ?? audioWindow.webkitAudioContext ?? null
}

export function isLiveVoiceBrowserSupported(): boolean {
  return Boolean(
    isSupabaseConfigured &&
      typeof window !== 'undefined' &&
      typeof WebSocket !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      audioContextConstructor(),
  )
}

export function mergeLiveTranscript(current: string, incoming: string): string {
  const next = incoming.trim()
  if (!next) return current
  if (!current) return next
  if (next.startsWith(current)) return next
  if (current.endsWith(next)) return current
  const separator = /[\s，。！？,.!?]$/.test(current) || /^[，。！？,.!?]/.test(next) ? '' : ' '
  return `${current}${separator}${next}`
}

export function float32ToPcm16Base64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2)
  const view = new DataView(bytes.buffer)
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0))
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0)
  }
  return btoa(binary)
}

export function resampleFloat32(
  samples: Float32Array,
  inputSampleRate: number,
  outputSampleRate = LIVE_INPUT_SAMPLE_RATE,
): Float32Array {
  if (!samples.length || inputSampleRate <= 0 || outputSampleRate <= 0) {
    return new Float32Array()
  }
  if (inputSampleRate === outputSampleRate) return samples.slice()

  const ratio = inputSampleRate / outputSampleRate
  const outputLength = Math.max(1, Math.round(samples.length / ratio))
  const output = new Float32Array(outputLength)

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const start = Math.floor(outputIndex * ratio)
    const end = Math.min(samples.length, Math.max(start + 1, Math.floor((outputIndex + 1) * ratio)))
    let total = 0
    for (let inputIndex = start; inputIndex < end; inputIndex += 1) {
      total += samples[inputIndex] ?? 0
    }
    output[outputIndex] = total / Math.max(1, end - start)
  }

  return output
}

export function normalizedAudioLevel(samples: Float32Array): number {
  if (!samples.length) return 0
  let sum = 0
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index] ?? 0
    sum += sample * sample
  }
  const rms = Math.sqrt(sum / samples.length)
  return Math.min(1, Math.max(0, (rms - 0.008) * 8))
}

export function pcm16Base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  const view = new DataView(bytes.buffer)
  const output = new Float32Array(Math.floor(bytes.byteLength / 2))
  for (let index = 0; index < output.length; index += 1) {
    const sample = view.getInt16(index * 2, true)
    output[index] = sample < 0 ? sample / 0x8000 : sample / 0x7fff
  }
  return output
}

async function requestLiveToken(
  language: VoiceLanguage,
  context: string,
): Promise<LiveTokenResponse> {
  if (!supabase) throw new LiveVoiceError('自然語音暫時未連接。')
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new LiveVoiceError('登入後即可使用自然語音。', 'auth_required')

  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '')
  const response = await fetch(`${base}/functions/v1/gemini-live-token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ language, context: context.slice(0, 4_000) }),
  })
  const data = (await response.json().catch(() => null)) as
    | (LiveTokenResponse & { error?: string; code?: string })
    | null
  if (!response.ok || !data?.token || !data.setup) {
    throw new LiveVoiceError(
      data?.error || '自然語音暫時未能連接，請稍後再試。',
      data?.code || `http_${response.status}`,
    )
  }
  return data
}

class PcmAudioPlayer {
  private context: AudioContext | null = null
  private gain: GainNode | null = null
  private nextStartTime = 0
  private sources = new Set<AudioBufferSourceNode>()

  async start(): Promise<void> {
    const AudioContextClass = audioContextConstructor()
    if (!AudioContextClass) throw new LiveVoiceError('這部裝置暫時未能播放即時語音。')
    this.context = new AudioContextClass()
    this.gain = this.context.createGain()
    this.gain.connect(this.context.destination)
    await this.context.resume()
  }

  enqueue(base64: string, sampleRate = 24_000): void {
    if (!this.context || !this.gain || !base64) return
    const samples = pcm16Base64ToFloat32(base64)
    if (!samples.length) return
    const buffer = this.context.createBuffer(1, samples.length, sampleRate)
    buffer.getChannelData(0).set(samples)
    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.connect(this.gain)
    source.onended = () => this.sources.delete(source)
    const startAt = Math.max(this.context.currentTime + 0.035, this.nextStartTime)
    source.start(startAt)
    this.nextStartTime = startAt + buffer.duration
    this.sources.add(source)
  }

  setMuted(muted: boolean): void {
    if (this.gain) this.gain.gain.value = muted ? 0 : 1
  }

  clear(): void {
    this.sources.forEach((source) => {
      try {
        source.stop()
      } catch {
        /* already stopped */
      }
    })
    this.sources.clear()
    this.nextStartTime = this.context?.currentTime ?? 0
  }

  close(): void {
    this.clear()
    void this.context?.close()
    this.context = null
    this.gain = null
  }
}

export class GeminiLiveVoiceSession {
  private socket: WebSocket | null = null
  private stream: MediaStream | null = null
  private captureContext: AudioContext | null = null
  private captureSource: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private silentGain: GainNode | null = null
  private readonly player = new PcmAudioPlayer()
  private inputMuted = false
  private closedByUser = false
  private setupResolver: (() => void) | null = null
  private setupRejecter: ((error: Error) => void) | null = null
  private setupTimer: number | null = null
  private sessionTimer: number | null = null
  private transcriptTimer: number | null = null
  private lastInputLevelAt = 0
  private turnNumber = 1
  private userTranscript = ''
  private modelTranscript = ''

  constructor(private readonly callbacks: LiveVoiceCallbacks) {}

  private ensureSessionActive(): void {
    if (this.closedByUser) {
      throw new LiveVoiceError('自然語音已停止。', 'cancelled')
    }
  }

  async start(language: VoiceLanguage, context: string): Promise<void> {
    if (!isLiveVoiceBrowserSupported()) {
      throw new LiveVoiceError('這個瀏覽器暫時未能使用自然語音。')
    }
    this.closedByUser = false
    this.callbacks.onStatus('connecting')

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      this.ensureSessionActive()
      await this.player.start()
      this.ensureSessionActive()
      const { token, setup, apiVersion = 'v1alpha' } = await requestLiveToken(language, context)
      this.ensureSessionActive()
      await this.openSocket(token, setup, apiVersion)
      this.ensureSessionActive()
      await this.startCapture()
      this.callbacks.onStatus('listening')
      this.sessionTimer = window.setTimeout(() => {
        this.stop()
        this.callbacks.onError('這次自然對話已到時限，可立即重新開始。')
        this.callbacks.onStatus('error')
      }, MAX_SESSION_MS)
    } catch (error) {
      this.stop()
      throw error
    }
  }

  private openSocket(
    token: string,
    setup: Record<string, unknown>,
    apiVersion: 'v1alpha' | 'v1beta',
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setupResolver = resolve
      this.setupRejecter = reject
      const socketUrl = `${LIVE_SOCKET_BASE}.${apiVersion}.GenerativeService.BidiGenerateContentConstrained`
      const socket = new WebSocket(`${socketUrl}?access_token=${encodeURIComponent(token)}`)
      this.socket = socket
      socket.onopen = () => socket.send(JSON.stringify({ setup }))
      socket.onmessage = (event) => void this.handleMessage(event.data)
      socket.onerror = () => reject(new LiveVoiceError('即時語音暫時未能連接。', 'socket_error'))
      socket.onclose = (event) => {
        if (this.closedByUser) return
        const code = `socket_close_${event.code || 'unknown'}`
        const error = new LiveVoiceError('即時語音連線已中斷，可重新開始。', code)
        this.setupRejecter?.(error)
        this.stop()
        this.callbacks.onError(error.message, code)
        this.callbacks.onStatus('error')
      }
      this.setupTimer = window.setTimeout(
        () => reject(new LiveVoiceError('即時語音連接需時較長，請再試一次。', 'setup_timeout')),
        12_000,
      )
    })
  }

  private async startCapture(): Promise<void> {
    if (!this.stream || !this.socket) return
    const AudioContextClass = audioContextConstructor()
    if (!AudioContextClass) return
    this.captureContext = new AudioContextClass()
    this.captureSource = this.captureContext.createMediaStreamSource(this.stream)
    this.processor = this.captureContext.createScriptProcessor(2_048, 1, 1)
    this.silentGain = this.captureContext.createGain()
    this.silentGain.gain.value = 0
    this.processor.onaudioprocess = (event) => {
      const samples = event.inputBuffer.getChannelData(0)
      const now = performance.now()
      if (now - this.lastInputLevelAt >= 50) {
        this.callbacks.onInputLevel(this.inputMuted ? 0 : normalizedAudioLevel(samples))
        this.lastInputLevelAt = now
      }
      if (this.inputMuted || this.socket?.readyState !== WebSocket.OPEN) return
      if ((this.socket.bufferedAmount ?? 0) > 1_000_000) return
      const resampled = resampleFloat32(
        samples,
        this.captureContext?.sampleRate ?? 48_000,
        LIVE_INPUT_SAMPLE_RATE,
      )
      this.send({
        realtimeInput: {
          audio: {
            data: float32ToPcm16Base64(resampled),
            mimeType: `audio/pcm;rate=${LIVE_INPUT_SAMPLE_RATE}`,
          },
        },
      })
    }
    this.captureSource.connect(this.processor)
    this.processor.connect(this.silentGain)
    this.silentGain.connect(this.captureContext.destination)
    await this.captureContext.resume()
  }

  private async handleMessage(raw: unknown): Promise<void> {
    if (this.closedByUser) return
    const text = raw instanceof Blob ? await raw.text() : String(raw)
    let message: LiveServerMessage
    try {
      message = JSON.parse(text) as LiveServerMessage
    } catch {
      return
    }

    if (message.setupComplete) {
      if (this.setupTimer !== null) window.clearTimeout(this.setupTimer)
      this.setupTimer = null
      this.setupResolver?.()
      this.setupResolver = null
      this.setupRejecter = null
    }

    const content = message.serverContent
    if (content?.interrupted) {
      this.player.clear()
      this.finalizeTranscripts()
      this.callbacks.onStatus('listening')
    }
    if (content?.inputTranscription?.text) {
      this.userTranscript = mergeLiveTranscript(
        this.userTranscript,
        content.inputTranscription.text,
      )
      this.emitTranscript('user', false)
      this.callbacks.onStatus('thinking')
    }
    if (content?.modelTurn?.parts) {
      this.finalizeUserTranscript()
      for (const part of content.modelTurn.parts) {
        const data = part.inlineData?.data ?? part.inline_data?.data
        if (!data) continue
        const mimeType = part.inlineData?.mimeType ?? part.inline_data?.mime_type
        const sampleRate = Number(mimeType?.match(/rate=(\d+)/)?.[1] ?? 24_000)
        this.player.enqueue(data, sampleRate)
        this.callbacks.onStatus('speaking')
      }
    }
    if (content?.outputTranscription?.text) {
      this.finalizeUserTranscript()
      this.modelTranscript = mergeLiveTranscript(
        this.modelTranscript,
        content.outputTranscription.text,
      )
      this.emitTranscript('model', false)
      this.callbacks.onStatus('speaking')
    }
    if (message.toolCall?.functionCalls?.length) {
      this.finalizeUserTranscript()
      this.callbacks.onStatus('thinking')
      void this.handleToolCalls(message.toolCall.functionCalls)
    }
    if (content?.turnComplete) {
      if (this.transcriptTimer !== null) window.clearTimeout(this.transcriptTimer)
      this.transcriptTimer = window.setTimeout(() => {
        this.finalizeTranscripts()
        this.turnNumber += 1
        this.callbacks.onStatus('listening')
      }, 220)
    }
  }

  private async handleToolCalls(
    calls: NonNullable<NonNullable<LiveServerMessage['toolCall']>['functionCalls']>,
  ): Promise<void> {
    const functionResponses = await Promise.all(
      calls.map(async (call) => {
        const id = call.id ?? `tool-${Date.now()}`
        const name = call.name ?? 'unknown'
        let result: unknown
        try {
          result = await this.callbacks.onToolCall({ id, name, args: call.args ?? {} })
        } catch {
          result = { status: 'error', message: '未能準備這項工作。' }
        }
        return { id, name, response: { result } }
      }),
    )
    this.send({ toolResponse: { functionResponses } })
  }

  private emitTranscript(role: 'user' | 'model', final: boolean): void {
    const text = role === 'user' ? this.userTranscript : this.modelTranscript
    if (!text) return
    this.callbacks.onTranscript({
      id: `live-${role}-${this.turnNumber}`,
      role,
      text,
      final,
    })
  }

  private finalizeUserTranscript(): void {
    if (!this.userTranscript) return
    this.emitTranscript('user', true)
  }

  private finalizeTranscripts(): void {
    if (this.userTranscript) this.emitTranscript('user', true)
    if (this.modelTranscript) this.emitTranscript('model', true)
    this.userTranscript = ''
    this.modelTranscript = ''
  }

  private send(message: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message))
    }
  }

  sendText(text: string): boolean {
    if (!text.trim() || this.socket?.readyState !== WebSocket.OPEN) return false
    this.send({ realtimeInput: { text: text.trim() } })
    this.callbacks.onStatus('thinking')
    return true
  }

  setInputMuted(muted: boolean): void {
    this.inputMuted = muted
    if (muted) this.callbacks.onInputLevel(0)
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted
    })
    if (muted) this.send({ realtimeInput: { audioStreamEnd: true } })
  }

  setOutputMuted(muted: boolean): void {
    this.player.setMuted(muted)
  }

  stop(): void {
    this.closedByUser = true
    if (this.setupTimer !== null) window.clearTimeout(this.setupTimer)
    if (this.sessionTimer !== null) window.clearTimeout(this.sessionTimer)
    if (this.transcriptTimer !== null) window.clearTimeout(this.transcriptTimer)
    this.setupTimer = null
    this.sessionTimer = null
    this.transcriptTimer = null
    this.setupRejecter?.(new LiveVoiceError('自然語音已停止。', 'cancelled'))
    this.setupResolver = null
    this.setupRejecter = null
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.send({ realtimeInput: { audioStreamEnd: true } })
    }
    this.socket?.close()
    this.socket = null
    this.processor?.disconnect()
    this.captureSource?.disconnect()
    this.silentGain?.disconnect()
    this.processor = null
    this.captureSource = null
    this.silentGain = null
    void this.captureContext?.close()
    this.captureContext = null
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    this.player.close()
    this.callbacks.onInputLevel(0)
    this.callbacks.onStatus('idle')
  }
}
