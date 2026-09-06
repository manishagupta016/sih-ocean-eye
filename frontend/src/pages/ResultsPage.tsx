import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ImageOff, MapPin, ShieldOff, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { listDetections } from '@/api/detections'
import { getSonarFile, getSonarFileImageObjectUrl } from '@/api/uploads'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { ConfidenceBar } from '@/components/common/ConfidenceBar'
import { RiskTierBadge } from '@/components/common/RiskTierBadge'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { RISK_TIER_COLOR_VAR, classLabelToTitle } from '@/lib/format'
import { summarizeDetections } from '@/lib/summarize'

export function ResultsPage() {
  const { sonarFileId } = useParams<{ sonarFileId: string }>()
  const [threshold, setThreshold] = useState(0.25)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const sonarFileQuery = useQuery({
    queryKey: ['sonar-file', sonarFileId],
    queryFn: () => getSonarFile(sonarFileId!),
    enabled: !!sonarFileId,
  })

  const detectionsQuery = useQuery({
    queryKey: ['detections', { sonar_file_id: sonarFileId }],
    queryFn: () => listDetections({ sonar_file_id: sonarFileId }),
    enabled: !!sonarFileId,
  })

  useEffect(() => {
    if (!sonarFileId) return
    let objectUrl: string | null = null
    setImageError(false)
    getSonarFileImageObjectUrl(sonarFileId)
      .then((url) => {
        objectUrl = url
        setImageUrl(url)
      })
      .catch(() => setImageError(true))
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [sonarFileId])

  const allDetections = detectionsQuery.data ?? []
  const filtered = allDetections.filter((d) => d.calibrated_confidence >= threshold)
  const artificialCount = filtered.filter((d) => d.is_artificial).length
  const summary = summarizeDetections(filtered, Math.round(threshold * 100))

  return (
    <AppShell>
      <PageHeader
        title="AI Analysis Results"
        description={sonarFileQuery.data ? sonarFileQuery.data.file_path.split('/').pop() : 'Loading survey line…'}
      />

      {sonarFileQuery.data?.model_is_fallback && (
        <Card className="mb-4 border-warning/40 bg-warning/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-medium text-foreground">Demo detector, not a trained model</p>
              <p className="text-sm text-muted">
                No fine-tuned sonar-specific model was available, so this result came from a simple
                fallback that just looks for bright/dark shapes in the image - it hasn't learned what a
                shipwreck, pipe, or rock actually looks like. Treat the labels below as placeholders for
                where a trained model's output would appear, not as a real reading of this image.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {sonarFileQuery.data?.model_name === 'oceaneye-crop-classifier' && (
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardContent className="flex items-start gap-3 p-4">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Real trained classifier, heuristic localization</p>
              <p className="text-sm text-muted">
                What each box <em>is</em> comes from a real model trained on real side-scan sonar
                crops (76.4% held-out accuracy across 5 classes, evaluated on crops proposed the
                same way this pipeline proposes them, not on clean whole images). Where the boxes
                are drawn still comes from a simple bright/dark-shape heuristic, since no
                bounding-box ground truth exists yet to train real object localization - so a
                box's position/size is approximate even when its label is trustworthy.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {detectionsQuery.data && (
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardContent className="flex items-start gap-3 p-4">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="mb-1 text-sm font-medium text-foreground">What's in this image</p>
              <p className="text-sm leading-relaxed text-muted">{summary}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="relative w-full overflow-hidden rounded-md border border-border bg-black">
              {imageError && (
                <div className="flex h-72 flex-col items-center justify-center gap-2 text-muted">
                  <ImageOff className="h-6 w-6" />
                  <p className="text-sm">No viewable raster image for this file format.</p>
                </div>
              )}
              {!imageError && imageUrl && (
                <div className="relative" style={naturalSize ? { aspectRatio: `${naturalSize.w} / ${naturalSize.h}` } : undefined}>
                  <img
                    src={imageUrl}
                    alt="Side-scan sonar survey line"
                    className="block w-full"
                    onLoad={(e) =>
                      setNaturalSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
                    }
                  />
                  {naturalSize &&
                    filtered.map((d) => {
                      const tier = d.risk_score?.risk_tier ?? 'human_review'
                      const isSelected = selectedId === d.id
                      return (
                        <div
                          key={d.id}
                          onMouseEnter={() => setSelectedId(d.id)}
                          className="absolute border-2 transition-[outline]"
                          style={{
                            left: `${(d.bbox.x / naturalSize.w) * 100}%`,
                            top: `${(d.bbox.y / naturalSize.h) * 100}%`,
                            width: `${(d.bbox.w / naturalSize.w) * 100}%`,
                            height: `${(d.bbox.h / naturalSize.h) * 100}%`,
                            borderColor: RISK_TIER_COLOR_VAR[tier],
                            outline: isSelected ? `2px solid ${RISK_TIER_COLOR_VAR[tier]}` : undefined,
                            outlineOffset: 2,
                          }}
                        >
                          <span
                            className="absolute -top-5 left-0 whitespace-nowrap rounded-t px-1 py-0.5 text-[10px] font-medium text-black"
                            style={{ backgroundColor: RISK_TIER_COLOR_VAR[tier] }}
                          >
                            {classLabelToTitle(d.class_label)} · {Math.round(d.calibrated_confidence * 100)}%
                          </span>
                        </div>
                      )
                    })}
                </div>
              )}
              {!imageError && !imageUrl && <LoadingState label="Loading imagery…" />}
            </div>

            <div className="mt-4 rounded-md border border-border p-3">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Calibrated confidence threshold</span>
                <span className="tabular-nums text-muted">{Math.round(threshold * 100)}%</span>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[threshold]}
                onValueChange={([v]) => setThreshold(v)}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Showing {filtered.length} of {allDetections.length} detections ({artificialCount} flagged artificial) at
                or above this calibrated confidence - filtering happens instantly, client-side.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="max-h-[calc(100vh-13rem)] overflow-y-auto scrollbar-thin p-4">
            <p className="mb-3 text-sm font-semibold text-foreground">Detections ({filtered.length})</p>
            {detectionsQuery.isLoading && <LoadingState label="Loading detections…" />}
            {detectionsQuery.isError && <ErrorState onRetry={() => detectionsQuery.refetch()} />}
            {detectionsQuery.data && filtered.length === 0 && (
              <EmptyState
                icon={<ShieldOff className="h-6 w-6 text-muted" />}
                title="No detections at this threshold"
                description="Lower the confidence threshold to see more candidate detections."
              />
            )}
            <div className="space-y-2">
              {filtered.map((d) => (
                <div
                  key={d.id}
                  onMouseEnter={() => setSelectedId(d.id)}
                  className={`cursor-default rounded-md border p-2.5 transition-colors ${
                    selectedId === d.id ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{classLabelToTitle(d.class_label)}</span>
                    {d.risk_score && <RiskTierBadge tier={d.risk_score.risk_tier} />}
                  </div>
                  <div className="mb-1.5 flex items-center gap-2">
                    <Badge variant={d.is_artificial ? 'danger' : 'secondary'}>
                      {d.is_artificial ? 'Artificial' : 'Natural'} · {Math.round(d.artificial_score * 100)}%
                    </Badge>
                    {d.has_geo_metadata ? (
                      <Badge variant="outline">
                        <MapPin className="h-3 w-3" /> Geolocated
                      </Badge>
                    ) : (
                      <Badge variant="outline">Image-space only</Badge>
                    )}
                  </div>
                  <ConfidenceBar value={d.calibrated_confidence} label={`Calibrated ${Math.round(d.calibrated_confidence * 100)}%`} />
                  <p className="mt-1 text-xs text-muted-foreground">Raw confidence {Math.round(d.raw_confidence * 100)}%</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
