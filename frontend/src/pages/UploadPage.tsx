import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, FileText, Loader2, Plus, UploadCloud, XCircle } from 'lucide-react'
import { type DragEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApiErrorMessage } from '@/api/client'
import { createSurvey, listSurveys } from '@/api/surveys'
import { getJobStatus, previewPreprocessing, uploadSonarFile } from '@/api/uploads'
import type { IngestStatus } from '@/api/types'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toast'

const ALLOWED_EXTENSIONS = ['.xtf', '.jsf', '.sdf', '.png', '.jpg', '.jpeg', '.tif', '.tiff']

const STAGE_ORDER: IngestStatus[] = [
  'queued',
  'preprocessing',
  'detecting',
  'discriminating',
  'calibrating',
  'scoring',
  'geolocating',
  'done',
]

const STAGE_LABELS: Record<IngestStatus, string> = {
  queued: 'Queued',
  preprocessing: 'Preprocessing',
  detecting: 'Detecting objects',
  discriminating: 'Scoring natural vs. artificial',
  calibrating: 'Calibrating confidence',
  scoring: 'Computing risk scores',
  geolocating: 'Attaching geolocation',
  done: 'Complete',
  failed: 'Failed',
}

function isPreviewable(filename: string) {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  return ['.png', '.jpg', '.jpeg', '.tif', '.tiff'].includes(ext)
}

export function UploadPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const surveysQuery = useQuery({ queryKey: ['surveys'], queryFn: listSurveys })

  const [surveyId, setSurveyId] = useState<string>('')

  // Defaults to the most recent survey once the list loads, so the common case (one active
  // survey) doesn't force an extra click before the file/survey pairing is even a decision.
  useEffect(() => {
    if (!surveyId && surveysQuery.data && surveysQuery.data.length > 0) {
      setSurveyId(surveysQuery.data[0].id)
    }
  }, [surveyId, surveysQuery.data])

  const [newSurveyOpen, setNewSurveyOpen] = useState(false)
  const [newSurveyName, setNewSurveyName] = useState('')
  const [newSurveyLocation, setNewSurveyLocation] = useState('')
  const [newSurveyDevice, setNewSurveyDevice] = useState('')

  const [file, setFile] = useState<File | null>(null)
  const [navLogFile, setNavLogFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [showAfter, setShowAfter] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navInputRef = useRef<HTMLInputElement>(null)

  const [jobId, setJobId] = useState<string | null>(null)
  const [sonarFileId, setSonarFileId] = useState<string | null>(null)

  const createSurveyMutation = useMutation({
    mutationFn: createSurvey,
    onSuccess: (survey) => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] })
      setSurveyId(survey.id)
      setNewSurveyOpen(false)
      setNewSurveyName('')
      setNewSurveyLocation('')
      setNewSurveyDevice('')
      toast('Survey created', { variant: 'success' })
    },
    onError: (err) => toast('Could not create survey', { description: getApiErrorMessage(err), variant: 'destructive' }),
  })

  const previewMutation = useMutation({ mutationFn: previewPreprocessing })

  const uploadMutation = useMutation({
    mutationFn: () => uploadSonarFile(surveyId, file!, navLogFile ?? undefined),
    onSuccess: (res) => {
      setJobId(res.job_id)
      setSonarFileId(res.sonar_file.id)
    },
    onError: (err) => toast('Upload failed', { description: getApiErrorMessage(err), variant: 'destructive' }),
  })

  const jobQuery = useQuery({
    queryKey: ['upload-job', jobId],
    queryFn: () => getJobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'done' || status === 'failed' ? false : 1200
    },
  })

  function handleFileSelect(selected: File) {
    const ext = selected.name.slice(selected.name.lastIndexOf('.')).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast('Unsupported file type', {
        description: `Accepted formats: ${ALLOWED_EXTENSIONS.join(', ')}`,
        variant: 'destructive',
      })
      return
    }
    setFile(selected)
    setJobId(null)
    setSonarFileId(null)
    if (isPreviewable(selected.name)) {
      previewMutation.mutate(selected)
    } else {
      previewMutation.reset()
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) handleFileSelect(dropped)
  }

  const stageIndex = jobQuery.data ? STAGE_ORDER.indexOf(jobQuery.data.status) : -1
  const isDone = jobQuery.data?.status === 'done'
  const isFailed = jobQuery.data?.status === 'failed'

  return (
    <AppShell>
      <PageHeader
        title="Upload Survey Data"
        description="Drag in side-scan sonar imagery or raw logs to run the detection pipeline."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Survey</Label>
                <div className="flex gap-2">
                  <Select value={surveyId} onValueChange={setSurveyId}>
                    <SelectTrigger className="flex-1">
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
                  <Dialog open={newSurveyOpen} onOpenChange={setNewSurveyOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" size="icon" aria-label="New survey">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create survey</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="new-survey-name">Name</Label>
                          <Input id="new-survey-name" value={newSurveyName} onChange={(e) => setNewSurveyName(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="new-survey-location">Site / location</Label>
                          <Input
                            id="new-survey-location"
                            value={newSurveyLocation}
                            onChange={(e) => setNewSurveyLocation(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="new-survey-device">Sonar device</Label>
                          <Input
                            id="new-survey-device"
                            placeholder="e.g. klein-3000"
                            value={newSurveyDevice}
                            onChange={(e) => setNewSurveyDevice(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          disabled={!newSurveyName || createSurveyMutation.isPending}
                          onClick={() =>
                            createSurveyMutation.mutate({
                              name: newSurveyName,
                              location_name: newSurveyLocation || undefined,
                              sonar_format: newSurveyDevice || undefined,
                            })
                          }
                        >
                          Create
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>

            <div
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
                dragging ? 'border-primary bg-primary/5' : 'border-border'
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <UploadCloud className="h-8 w-8 text-muted" />
              <p className="text-sm text-foreground">
                {file ? file.name : 'Drag and drop a sonar file here, or click to browse'}
              </p>
              <p className="text-xs text-muted-foreground">Accepted: {ALLOWED_EXTENSIONS.join(', ')}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                Browse files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={ALLOWED_EXTENSIONS.join(',')}
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-muted">
              <FileText className="h-3.5 w-3.5" />
              Optional navigation log (JSON: timestamp, latitude, longitude, heading_deg, range_m per
              ping) - without it, detections are geolocated as "image-space only".
              <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => navInputRef.current?.click()}>
                {navLogFile ? navLogFile.name : 'Attach nav log'}
              </Button>
              <input
                ref={navInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && setNavLogFile(e.target.files[0])}
              />
            </div>

            {previewMutation.isPending && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Generating preprocessing preview…
              </div>
            )}

            {previewMutation.data && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Preprocessing preview</p>
                  <div className="flex overflow-hidden rounded-md border border-border text-xs">
                    <button
                      className={`px-2.5 py-1 ${!showAfter ? 'bg-primary/15 text-primary' : 'text-muted'}`}
                      onClick={() => setShowAfter(false)}
                    >
                      Before
                    </button>
                    <button
                      className={`px-2.5 py-1 ${showAfter ? 'bg-primary/15 text-primary' : 'text-muted'}`}
                      onClick={() => setShowAfter(true)}
                    >
                      After
                    </button>
                  </div>
                </div>
                <img
                  src={`data:image/png;base64,${showAfter ? previewMutation.data.after_png_base64 : previewMutation.data.before_png_base64}`}
                  alt={showAfter ? 'Preprocessed sonar image' : 'Raw sonar image'}
                  className="w-full rounded-md border border-border bg-black"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  "After" applies denoising + CLAHE contrast stretch, the same step run before detection.
                </p>
              </div>
            )}

            <Button
              className="mt-5 w-full"
              disabled={!surveyId || !file || uploadMutation.isPending || !!jobId}
              onClick={() => uploadMutation.mutate()}
            >
              {uploadMutation.isPending ? 'Starting analysis…' : 'Start Analysis'}
            </Button>
            {!jobId && (!surveyId || !file) && (
              <p className="mt-2 text-center text-xs text-warning">
                {!surveyId && !file
                  ? 'Select a survey and choose a file to continue.'
                  : !surveyId
                    ? 'Select a survey above to continue.'
                    : 'Choose a file above to continue.'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-semibold text-foreground">Pipeline status</p>
            {!jobId && <p className="text-sm text-muted">Start an analysis to see live pipeline progress here.</p>}
            {jobId && (
              <div className="space-y-2">
                {STAGE_ORDER.map((stage, i) => {
                  const reached = stageIndex >= i
                  const active = jobQuery.data?.status === stage && stage !== 'done'
                  return (
                    <div key={stage} className="flex items-center gap-2 text-sm">
                      {isFailed && i === stageIndex ? (
                        <XCircle className="h-4 w-4 text-danger" />
                      ) : reached ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-border" />
                      )}
                      <span className={reached ? 'text-foreground' : 'text-muted-foreground'}>
                        {STAGE_LABELS[stage]}
                        {active && '…'}
                      </span>
                    </div>
                  )
                })}
                {isFailed && (
                  <p className="mt-2 text-xs text-danger">{jobQuery.data?.message ?? 'Processing failed.'}</p>
                )}
                {isDone && (
                  <Button className="mt-3 w-full" size="sm" onClick={() => navigate(`/results/${sonarFileId}`)}>
                    View results
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
