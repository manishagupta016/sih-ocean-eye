import { useQuery } from '@tanstack/react-query'
import { BookOpen, MapPin, MapPinOff, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listDetections } from '@/api/detections'
import type { DetectionWithContext, RiskTier } from '@/api/types'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { RiskTierBadge } from '@/components/common/RiskTierBadge'
import { ObjectIdentificationDialog } from '@/components/detection/ObjectIdentificationDialog'
import { ObjectMesh3D } from '@/components/models3d/ObjectMesh3D'
import { SonarCropThumbnail } from '@/components/models3d/SonarCropThumbnail'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingState } from '@/components/common/StateViews'
import { CLASS_ARCHETYPE, detectionDifficulty } from '@/data/modelArchetypes'
import { IDENTIFICATION_CLASSES, type IdentificationClass } from '@/data/identificationGuide'
import { classLabelToTitle } from '@/lib/format'

const RISK_TIER_HEX: Record<RiskTier, string> = {
  ignore: '#64748b',
  human_review: '#fbbf24',
  probable_debris: '#fb923c',
  high_confidence_hazard: '#f87171',
}
const NEUTRAL_HEX = '#1ebdf5'

interface ClassModelData {
  entry: IdentificationClass
  best: DetectionWithContext | undefined
  aspectRatio: number
  scaleM: number
  roundness: number
  shadowLengthNorm: number | null
  lengthM: number | null
  widthM: number | null
  color: string
}

function buildModelData(entry: IdentificationClass, bestByLabel: Map<string, DetectionWithContext>): ClassModelData {
  const best = entry.matchesLabels.map((l) => bestByLabel.get(l)).find((d) => d !== undefined)

  if (!best) {
    return {
      entry,
      best: undefined,
      aspectRatio: 0.55,
      scaleM: 1.6,
      roundness: 0.5,
      shadowLengthNorm: null,
      lengthM: null,
      widthM: null,
      color: NEUTRAL_HEX,
    }
  }

  const longSide = Math.max(best.bbox.w, best.bbox.h)
  const shortSide = Math.min(best.bbox.w, best.bbox.h)
  const aspectRatio = longSide > 0 ? shortSide / longSide : 0.55
  const sizeM2 = best.risk_score?.size_estimate ?? 1
  const scaleM = Math.max(0.6, Math.sqrt(sizeM2) * 2)

  return {
    entry,
    best,
    aspectRatio,
    scaleM,
    roundness: best.shape_regularity ?? 0.5,
    shadowLengthNorm: best.shadow_length_px,
    lengthM: scaleM,
    widthM: scaleM * aspectRatio,
    color: best.risk_score ? RISK_TIER_HEX[best.risk_score.risk_tier] : NEUTRAL_HEX,
  }
}

export function ModelsPage() {
  const detectionsQuery = useQuery({ queryKey: ['detections', 'all'], queryFn: () => listDetections({}) })
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const [identifiedDetection, setIdentifiedDetection] = useState<DetectionWithContext | null>(null)

  const bestByLabel = useMemo(() => {
    const map = new Map<string, DetectionWithContext>()
    for (const d of detectionsQuery.data ?? []) {
      const existing = map.get(d.class_label)
      if (!existing || d.calibrated_confidence > existing.calibrated_confidence) map.set(d.class_label, d)
    }
    return map
  }, [detectionsQuery.data])

  const models = useMemo(
    () => IDENTIFICATION_CLASSES.map((entry) => buildModelData(entry, bestByLabel)),
    [bestByLabel],
  )

  const detectedCount = models.filter((m) => m.best).length
  const openModel = models.find((m) => m.entry.slug === openSlug) ?? null

  return (
    <AppShell>
      <PageHeader
        title="3D Models"
        description="Side-scan sonar to schematic 3D reconstruction, per object class - dataset-driven, not a photogrammetric scan."
      />

      <Card className="mb-4 border-primary/30 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Dataset-driven reconstruction, not a real 3D scan</p>
            <p className="text-muted">
              Each object below is a schematic solid: footprint length/width and surface roundness come from that
              detection's real bounding box, size estimate, and shape-regularity score. Height is an illustrative
              proportion only - this pipeline has no vertical/relief sensor. {detectedCount} of {IDENTIFICATION_CLASSES.length}{' '}
              reference classes currently have at least one real detection to draw from; the rest show a generic
              placeholder silhouette until this instance detects one.
            </p>
          </div>
        </CardContent>
      </Card>

      {detectionsQuery.isLoading && <LoadingState label="Loading detections…" />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {models.map((m, idx) => (
          <Card key={m.entry.slug} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-3 pt-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                    {idx + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">{m.entry.name}</h3>
                </div>
                <Badge variant={m.entry.category === 'artificial' ? 'danger' : 'secondary'}>
                  {m.entry.category === 'artificial' ? 'Man-made' : 'Natural'}
                </Badge>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-px bg-border">
                <div className="relative h-[140px] bg-black">
                  {m.best ? (
                    <SonarCropThumbnail sonarFileId={m.best.sonar_file_id} bbox={m.best.bbox} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-center text-[11px] text-muted-foreground px-2">
                      No sonar crop yet
                    </div>
                  )}
                  <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                    Sonar
                  </span>
                </div>
                <div className="relative h-[140px] bg-[#050814]">
                  <ObjectMesh3D
                    aspectRatio={m.aspectRatio}
                    scaleM={m.scaleM}
                    roundness={m.roundness}
                    archetype={CLASS_ARCHETYPE[m.entry.slug] ?? 'compact'}
                    color={m.color}
                    shadowLengthNorm={m.shadowLengthNorm}
                    height={140}
                  />
                  <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                    3D
                  </span>
                </div>
              </div>

              <div className="space-y-1 p-3 text-xs text-muted">
                <p>
                  <span className="text-muted-foreground">Key morphology:</span> {m.entry.identificationParameters[0]}
                </p>
                <p>
                  <span className="text-muted-foreground">Key sonar cue:</span> {m.entry.visualDetails[0]}
                </p>
                <div className="flex items-center justify-between pt-1">
                  {m.best ? (
                    <Badge variant="outline">Difficulty: {detectionDifficulty(m.best.calibrated_confidence)}</Badge>
                  ) : (
                    <Badge variant="warning">Not yet detected</Badge>
                  )}
                  {m.best?.risk_score && <RiskTierBadge tier={m.best.risk_score.risk_tier} />}
                </div>
              </div>

              <div className="border-t border-border p-2">
                <Button size="sm" variant="outline" className="w-full" onClick={() => setOpenSlug(m.entry.slug)}>
                  View detailed analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!openModel} onOpenChange={(open) => !open && setOpenSlug(null)}>
        {openModel && (
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto scrollbar-thin">
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle>{openModel.entry.name}</DialogTitle>
                <Badge variant={openModel.entry.category === 'artificial' ? 'danger' : 'secondary'}>
                  {openModel.entry.category === 'artificial' ? 'Man-made' : 'Natural'}
                </Badge>
                {openModel.best?.risk_score && <RiskTierBadge tier={openModel.best.risk_score.risk_tier} />}
              </div>
              <DialogDescription>{openModel.entry.classification}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
              <div className="rounded-md border border-border bg-[#050814] p-2">
                <ObjectMesh3D
                  aspectRatio={openModel.aspectRatio}
                  scaleM={openModel.scaleM}
                  roundness={openModel.roundness}
                  archetype={CLASS_ARCHETYPE[openModel.entry.slug] ?? 'compact'}
                  color={openModel.color}
                  shadowLengthNorm={openModel.shadowLengthNorm}
                  lengthM={openModel.lengthM}
                  widthM={openModel.widthM}
                  controls
                  height={380}
                />
              </div>

              <div className="space-y-3">
                {openModel.best ? (
                  <div className="rounded-md border border-border p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Source detection
                    </p>
                    <p className="text-sm text-foreground">
                      {classLabelToTitle(openModel.best.class_label)} · {Math.round(openModel.best.calibrated_confidence * 100)}%
                      calibrated confidence
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Survey: {openModel.best.survey_name}
                    </p>
                    {openModel.best.has_geo_metadata ? (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-foreground">
                        <MapPin className="h-3 w-3 text-primary" />
                        {openModel.best.latitude?.toFixed(5)}, {openModel.best.longitude?.toFixed(5)}
                      </p>
                    ) : (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                        <MapPinOff className="h-3 w-3" /> Image-space only
                      </p>
                    )}
                    <Button size="sm" className="mt-3 w-full" onClick={() => setIdentifiedDetection(openModel.best!)}>
                      <Sparkles className="h-3.5 w-3.5" /> Open full identification report
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs text-warning">
                    No real detection of this class exists yet on this instance - the preview above uses a generic
                    placeholder silhouette, not measured data.
                  </div>
                )}

                <div className="rounded-md border border-border p-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Identification parameters
                  </p>
                  <ul className="space-y-1 text-xs text-muted">
                    {openModel.entry.identificationParameters.map((p) => (
                      <li key={p}>• {p}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-md border border-border p-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visual cues</p>
                  <ul className="space-y-1 text-xs text-muted">
                    {openModel.entry.visualDetails.map((v) => (
                      <li key={v}>• {v}</li>
                    ))}
                  </ul>
                </div>

                <Link
                  to={`/identification-guide?class=${openModel.entry.slug}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <BookOpen className="h-3 w-3" /> Full identification guide entry
                </Link>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <ObjectIdentificationDialog
        detection={identifiedDetection}
        onOpenChange={(open) => !open && setIdentifiedDetection(null)}
      />
    </AppShell>
  )
}
