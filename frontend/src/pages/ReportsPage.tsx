import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileJson, FileSpreadsheet, FileText } from 'lucide-react'
import { useState } from 'react'
import { getApiErrorMessage } from '@/api/client'
import { downloadReport, generateReport, listReports } from '@/api/reports'
import { listSurveys } from '@/api/surveys'
import type { ReportFormat } from '@/api/types'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toast'
import { formatDateTime } from '@/lib/format'

export function ReportsPage() {
  const queryClient = useQueryClient()
  const [surveyId, setSurveyId] = useState<string>('')

  const surveysQuery = useQuery({ queryKey: ['surveys'], queryFn: listSurveys })
  const reportsQuery = useQuery({
    queryKey: ['reports', surveyId],
    queryFn: () => listReports(surveyId || undefined),
  })

  const generateMutation = useMutation({
    mutationFn: (format: ReportFormat) => generateReport(surveyId, format),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      toast('Report generated', { variant: 'success' })
    },
    onError: (err) => toast('Could not generate report', { description: getApiErrorMessage(err), variant: 'destructive' }),
  })

  async function handleDownload(reportId: string, format: ReportFormat) {
    try {
      await downloadReport(reportId, `ocean-eye-report.${format}`)
    } catch (err) {
      toast('Download failed', { description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Reports"
        description="Export survey detections with calibrated confidence, risk tier, and geolocation status."
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted">Survey</p>
            <Select value={surveyId} onValueChange={setSurveyId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a survey" />
              </SelectTrigger>
              <SelectContent>
                {surveysQuery.data?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            disabled={!surveyId || generateMutation.isPending}
            onClick={() => generateMutation.mutate('csv')}
          >
            <FileSpreadsheet className="h-4 w-4" /> Generate CSV
          </Button>
          <Button disabled={!surveyId || generateMutation.isPending} onClick={() => generateMutation.mutate('json')}>
            <FileJson className="h-4 w-4" /> Generate JSON
          </Button>
        </CardContent>
      </Card>

      {reportsQuery.isLoading && <SkeletonRows rows={4} />}
      {reportsQuery.isError && <ErrorState onRetry={() => reportsQuery.refetch()} />}
      {reportsQuery.data && reportsQuery.data.length === 0 && (
        <EmptyState
          icon={<FileText className="h-6 w-6 text-muted" />}
          title="No reports yet"
          description="Select a survey above and generate a CSV or JSON export."
        />
      )}

      <div className="space-y-2">
        {reportsQuery.data?.map((report) => (
          <Card key={report.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                {report.format === 'csv' ? (
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                ) : (
                  <FileJson className="h-5 w-5 text-primary" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{report.format.toUpperCase()}</Badge>
                    <span className="text-sm text-muted-foreground">{formatDateTime(report.generated_at)}</span>
                  </div>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleDownload(report.id, report.format)}>
                <Download className="h-4 w-4" /> Download
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  )
}
