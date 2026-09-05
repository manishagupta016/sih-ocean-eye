import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listDetections } from '@/api/detections'
import type { DetectionWithContext, RiskTier } from '@/api/types'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { RiskTierBadge } from '@/components/common/RiskTierBadge'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { classLabelToTitle, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

type SortKey = 'class_label' | 'calibrated_confidence' | 'risk_tier' | 'created_at'
const RISK_RANK: Record<RiskTier, number> = { ignore: 0, human_review: 1, probable_debris: 2, high_confidence_hazard: 3 }

export function RiskListPage() {
  const [riskTier, setRiskTier] = useState<RiskTier | 'all'>('all')
  const [artificial, setArtificial] = useState<'all' | 'artificial' | 'natural'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('calibrated_confidence')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const detectionsQuery = useQuery({
    queryKey: ['detections', { riskTier, artificial }],
    queryFn: () =>
      listDetections({
        risk_tier: riskTier === 'all' ? undefined : riskTier,
        is_artificial: artificial === 'all' ? undefined : artificial === 'artificial',
      }),
  })

  const sorted = useMemo(() => {
    const rows = [...(detectionsQuery.data ?? [])]
    rows.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'class_label':
          cmp = a.class_label.localeCompare(b.class_label)
          break
        case 'calibrated_confidence':
          cmp = a.calibrated_confidence - b.calibrated_confidence
          break
        case 'risk_tier':
          cmp = RISK_RANK[a.risk_score?.risk_tier ?? 'ignore'] - RISK_RANK[b.risk_score?.risk_tier ?? 'ignore']
          break
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [detectionsQuery.data, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function SortHeader({ column, label }: { column: SortKey; label: string }) {
    const Icon = sortKey !== column ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
    return (
      <button
        className={cn('flex items-center gap-1 hover:text-foreground', sortKey === column && 'text-primary')}
        onClick={() => toggleSort(column)}
      >
        {label} <Icon className="h-3 w-3" />
      </button>
    )
  }

  return (
    <AppShell>
      <PageHeader
        title="Anomaly / Risk List"
        description="Every detection across all surveys, sortable and filterable by risk tier."
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={riskTier} onValueChange={(v) => setRiskTier(v as RiskTier | 'all')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Risk tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All risk tiers</SelectItem>
            <SelectItem value="ignore">Ignore</SelectItem>
            <SelectItem value="human_review">Human Review</SelectItem>
            <SelectItem value="probable_debris">Probable Debris</SelectItem>
            <SelectItem value="high_confidence_hazard">High-Confidence Hazard</SelectItem>
          </SelectContent>
        </Select>
        <Select value={artificial} onValueChange={(v) => setArtificial(v as typeof artificial)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Origin" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Natural + Artificial</SelectItem>
            <SelectItem value="artificial">Artificial only</SelectItem>
            <SelectItem value="natural">Natural only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {detectionsQuery.isLoading && <SkeletonRows rows={8} />}
      {detectionsQuery.isError && <ErrorState onRetry={() => detectionsQuery.refetch()} />}
      {detectionsQuery.data && sorted.length === 0 && (
        <EmptyState title="No detections match these filters" description="Try widening the risk tier or origin filter." />
      )}
      {detectionsQuery.data && sorted.length > 0 && (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortHeader column="class_label" label="Class" /></TableHead>
                <TableHead><SortHeader column="calibrated_confidence" label="Calibrated Confidence" /></TableHead>
                <TableHead>Origin</TableHead>
                <TableHead><SortHeader column="risk_tier" label="Risk Tier" /></TableHead>
                <TableHead>Survey</TableHead>
                <TableHead>Geolocation</TableHead>
                <TableHead><SortHeader column="created_at" label="Detected" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((d: DetectionWithContext) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium text-foreground">
                    <Link to={`/results/${d.sonar_file_id}`} className="hover:text-primary">
                      {classLabelToTitle(d.class_label)}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">{Math.round(d.calibrated_confidence * 100)}%</TableCell>
                  <TableCell>
                    <Badge variant={d.is_artificial ? 'danger' : 'secondary'}>{d.is_artificial ? 'Artificial' : 'Natural'}</Badge>
                  </TableCell>
                  <TableCell>{d.risk_score && <RiskTierBadge tier={d.risk_score.risk_tier} />}</TableCell>
                  <TableCell className="text-muted">{d.survey_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{d.has_geo_metadata ? 'Geolocated' : 'Image-space only'}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(d.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  )
}
