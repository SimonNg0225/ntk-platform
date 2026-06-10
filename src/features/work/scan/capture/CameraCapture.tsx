import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, ImagePlus, X } from 'lucide-react'
import { Button, IconButton } from '../../../../ui'

export default function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (dataUrls: string[]) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [camErr, setCamErr] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((tk) => tk.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch {
        setCamErr(true)
      }
    }
    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((tk) => tk.stop())
    }
  }, [])

  function shoot() {
    const v = videoRef.current
    if (!v) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0)
    onCapture([c.toDataURL('image/jpeg', 0.95)])
  }

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    Promise.all(
      files.map(
        (f) =>
          new Promise<string>((res) => {
            const r = new FileReader()
            r.onload = () => res(r.result as string)
            r.readAsDataURL(f)
          }),
      ),
    ).then(onCapture)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-3 text-white">
        <span className="text-sm font-medium">
          {t('scan.captureTitle', { defaultValue: '影低文件' })}
        </span>
        <IconButton label={t('scan.close', { defaultValue: '關閉' })} onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      <div className="relative flex-1 overflow-hidden">
        {camErr ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-white/80">
            <Camera size={40} className="opacity-50" />
            <p className="text-sm">
              {t('scan.noCamera', { defaultValue: '開唔到鏡頭，可以改為上載相片。' })}
            </p>
          </div>
        ) : (
          <video ref={videoRef} playsInline muted className="h-full w-full object-contain" />
        )}
      </div>
      <div className="flex items-center justify-center gap-6 p-5">
        <Button
          variant="ghost"
          icon={ImagePlus}
          onClick={() => fileRef.current?.click()}
          className="text-white"
        >
          {t('scan.upload', { defaultValue: '上載相片' })}
        </Button>
        {!camErr && (
          <button
            type="button"
            onClick={shoot}
            aria-label={t('scan.shoot', { defaultValue: '影相' })}
            className="h-16 w-16 rounded-full border-4 border-white bg-white/20 active:scale-95"
          />
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          onChange={onFiles}
        />
      </div>
    </div>
  )
}
