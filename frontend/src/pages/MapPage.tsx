import { useQuery } from '@tanstack/react-query'
import 'leaflet/dist/leaflet.css'
import { MapPin } from 'lucide-react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import { listDetections } from '@/api/detections'
import type { DetectionWithContext } from '@/api/types'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { RiskTierBadge } from '@/components/common/RiskTierBadge'
import { ErrorState, LoadingState } from '@/components/common/StateViews'
import { Card, CardContent } from '@/components/ui/card'
import { RISK_TIER_COLOR_VAR, classLabelToTitle, formatDateTime } from '@/lib/format'

const DEFAULT_CENTER: [number, number] = [9.05, 79.15] // Gulf of Mannar demo region
const RISK_ORDER = ['ignore', 'human_review', 'probable_debris', 'high_confidence_hazard'] as const

function radiusForTier(tier: string) {
  return RISK_ORDER.indexOf(tier as (typeof RISK_ORDER)[number]) * 2 + 6
}

export function MapPage() {
  const detectionsQuery = useQuery({ queryKey: ['detections', 'all'], queryFn: () => listDetections() })

  const detections = detectionsQuery.data ?? []
  const geolocated = detections.filter((d) => d.has_geo_metadata && d.latitude != null && d.longitude != null)
  const imageSpaceOnly = detections.filter((d) => !d.has_geo_metadata)

  const center: [number, number] =
    geolocated.length > 0 ? [geolocated[0].latitude!, geolocated[0].longitude!] : DEFAULT_CENTER

  return (
    <AppShell>
      <PageHeader
        title="Interactive Map"
        description="Geolocated detections only - anything without navigation metadata is listed separately, never plotted."
      />

      {detectionsQuery.isLoading && <LoadingState label="Loading detections…" />}
      {detectionsQuery.isError && <ErrorState onRetry={() => detectionsQuery.refetch()} />}

      {detectionsQuery.data && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="overflow-hidden lg:col-span-2">
            <div className="h-[65vh] w-full">
              <MapContainer center={center} zoom={geolocated.length ? 13 : 6} className="h-full w-full" style={{ background: '#0a0e14' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {geolocated.map((d) => (
                  <CircleMarker
                    key={d.id}
                    center={[d.latitude!, d.longitude!]}
                    radius={radiusForTier(d.risk_score?.risk_tier ?? 'human_review')}
                    pathOptions={{
                      color: RISK_TIER_COLOR_VAR[d.risk_score?.risk_tier ?? 'human_review'],
                      fillColor: RISK_TIER_COLOR_VAR[d.risk_score?.risk_tier ?? 'human_review'],
                      fillOpacity: 0.55,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <DetectionPopup detection={d} />
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </Card>

          <Card>
            <CardContent className="max-h-[65vh] overflow-y-auto scrollbar-thin p-4">
              <p className="mb-1 text-sm font-semibold text-foreground">Image-space only ({imageSpaceOnly.length})</p>
              <p className="mb-3 text-xs text-muted-foreground">
                No navigation metadata was present for these uploads - coordinates are never guessed.
              </p>
              {imageSpaceOnly.length === 0 && (
                <p className="text-sm text-muted">Every current detection has a real geolocation fix.</p>
              )}
              <div className="space-y-2">
                {imageSpaceOnly.map((d) => (
                  <div key={d.id} className="rounded-md border border-border p-2.5">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{classLabelToTitle(d.class_label)}</span>
                      {d.risk_score && <RiskTierBadge tier={d.risk_score.risk_tier} />}
                    </div>
                    <p className="text-xs text-muted-foreground">{d.survey_name}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  )
}

function DetectionPopup({ detection }: { detection: DetectionWithContext }) {
  return (
    <div className="min-w-40 text-xs">
      <p className="mb-1 flex items-center gap-1 font-semibold">
        <MapPin className="h-3 w-3" /> {classLabelToTitle(detection.class_label)}
      </p>
      <p>Survey: {detection.survey_name}</p>
      <p>Calibrated confidence: {Math.round(detection.calibrated_confidence * 100)}%</p>
      {detection.risk_score && <p>Risk tier: {detection.risk_score.risk_tier.replace('_', ' ')}</p>}
      <p>{formatDateTime(detection.created_at)}</p>
    </div>
  )
}
