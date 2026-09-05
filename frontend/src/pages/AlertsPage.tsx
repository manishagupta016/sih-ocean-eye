import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, BellOff, Check } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { acknowledgeAlert, listAlerts } from '@/api/alerts'
import { getApiErrorMessage } from '@/api/client'
import type { AlertSeverity } from '@/api/types'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toast'
import { formatDateTime } from '@/lib/format'

const SEVERITY_VARIANT: Record<AlertSeverity, 'secondary' | 'warning' | 'danger'> = {
  low: 'secondary',
  medium: 'warning',
  high: 'danger',
  critical: 'danger',
}

export function AlertsPage() {
  const queryClient = useQueryClient()
  const [ackFilter, setAckFilter] = useState<'unacknowledged' | 'acknowledged' | 'all'>('unacknowledged')
  const [severity, setSeverity] = useState<AlertSeverity | 'all'>('all')

  const alertsQuery = useQuery({
    queryKey: ['alerts', { ackFilter, severity }],
    queryFn: () =>
      listAlerts({
        acknowledged: ackFilter === 'all' ? undefined : ackFilter === 'acknowledged',
        severity: severity === 'all' ? undefined : severity,
      }),
  })

  const ackMutation = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      toast('Alert acknowledged', { variant: 'success' })
    },
    onError: (err) => toast('Could not acknowledge alert', { description: getApiErrorMessage(err), variant: 'destructive' }),
  })

  return (
    <AppShell>
      <PageHeader title="Alerts & Notifications" description="High-risk-tier detections that need operator attention." />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={ackFilter} onValueChange={(v) => setAckFilter(v as typeof ackFilter)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unacknowledged">Unacknowledged</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {alertsQuery.isLoading && <SkeletonRows rows={5} />}
      {alertsQuery.isError && <ErrorState onRetry={() => alertsQuery.refetch()} />}
      {alertsQuery.data && alertsQuery.data.length === 0 && (
        <EmptyState
          icon={<BellOff className="h-6 w-6 text-muted" />}
          title="No alerts here"
          description="High-confidence hazards and probable debris will show up here as they're detected."
        />
      )}

      <div className="space-y-2">
        {alertsQuery.data?.map((alert) => (
          <Card key={alert.id}>
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant={SEVERITY_VARIANT[alert.severity]}>{alert.severity.toUpperCase()}</Badge>
                    <Link to="/risk-list" className="text-xs text-muted hover:text-primary">
                      {alert.survey_name}
                    </Link>
                  </div>
                  <p className="text-sm text-foreground">{alert.message}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(alert.created_at)}</p>
                </div>
              </div>
              {!alert.acknowledged ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={ackMutation.isPending}
                  onClick={() => ackMutation.mutate(alert.id)}
                >
                  <Check className="h-4 w-4" /> Acknowledge
                </Button>
              ) : (
                <Badge variant="success">Acknowledged</Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  )
}
