import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Radar, ShieldAlert, UploadCloud } from 'lucide-react'
import { Link } from 'react-router-dom'
import { listAlerts } from '@/api/alerts'
import { getDashboardSummary } from '@/api/analytics'
import { listSurveys } from '@/api/surveys'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { RiskTierBadge } from '@/components/common/RiskTierBadge'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/common/StateViews'
import { StatCard } from '@/components/common/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatRelativeTime } from '@/lib/format'
import type { RiskTier } from '@/api/types'

export function DashboardPage() {
  const summaryQuery = useQuery({ queryKey: ['dashboard-summary'], queryFn: getDashboardSummary })
  const surveysQuery = useQuery({ queryKey: ['surveys'], queryFn: listSurveys })
  const alertsQuery = useQuery({ queryKey: ['alerts', {}], queryFn: () => listAlerts() })

  const activity = [
    ...(surveysQuery.data ?? []).map((s) => ({
      id: `survey-${s.id}`,
      timestamp: s.uploaded_at,
      node: (
        <>
          Survey <span className="font-medium text-foreground">{s.name}</span> uploaded ·{' '}
          {s.detection_count} detections
        </>
      ),
    })),
    ...(alertsQuery.data ?? []).map((a) => ({
      id: `alert-${a.id}`,
      timestamp: a.created_at,
      node: (
        <div className="flex items-center gap-2">
          <RiskTierBadge tier={(a.risk_tier ?? 'human_review') as RiskTier} />
          <span>{a.message}</span>
        </div>
      ),
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8)

  return (
    <AppShell>
      <PageHeader
        title="Mission Control"
        description="Fleet-wide survey processing status and marine debris risk summary."
        actions={
          <Button asChild size="sm">
            <Link to="/upload">
              <UploadCloud className="h-4 w-4" /> New survey upload
            </Link>
          </Button>
        }
      />

      {summaryQuery.isLoading && <SkeletonRows rows={1} className="grid grid-cols-2 gap-4 sm:grid-cols-4" />}
      {summaryQuery.isError && <ErrorState onRetry={() => summaryQuery.refetch()} />}
      {summaryQuery.data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Surveys Processed" value={summaryQuery.data.surveys_processed} icon={Radar} accent="primary" />
          <StatCard label="Anomalies Found" value={summaryQuery.data.anomalies_found} icon={ShieldAlert} accent="warning" />
          <StatCard
            label="High-Risk Pending Review"
            value={summaryQuery.data.high_risk_pending_review}
            icon={AlertTriangle}
            accent="danger"
          />
          <StatCard label="Active Alerts" value={summaryQuery.data.active_alerts} icon={AlertTriangle} accent="danger" />
        </div>
      )}

      <div className="mt-6">
        <Card>
          <CardContent className="p-4">
            <p className="mb-3 text-sm font-semibold text-foreground">Recent activity</p>
            {(surveysQuery.isLoading || alertsQuery.isLoading) && <SkeletonRows rows={4} />}
            {surveysQuery.isError && <ErrorState onRetry={() => surveysQuery.refetch()} />}
            {!surveysQuery.isLoading && !alertsQuery.isLoading && activity.length === 0 && (
              <EmptyState
                title="No activity yet"
                description="Upload a side-scan sonar survey to see detections and alerts appear here."
                action={
                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <Link to="/upload">Upload your first survey</Link>
                  </Button>
                }
              />
            )}
            <ul className="divide-y divide-border">
              {!surveysQuery.isLoading &&
                !alertsQuery.isLoading &&
                activity.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                    <span className="text-foreground">{item.node}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(item.timestamp)}</span>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
