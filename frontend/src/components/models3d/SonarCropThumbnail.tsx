import { useEffect, useRef, useState } from 'react'
import { getSonarFileImageObjectUrl } from '@/api/uploads'
import type { BBox } from '@/api/types'
import { ImageOff } from 'lucide-react'

/** Crops the real uploaded sonar image to one detection's bounding box - an actual pixel crop of
 * this instance's own data, not a stock or generated image. */
export function SonarCropThumbnail({ sonarFileId, bbox, className }: { sonarFileId: string; bbox: BBox; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    setFailed(false)

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
        img.onerror = () => !cancelled && setFailed(true)
        img.src = url
      })
      .catch(() => !cancelled && setFailed(true))

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [sonarFileId, bbox.x, bbox.y, bbox.w, bbox.h])

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-black text-muted-foreground ${className ?? ''}`}>
        <ImageOff className="h-5 w-5" />
      </div>
    )
  }

  return <canvas ref={canvasRef} width={160} height={160} className={className} />
}
