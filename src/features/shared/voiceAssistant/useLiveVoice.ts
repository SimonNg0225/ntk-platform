import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GeminiLiveVoiceSession,
  LiveVoiceError,
  isLiveVoiceBrowserSupported,
  type LiveToolCall,
  type LiveTranscriptUpdate,
  type LiveVoiceStatus,
} from './liveVoice'
import type { VoiceLanguage } from './speech'

export function useLiveVoice({
  onTranscript,
  onToolCall,
  onError,
}: {
  onTranscript: (update: LiveTranscriptUpdate) => void
  onToolCall: (call: LiveToolCall) => Promise<unknown>
  onError: (message: string, code?: string) => void
}) {
  const [status, setStatus] = useState<LiveVoiceStatus>('idle')
  const [inputMuted, setInputMutedState] = useState(false)
  const [inputLevel, setInputLevel] = useState(0)
  const sessionRef = useRef<GeminiLiveVoiceSession | null>(null)
  const transcriptHandlerRef = useRef(onTranscript)
  const toolHandlerRef = useRef(onToolCall)
  const errorHandlerRef = useRef(onError)

  useEffect(() => {
    transcriptHandlerRef.current = onTranscript
  }, [onTranscript])
  useEffect(() => {
    toolHandlerRef.current = onToolCall
  }, [onToolCall])
  useEffect(() => {
    errorHandlerRef.current = onError
  }, [onError])

  const stop = useCallback(() => {
    sessionRef.current?.stop()
    sessionRef.current = null
    setStatus('idle')
    setInputMutedState(false)
    setInputLevel(0)
  }, [])

  const start = useCallback(async (language: VoiceLanguage, context: string) => {
    stop()
    const session = new GeminiLiveVoiceSession({
      onStatus: setStatus,
      onInputLevel: setInputLevel,
      onTranscript: (update) => transcriptHandlerRef.current(update),
      onToolCall: (call) => toolHandlerRef.current(call),
      onError: (message, code) => errorHandlerRef.current(message, code),
    })
    sessionRef.current = session
    try {
      await session.start(language, context)
    } catch (error) {
      if (sessionRef.current === session) {
        sessionRef.current = null
        setStatus(error instanceof LiveVoiceError && error.code === 'cancelled' ? 'idle' : 'error')
      }
      throw error
    }
  }, [stop])

  const setInputMuted = useCallback((muted: boolean) => {
    sessionRef.current?.setInputMuted(muted)
    setInputMutedState(muted)
  }, [])

  const setOutputMuted = useCallback((muted: boolean) => {
    sessionRef.current?.setOutputMuted(muted)
  }, [])

  const sendText = useCallback((text: string) => sessionRef.current?.sendText(text) ?? false, [])

  useEffect(() => stop, [stop])

  return {
    supported: isLiveVoiceBrowserSupported(),
    status,
    active: status !== 'idle' && status !== 'error',
    inputMuted,
    inputLevel,
    start,
    stop,
    sendText,
    setInputMuted,
    setOutputMuted,
  }
}
