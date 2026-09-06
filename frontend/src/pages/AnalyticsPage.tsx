import { useQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  getCalibrationReport,
  getCrossDomainReport,
  getLatencyReport,
  getPerformanceMetrics,
  listModelVersions,
} from '@/api/analytics'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { ErrorState, LoadingState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { classLabelToTitle } from '@/lib/format'

const CHART_COLORS = {
  precision: '#1ebdf5',
  recall: '#2f7dea',
  map50: '#34d399',
  p50: '#1ebdf5',
  p95: '#f87171',
  inDomain: '#34d399',
  crossDomain: '#f87171',
}

export function AnalyticsPage() {
  const performanceQuery = useQuery({ queryKey: ['analytics', 'performance'], queryFn: getPerformanceMetrics })
  const calibrationQuery = useQuery({ queryKey: ['analytics', 'calibration'], queryFn: getCalibrationReport })
  const crossDomainQuery = useQuery({ queryKey: ['analytics', 'cross-domain'], queryFn: getCrossDomainReport })
  const latencyQuery = useQuery({ queryKey: ['analytics', 'latency'], queryFn: getLatencyReport })
  const modelVersionsQuery = useQuery({ queryKey: ['analytics', 'model-versions'], queryFn: listModelVersions })

  const isLoading =
    performanceQuery.isLoading || calibrationQuery.isLoading || crossDomainQuery.isLoading || latencyQuery.isLoading
  const isError = performanceQuery.isError || calibrationQuery.isError || crossDomainQuery.isError || latencyQuery.isError

  const perClassData = performanceQuery.data
    ? Object.entries(performanceQuery.data.per_class).map(([label, m]) => ({
        label: classLabelToTitle(label),
        precision: Math.round(m.precision * 100),
        recall: Math.round(m.recall * 100),
        map50: Math.round(m.map50 * 100),
      }))
    : []

  const latencyData = latencyQuery.data?.stages.map((s) => ({
    stage: classLabelToTitle(s.stage),
    p50: Math.round(s.p50_ms),
    p95: Math.round(s.p95_ms),
  }))

  const crossDomainData = crossDomainQuery.data?.rows.map((r) => ({
    label: `${r.train_domain.split(',')[0]} → ${r.test_domain.split(',')[0]}`,
    inDomain: Math.round(r.map50_in_domain * 100),
    crossDomain: Math.round(r.map50_cross_domain * 100),
    drop: r.accuracy_drop_pct,
    note: r.note,
  }))

  const sssModel = modelVersionsQuery.data?.find((m) => m.name === 'yolov8n-sss')

  return (
    <AppShell>
      <PageHeader title="Analytics" description="Model performance, calibration quality, cross-domain robustness, and inference speed." />

      {isLoading && <LoadingState label="Loading analytics…" />}
      {isError && <ErrorState onRetry={() => window.location.reload()} />}

      {!isLoading && !isError && (
        <div className="space-y-4">
          {sssModel && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-start gap-3 p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    Model provenance - {sssModel.name} {sssModel.version}
                  </p>
                  <p className="text-muted">{String(sssModel.trained_on)}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>Detection performance by class</CardTitle>
                  <SourceBadge source={performanceQuery.data?.source} />
                </div>
                <CardDescription>
                  Overall: precision {Math.round((performanceQuery.data?.precision ?? 0) * 100)}%, recall{' '}
                  {Math.round((performanceQuery.data?.recall ?? 0) * 100)}%, mAP@0.5{' '}
                  {Math.round((performanceQuery.data?.map50 ?? 0) * 100)}%, mAP@0.5:0.95{' '}
                  {Math.round((performanceQuery.data?.map50_95 ?? 0) * 100)}%, false-positive rate{' '}
                  {Math.round((performanceQuery.data?.false_positive_rate ?? 0) * 100)}%
                </CardDescription>
              </CardHeader>
              <CardContent className="h-72 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perClassData} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-muted)' }} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted)' }} unit="%" />
                    <Tooltip contentStyle={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="precision" name="Precision" fill={CHART_COLORS.precision} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="recall" name="Recall" fill={CHART_COLORS.recall} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="map50" name="mAP@0.5" fill={CHART_COLORS.map50} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>Calibration reliability diagram</CardTitle>
                  <SourceBadge source={calibrationQuery.data?.source} />
                </div>
                <CardDescription>
                  Expected Calibration Error: {((calibrationQuery.data?.expected_calibration_error ?? 0) * 100).toFixed(1)}%
                  - closer to the diagonal is better calibrated.
                  {calibrationQuery.data?.note && <span className="block mt-1 text-warning">{calibrationQuery.data.note}</span>}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-72 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      type="number"
                      dataKey="confidence_mean"
                      name="Mean confidence"
                      domain={[0, 1]}
                      tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                    />
                    <YAxis
                      type="number"
                      dataKey="accuracy_mean"
                      name="Empirical accuracy"
                      domain={[0, 1]}
                      tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      contentStyle={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', fontSize: 12 }}
                    />
                    <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="var(--color-muted)" strokeDasharray="4 4" />
                    <Scatter
                      name="Confidence bins"
                      data={calibrationQuery.data?.bins.filter((b) => b.sample_count > 0)}
                      fill={CHART_COLORS.precision}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>Cross-domain accuracy drop</CardTitle>
                  <SourceBadge source={crossDomainQuery.data?.source} />
                </div>
                <CardDescription>
                  mAP@0.5 in-domain vs. on a held-out different sonar/site source. FLS data is never used as SSS
                  ground truth - pretraining only.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-72 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={crossDomainData} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-muted)' }} angle={-15} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted)' }} unit="%" />
                    <Tooltip contentStyle={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="inDomain" name="In-domain mAP@0.5" fill={CHART_COLORS.inDomain} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="crossDomain" name="Cross-domain mAP@0.5" fill={CHART_COLORS.crossDomain} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inference latency by stage</CardTitle>
                <CardDescription>
                  End-to-end p50 {Math.round(latencyQuery.data?.end_to_end_p50_ms ?? 0)}ms, p95{' '}
                  {Math.round(latencyQuery.data?.end_to_end_p95_ms ?? 0)}ms - measured from actual pipeline runs on this
                  instance.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-72 p-2">
                {latencyData && latencyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={latencyData} margin={{ left: 0, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="stage" tick={{ fontSize: 11, fill: 'var(--color-muted)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted)' }} unit="ms" />
                      <Tooltip contentStyle={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="p50" name="p50 (ms)" fill={CHART_COLORS.p50} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="p95" name="p95 (ms)" fill={CHART_COLORS.p95} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted">
                    No pipeline runs recorded yet on this instance - upload a survey to populate this chart.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  )
}

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null
  return source === 'measured' ? (
    <Badge variant="success" className="shrink-0">
      Measured
    </Badge>
  ) : (
    <Badge variant="warning" className="shrink-0">
      Illustrative
    </Badge>
  )
}
