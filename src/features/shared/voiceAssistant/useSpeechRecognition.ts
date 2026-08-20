import { useCallback, useEffect, useRef, useState } from 'react'
import {
  speechRecognitionConstructor,
  speechRecognitionErrorMessage,
  type BrowserSpeechRecognition,
  type VoiceLanguage,
} from './speech'

type TranscriptUpdate = {
  finalText: string
  interimText: string
  combinedText: string
}

export function useSpeechRecognition({
  language,
  onTranscript,
  onError,
}: {
  language: VoiceLanguage
  onTranscript: (update: TranscriptUpdate) => void
  onError: (message: string) => void
}) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const transcriptHandlerRef = useRef(onTranscript)
  const errorHandlerRef = useRef(onError)
  const [listening, setListening] = useState(false)
  const supported = Boolean(speechRecognitionConstructor())

  useEffect(() => {
    transcriptHandlerRef.current = onTranscript
  }, [onTranscript])

  useEffect(() => {
    errorHandlerRef.current = onError
  }, [onError])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const abort = useCallback(() => {
    recognitionRef.current?.abort()
    recognitionRef.current = null
    setListening(false)
  }, [])

  const start = useCallback(() => {
    const Recognition = speechRecognitionConstructor()
    if (!Recognition) {
      errorHandlerRef.current('此瀏覽器未提供即時語音辨識，仍可直接輸入文字。')
      return false
    }

    recognitionRef.current?.abort()
    const recognition = new Recognition()
    recognitionRef.current = recognition
    recognition.lang = language
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.onstart = () => setListening(true)
    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index]
        const text = result?.[0]?.transcript?.trim() ?? ''
        if (!text) continue
        if (result.isFinal) finalText += `${text} `
        else interimText += `${text} `
      }
      const finalValue = finalText.trim()
      const interimValue = interimText.trim()
      transcriptHandlerRef.current({
        finalText: finalValue,
        interimText: interimValue,
        combinedText: [finalValue, interimValue].filter(Boolean).join(' '),
      })
    }
    recognition.onerror = (event) => {
      const message = speechRecognitionErrorMessage(event.error)
      if (message) errorHandlerRef.current(message)
    }
    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    try {
      recognition.start()
      return true
    } catch {
      recognitionRef.current = null
      setListening(false)
      errorHandlerRef.current('未能啟動咪高峰，請稍後再試。')
      return false
    }
  }, [language])

  useEffect(() => abort, [abort])

  return { supported, listening, start, stop, abort }
}
