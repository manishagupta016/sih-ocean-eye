import { useQuery } from '@tanstack/react-query'
import { BookOpen, MapPin, MapPinOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getRiskFormula } from '@/api/riskScores'
import type { DetectionRead } from '@/api/types'
import { ConfidenceBar } from '@/components/common/ConfidenceBar'
import { RiskTierBadge } from '@/components/common/RiskTierBadge'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CLASS_LABEL_TO_GUIDE_SLUG, IDENTIFICATION_CLASSES } from '@/data/identificationGuide'
import { classLabelToTitle } from '@/lib/format'

function Meter({ label, value, hint }: { label: string; value: number | null; hint: string }) {
  if (value === null) {
    return (
      <div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">{label}</span>
          <span className="text-muted-foreground">not recorded</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      </div>
    )
  }
  const pct = Math.round(value * 100)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full border border-border bg-surface-raised">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}

/**
 * Full object-identification report for one detection: only real, measured pipeline output
 * (confidence, discriminator score, shape/shadow/texture signals, risk-formula breakdown,
 * geolocation) plus the reference identification-guide criteria for its class, clearly labeled as
 * general guidance rather than a measurement of this specific detection.
 */
export function ObjectIdentificationDialog({
  detection,
  onOpenChange,
}: {
  detection: DetectionRead | null
  onOpenChange: (open: boolean) => void
}) {
  const formulaQuery = useQuery({
    queryKey: ['risk-formula'],
    queryFn: getRiskFormula,
    enabled: !!detection,
    staleTime: Infinity,
  })

  const guideSlug = detection ? CLASS_LABEL_TO_GUIDE_SLUG[detection.class_label] : undefined
  const guideEntry = guideSlug ? IDENTIFICATION_CLASSES.find((c) => c.slug === guideSlug) : undefined

  const weights = formulaQuery.data?.weights
  const sizeReference = formulaQuery.data?.size_reference_m2 ?? 25
  const riskScore = detection?.risk_score
  const sizeScore = riskScore ? Math.min(1, riskScore.size_estimate / sizeReference) : null

  const contributions =
    weights && riskScore && detection
      ? [
          { label: 'Calibrated confidence', weight: weights.calibrated_confidence, input: detection.calibrated_confidence },
          { label: 'Artificial score', weight: weights.artificial_score, input: detection.artificial_score },
          { label: 'Estimated size', weight: weights.size, input: sizeScore ?? 0 },
          { label: 'In-distribution trust', weight: weights.domain_trust, input: 1 - riskScore.domain_shift_penalty },
        ]
      : null

  return (
    <Dialog open={!!detection} onOpenChange={onOpenChange}>
      {detection && (
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>{classLabelToTitle(detection.class_label)}</DialogTitle>
              {guideEntry && (
                <Badge variant={guideEntry.category === 'artificial' ? 'danger' : 'secondary'}>
                  {guideEntry.category === 'artificial' ? 'Man-made' : 'Natural'}
                </Badge>
              )}
              {detection.risk_score && <RiskTierBadge tier={detection.risk_score.risk_tier} />}
              {detection.risk_score?.ecological_flag && <Badge variant="warning">Ecologically sensitive</Badge>}
            </div>
            <DialogDescription>
              {guideEntry?.classification ?? 'Raw pipeline label - no reference-guide entry mapped yet.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 sm:grid-cols-2">
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detection confidence</h4>
              <div className="space-y-2">
                <ConfidenceBar
                  value={detection.calibrated_confidence}
                  label={`Calibrated ${Math.round(detection.calibrated_confidence * 100)}%`}
                />
                <p className="text-xs text-muted-foreground">Raw model confidence: {Math.round(detection.raw_confidence * 100)}%</p>
                <p className="text-xs text-muted-foreground">
                  Discriminator: {detection.is_artificial ? 'Artificial' : 'Natural'} ({Math.round(detection.artificial_score * 100)}%)
                </p>
              </div>
            </section>

            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Geolocation</h4>
              {detection.has_geo_metadata ? (
                <p className="flex items-center gap-1.5 text-sm text-foreground">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  {detection.latitude?.toFixed(5)}, {detection.longitude?.toFixed(5)}
                </p>
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-muted">
                  <MapPinOff className="h-3.5 w-3.5" /> Image-space only - no navigation metadata for this survey line.
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Bounding box: {detection.bbox.w}×{detection.bbox.h}px at ({detection.bbox.x}, {detection.bbox.y})
              </p>
              {detection.risk_score && (
                <p className="text-xs text-muted-foreground">
                  Estimated footprint: {detection.risk_score.size_estimate.toFixed(2)} m² (bbox area × across-track
                  resolution - approximate)
                </p>
              )}
            </section>

            <section className="sm:col-span-2">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Shape &amp; sonar-proxy signature
              </h4>
              <p className="mb-2 text-xs text-muted-foreground">
                Computed by the discrimination stage directly from this image (classical computer vision) - normalized
                0-100% indices, not physical measurements.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Meter
                  label="Shape regularity"
                  value={detection.shape_regularity}
                  hint="Higher = more circular/rectilinear silhouette, typical of man-made objects."
                />
                <Meter
                  label="Acoustic shadow length"
                  value={detection.shadow_length_px}
                  hint="Higher = longer, sharper shadow, typical of raised rigid structures."
                />
                <Meter
                  label="Texture variance"
                  value={detection.texture_variance}
                  hint="Lower = smoother surface (man-made); higher = rougher (natural sediment/clutter)."
                />
              </div>
            </section>

            {contributions && riskScore && (
              <section className="sm:col-span-2">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why this risk tier</h4>
                <div className="space-y-2">
                  {contributions.map((c) => (
                    <div key={c.label} className="flex items-center gap-2 text-xs">
                      <span className="w-40 shrink-0 text-muted">{c.label}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full border border-border bg-surface-raised">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(c.input * 100)}%` }} />
                      </div>
                      <span className="w-32 shrink-0 tabular-nums text-muted-foreground">
                        {Math.round(c.weight * 100)}%×{Math.round(c.input * 100)}%={(c.weight * c.input).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <p className="pt-1 text-xs font-medium text-foreground">
                    Composite score: {riskScore.computed_score.toFixed(2)} → {riskScore.risk_tier.replace(/_/g, ' ')}
                  </p>
                  {riskScore.ecological_flag && (
                    <p className="text-xs text-warning">
                      Ecologically sensitive class - never auto-dismissed as "ignore" regardless of composite score.
                    </p>
                  )}
                </div>
              </section>
            )}

            <section className="rounded-md border border-border bg-surface-raised/50 p-3 sm:col-span-2">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Reference identification criteria
              </h4>
              {guideEntry ? (
                <>
                  <p className="mb-2 text-xs text-muted-foreground">
                    General manual-review guidance for {guideEntry.name} - not a measurement of this specific detection.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[11px] font-semibold text-foreground">Identification parameters</p>
                      <ul className="space-y-0.5 text-xs text-muted">
                        {guideEntry.identificationParameters.slice(0, 6).map((p) => (
                          <li key={p}>• {p}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-semibold text-foreground">Visual cues</p>
                      <ul className="space-y-0.5 text-xs text-muted">
                        {guideEntry.visualDetails.slice(0, 6).map((v) => (
                          <li key={v}>• {v}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <Link
                    to={`/identification-guide?class=${guideEntry.slug}`}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <BookOpen className="h-3 w-3" /> Full identification guide entry
                  </Link>
                </>
              ) : (
                <p className="text-xs text-muted">No reference-guide entry is mapped to raw label "{detection.class_label}" yet.</p>
              )}
            </section>
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
