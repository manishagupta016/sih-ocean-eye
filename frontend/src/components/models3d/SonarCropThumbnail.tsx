import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getSonarFileImageObjectUrl } from '@/api/uploads'
import type { BBox } from '@/api/types'

export interface CropCandidate {
  sonarFileId: string
  bbox: BBox
}

/** Crops the real uploaded sonar image to one detection's bounding box - an actual pixel crop of
 * this instance's own data, not a stock or generated image. Some older demo/seed rows reference a
 * sonar file whose backing image was never retained on disk, so this tries each ranked candidate
 * in turn (highest confidence first) and only gives up once every one of them has failed to load. */
export function SonarCropThumbnail({
  candidates,
  className,
  fallback,
}: {
  candidates: CropCandidate[]
  className?: string
  fallback: ReactNode
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [attempt, setAttempt] = useState(0)
  const [exhausted, setExhausted] = useState(false)

  useEffect(() => {
    setAttempt(0)
    setExhausted(false)
  }, [candidates])

  useEffect(() => {
    if (exhausted || attempt >= candidates.length) {
      if (attempt >= candidates.length && candidates.length > 0) setExhausted(true)
      return
    }
    const { sonarFileId, bbox } = candidates[attempt]
    let cancelled = false
    let objectUrl: string | null = null

    getSonarFileImageObjectUrl(sonarFileId)
      .then((url) => {
        if (cancelled) return
        objectUrl = url
        const img = new Image()
        img.onload = () => {
          if (cancelled) return
          const canvas = canvasRef.current
          const ctx = canvas?.getContext('2d')
          if (!canvas || !ctx) return
          ctx.imageSmoothingEnabled = true
          const pad = Math.round(Math.max(bbox.w, bbox.h) * 0.15)
          const sx = Math.max(0, bbox.x - pad)
          const sy = Math.max(0, bbox.y - pad)
          const sw = Math.min(img.naturalWidth - sx, bbox.w + pad * 2)
          const sh = Math.min(img.naturalHeight - sy, bbox.h + pad * 2)
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
        }
        img.onerror = () => !cancelled && setAttempt((a) => a + 1)
        img.src = url
      })
      .catch(() => !cancelled && setAttempt((a) => a + 1))

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attempt, exhausted, candidates])

  if (candidates.length === 0 || exhausted) return <>{fallback}</>

  return <canvas ref={canvasRef} width={160} height={160} className={className} />
}
