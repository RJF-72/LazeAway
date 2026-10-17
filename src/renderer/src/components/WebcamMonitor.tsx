import { useCallback, useEffect, useRef, useState } from 'react'
import { useLaser } from '../hooks/useLaser'
import { Btn, Panel } from './ui'

const BED_W = 150
const BED_H = 200

export function WebcamMonitor() {
  const { status, progress } = useLaser()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [recording, setRecording] = useState(false)
  const [recSecs, setRecSecs] = useState(0)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setEnabled(false)
  }, [])

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop()
      }
      stopStream()
    }
  }, [stopStream])

  // Recording timer
  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => setRecSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [recording])

  const enable = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setEnabled(true)
    } catch (e) {
      setError((e as Error).message || 'Could not access webcam')
    }
  }

  const snapshot = () => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`
    ctx.save()
    ctx.translate(flipH ? canvas.width : 0, flipV ? canvas.height : 0)
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
    // Draw the bed overlay too so the snapshot is useful for records.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    ctx.restore()
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `artilume-snapshot-${Date.now()}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    }, 'image/png')
  }

  const startRecording = () => {
    const stream = streamRef.current
    if (!stream) return
    chunksRef.current = []
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm'
    const rec = new MediaRecorder(stream, { mimeType: mime })
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `artilume-job-${Date.now()}.webm`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      setRecording(false)
    }
    rec.start(1000)
    recorderRef.current = rec
    setRecSecs(0)
    setRecording(true)
  }

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }

  const togglePip = async () => {
    const video = videoRef.current
    if (!video) return
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else {
        await video.requestPictureInPicture()
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const mpos = status?.mpos ?? { x: 0, y: 0, z: 0 }
  // Rough mapping: assume the webcam frames the whole bed. x:[-75,75]->[0,100]%,
  // y up:[-100,100]->[100,0]%.
  const dotLeft = ((mpos.x + BED_W / 2) / BED_W) * 100
  const dotTop = ((BED_H / 2 - mpos.y) / BED_H) * 100

  const filter = `brightness(${brightness}%) contrast(${contrast}%)`
  const transform = `scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`

  const mm = String(Math.floor(recSecs / 60)).padStart(2, '0')
  const ss = String(recSecs % 60).padStart(2, '0')

  return (
    <Panel
      title="Webcam Monitor (external USB)"
      right={
        <span className="text-[10px] text-[#6b7280]">{enabled ? 'LIVE' : 'off'}</span>
      }
    >
      <div className="flex flex-col gap-2">
        <div className="relative w-full bg-black rounded-lg overflow-hidden border border-[#2c2c2c] aspect-video">
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ filter, transform }}
          />

          {/* overlay: crosshair + laser position */}
          {enabled && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#ff6b35]/40" />
              <div className="absolute top-1/2 left-0 right-0 h-px bg-[#ff6b35]/40" />
              <div
                className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-[#ff3b30] bg-[#ff3b30]/30"
                style={{ left: `${dotLeft}%`, top: `${dotTop}%` }}
                title={`MPos ${mpos.x.toFixed(1)}, ${mpos.y.toFixed(1)}`}
              />
              {recording && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-black/70">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 live-dot" />
                  <span className="text-[11px] font-mono text-white">
                    REC {mm}:{ss}
                  </span>
                </div>
              )}
            </div>
          )}

          {!enabled && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
              <span className="text-[#6b7280] text-sm">No webcam feed</span>
              <span className="text-[10px] text-[#4b5563]">
                This laser has NO built-in camera. Use any USB webcam.
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="text-[11px] text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/40 rounded px-2 py-1">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!enabled ? (
            <Btn variant="accent" size="sm" onClick={() => void enable()}>
              Enable Webcam
            </Btn>
          ) : (
            <Btn variant="ghost" size="sm" onClick={stopStream}>
              Disable
            </Btn>
          )}
          <Btn size="sm" disabled={!enabled} onClick={snapshot}>
            Snapshot PNG
          </Btn>
          <Btn
            size="sm"
            variant={recording ? 'danger' : 'default'}
            disabled={!enabled}
            onClick={() => (recording ? stopRecording() : startRecording())}
          >
            {recording ? `Stop Rec ${mm}:${ss}` : 'Record Video'}
          </Btn>
          <Btn size="sm" disabled={!enabled} onClick={() => void togglePip()}>
            PiP
          </Btn>
        </div>

        {/* flip + imaging controls */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex gap-2">
            <Btn
              size="sm"
              variant={flipH ? 'gantry' : 'ghost'}
              className="flex-1"
              onClick={() => setFlipH((v) => !v)}
            >
              Flip H
            </Btn>
            <Btn
              size="sm"
              variant={flipV ? 'gantry' : 'ghost'}
              className="flex-1"
              onClick={() => setFlipV((v) => !v)}
            >
              Flip V
            </Btn>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#9ca3af] flex justify-between">
              <span>Brightness {brightness}%</span>
            </label>
            <input
              type="range"
              min={20}
              max={250}
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#9ca3af]">Contrast {contrast}%</label>
          <input
            type="range"
            min={20}
            max={250}
            value={contrast}
            onChange={(e) => setContrast(Number(e.target.value))}
          />
        </div>

        {progress?.running && !recording && (
          <div className="text-[10px] text-[#eab308]">
            Job running — record video to capture the cut.
          </div>
        )}

        <div className="rounded-lg bg-[#161616] border border-[#3a3a3a] p-3 text-[11px] leading-relaxed text-[#c9c9c9]">
          <p className="font-semibold text-[#9ca3af] mb-1">Camera mounting</p>
          <ul className="list-disc pl-4 space-y-0.5 text-[#9ca3af]">
            <li>Mount 12–18 inches above the bed</li>
            <li>OFF the laser frame — vibration ruins the shot</li>
            <li>~15° angle from the front</li>
            <li>Opposite the shield hinge so it sees the cut point</li>
            <li>Laser dot is an <b>approximate</b> overlay (no calibration)</li>
          </ul>
        </div>
      </div>
    </Panel>
  )
}
