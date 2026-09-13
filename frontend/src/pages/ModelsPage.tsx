import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Plot } from '@/lib/plot3d'
import {
  CAMERA_PRESETS,
  axesTraces,
  buildModel,
  groundTrace,
  linesToPlotly,
  modelToPlotly,
  shadowTrace,
} from '@/lib/marineDebrisGeometry'
import { SonarRecordSVG } from '@/components/models3d/SonarRecordSVG'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingState } from '@/components/common/StateViews'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CLASSES, CUES, MODEL_COLORS, MORPH, MORPH3D, type ClassName, type SyntheticRecord } from '@/data/marineDebrisMeta'
import type { Data } from 'plotly.js'

type CameraPreset = keyof typeof CAMERA_PRESETS

function fmt(value: unknown, digits = 2, unit = ''): string {
  const n = Number(value)
  return Number.isFinite(n) ? `${n.toFixed(digits)}${unit}` : '—'
}

function GalleryCard({ cls, record, index, onOpen }: { cls: ClassName; record: SyntheticRecord; index: number; onOpen: () => void }) {
  const model = useMemo(() => buildModel(cls, record), [cls, record])
  const data = useMemo(
    () => [modelToPlotly(model, MODEL_COLORS[cls]), ...linesToPlotly(model), groundTrace(record)] as Data[],
    [model, cls, record],
  )

  return (
    <Card className="cursor-pointer overflow-hidden transition-colors hover:border-primary/50" onClick={onOpen}>
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-3 pt-3">
          <h3 className="text-sm font-bold" style={{ color: MODEL_COLORS[cls] }}>
            {index + 1}. {cls}
          </h3>
          <span className="text-[10px] text-muted-foreground">synthetic class</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-px bg-border">
          <div className="relative h-[150px] bg-black">
            <SonarRecordSVG cls={cls} record={record} className="h-full w-full" />
            <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
              Side-scan sonar
            </span>
          </div>
          <div className="relative h-[150px] bg-[#07101e]">
            <Plot
              data={data}
              layout={{
                paper_bgcolor: '#07101E',
                plot_bgcolor: '#07101E',
                margin: { l: 0, r: 0, t: 0, b: 0 },
                scene: {
                  aspectmode: 'data',
                  bgcolor: '#07101E',
                  xaxis: { visible: false },
                  yaxis: { visible: false },
                  zaxis: { visible: false },
                  camera: { eye: { x: 1.55, y: 1.2, z: 0.88 } },
                  dragmode: false,
                },
                showlegend: false,
              }}
              config={{ displayModeBar: false }}
              style={{ width: '100%', height: '100%' }}
              useResizeHandler
            />
            <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
              3D underwater view
            </span>
          </div>
        </div>
        <div className="p-3">
          <p className="text-xs text-muted">&rarr; {MORPH3D[cls]}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Badge variant="outline">L {fmt(record.target_length_m)} m</Badge>
            <Badge variant="outline">H {fmt(record.target_height_m)} m</Badge>
            <Badge variant="outline">Shadow {fmt(record.shadow_length_m)} m</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DetailModal({ cls, record, onClose }: { cls: ClassName; record: SyntheticRecord; onClose: () => void }) {
  const [preset, setPreset] = useState<CameraPreset>('iso')
  const [autoRotate, setAutoRotate] = useState(false)
  const [angle, setAngle] = useState(0.44) // matches reference's initial ry=25deg
  const [showSeabed, setShowSeabed] = useState(true)
  const [showShadow, setShowShadow] = useState(true)
  const [showParticles, setShowParticles] = useState(true)
  const [showAxes, setShowAxes] = useState(true)

  useEffect(() => {
    if (!autoRotate) return
    const id = setInterval(() => setAngle((a) => a + (0.8 * Math.PI) / 180), 30)
    return () => clearInterval(id)
  }, [autoRotate])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const model = useMemo(() => buildModel(cls, record), [cls, record])

  const data = useMemo(() => {
    const traces: Data[] = [modelToPlotly(model, MODEL_COLORS[cls]) as Data, ...(linesToPlotly(model) as Data[])]
    const lat = Number(record.latitude_deg)
    const lon = Number(record.longitude_deg)
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      const h = Math.max(0.4, Number(record.target_height_m) || 0.4)
      const W = Math.max(0.6, Number(record.target_width_m) || 0.6)
      traces.push({
        type: 'scatter3d',
        mode: 'text',
        x: [0],
        y: [-W * 0.85],
        z: [h + Math.max(0.35, h * 0.35)],
        text: [`${lat.toFixed(5)}°, ${lon.toFixed(5)}°`],
        textfont: { size: 11, color: '#6ee7ff' },
        hoverinfo: 'skip',
        showlegend: false,
      } as Data)
    }
    if (showSeabed) traces.push(groundTrace(record) as Data)
    if (showShadow) traces.push(shadowTrace(record) as Data)
    if (showAxes) traces.push(...(axesTraces(record) as Data[]))
    if (showParticles) {
      const n = 90
      const px: number[] = []
      const py: number[] = []
      const pz: number[] = []
      const s = Math.max(3, Math.max(Number(record.target_length_m) || 2, Number(record.target_width_m) || 2) * 1.35)
      for (let i = 0; i < n; i++) {
        px.push((((i * 37) % 100) / 100) * s * 2 - s)
        py.push((((i * 61) % 100) / 100) * 2.5 - 0.3)
        pz.push((((i * 83) % 100) / 100) * s * 2 - s)
      }
      traces.push({
        type: 'scatter3d',
        mode: 'markers',
        x: px,
        y: py,
        z: pz,
        marker: { size: 2, color: '#B8EFFF', opacity: 0.22 },
        hoverinfo: 'skip',
        showlegend: false,
      } as Data)
    }
    return traces
  }, [model, cls, record, showSeabed, showShadow, showParticles, showAxes])

  const eye = autoRotate ? { x: 1.8 * Math.cos(angle), y: 1.8 * Math.sin(angle), z: 1.05 } : CAMERA_PRESETS[preset]

  const lat = Number(record.latitude_deg)
  const lon = Number(record.longitude_deg)
  const depth = Number(record.water_depth_m)
  const latTxt = Number.isFinite(lat) ? `${lat.toFixed(6)}°` : '—'
  const lonTxt = Number.isFinite(lon) ? `${lon.toFixed(6)}°` : '—'
  const depthTxt = Number.isFinite(depth) ? `${depth.toFixed(1)} m` : '—'

  const metrics: [string, unknown, string][] = [
    ['Length', record.target_length_m, 'm'],
    ['Width', record.target_width_m, 'm'],
    ['Height', record.target_height_m, 'm'],
    ['Relief', record.relief_m, 'm'],
    ['Shadow', record.shadow_length_m, 'm'],
    ['Burial', record.burial_pct, '%'],
    ['Contrast', record.target_contrast_db, 'dB'],
    ['Difficulty', record.detection_difficulty, ''],
  ]

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-[3vh] overflow-hidden rounded-2xl border border-border bg-[#07101e] shadow-2xl md:inset-[4vh_4vw]">
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-border bg-[#0b1628] p-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">LIVE 3D MODEL &bull; {cls.toUpperCase()}</p>
              <h2 className="mt-0.5 text-xl font-black text-foreground">{cls} &mdash; 3D reconstruction</h2>
              <p className="mt-1 text-xs text-muted">
                Record {record.record_id} &bull; {record.split} &bull; {record.seabed_type} &bull;{' '}
                <span className="text-success">
                  {latTxt}, {lonTxt}
                </span>{' '}
                &bull; depth {depthTxt}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-lg text-muted hover:text-foreground"
            >
              &times;
            </button>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1.45fr_0.7fr]">
            <div className="relative min-h-[320px] border-b border-border bg-[radial-gradient(circle_at_50%_30%,#0c2942,#060c16_70%)] lg:border-b-0 lg:border-r">
              <div className="absolute left-3.5 top-3.5 z-10 min-w-[210px] rounded-lg border border-[#2f7890] bg-[#040f1b]/85 p-3 backdrop-blur">
                <p className="text-[9px] font-black uppercase tracking-widest text-primary">Dataset geolocation</p>
                <p className="mt-0.5 text-sm font-black text-foreground">
                  {latTxt} &nbsp; {lonTxt}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Water depth {depthTxt} &bull; synthetic record coordinate</p>
              </div>
              <p className="pt-2 text-center text-sm font-semibold text-foreground/90">3D underwater reconstruction</p>
              <Plot
                data={data}
                layout={{
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  margin: { l: 0, r: 0, t: 10, b: 0 },
                  scene: {
                    aspectmode: 'data',
                    bgcolor: 'rgba(0,0,0,0)',
                    xaxis: { title: 'X (m)', gridcolor: '#22324B', zerolinecolor: '#31425E', color: '#A8B4C7' },
                    yaxis: { title: 'Y (m)', gridcolor: '#22324B', zerolinecolor: '#31425E', color: '#A8B4C7' },
                    zaxis: { title: 'Z (m)', gridcolor: '#22324B', zerolinecolor: '#31425E', color: '#A8B4C7' },
                    camera: { eye, up: { x: 0, y: 0, z: 1 } },
                  },
                  showlegend: false,
                }}
                config={{ displayModeBar: false }}
                style={{ width: '100%', height: 'calc(100% - 28px)' }}
                useResizeHandler
              />
              <div className="absolute inset-x-3.5 bottom-3.5 flex flex-wrap gap-1.5 rounded-lg border border-border bg-[#07101b]/80 p-2 backdrop-blur">
                {(['iso', 'front', 'top', 'side'] as const).map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={preset === p && !autoRotate ? 'default' : 'outline'}
                    onClick={() => {
                      setAutoRotate(false)
                      setPreset(p)
                    }}
                  >
                    {p === 'iso' ? 'Isometric' : p.charAt(0).toUpperCase() + p.slice(1)}
                  </Button>
                ))}
                <Button size="sm" variant={autoRotate ? 'default' : 'outline'} onClick={() => setAutoRotate((v) => !v)}>
                  Auto rotate: {autoRotate ? 'ON' : 'OFF'}
                </Button>
              </div>
            </div>

            <div className="min-h-0 space-y-4 overflow-y-auto p-4 scrollbar-thin">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Water depth</p>
                  <p className="mt-1 text-base font-bold text-foreground">{depthTxt}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Region</p>
                  <p className="mt-1 text-base font-bold text-foreground">{record.region || '—'}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-primary">Measured parameters</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {metrics.map(([label, value, unit]) => (
                    <div key={label} className="rounded-lg border border-border p-2.5">
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">{fmt(value)}{unit ? ` ${unit}` : ''}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-black uppercase tracking-wide text-primary">Rendered morphology</p>
                <p className="text-sm text-muted">{MORPH[cls]}</p>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-black uppercase tracking-wide text-primary">Underwater visual cues</p>
                <div className="flex flex-wrap gap-1.5">
                  {CUES[cls].map((c) => (
                    <Badge key={c} variant="outline">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-primary">Scene controls</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-muted">
                  {(
                    [
                      ['Seabed', showSeabed, setShowSeabed],
                      ['Acoustic-style shadow', showShadow, setShowShadow],
                      ['Suspended particles', showParticles, setShowParticles],
                      ['Measurement axes', showAxes, setShowAxes],
                    ] as [string, boolean, (v: boolean) => void][]
                  ).map(([label, value, setValue]) => (
                    <label key={label} className="flex items-center gap-2 rounded-lg border border-border p-2">
                      <input type="checkbox" checked={value} onChange={(e) => setValue(e.target.checked)} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-[#0a1627] p-3 text-xs leading-relaxed text-muted">
                <p className="font-black text-primary">Interpretation context</p>
                <p className="mt-1">
                  Seabed: {record.seabed_type} &bull; Frequency: {fmt(record.sonar_frequency_khz, 1)} kHz &bull; Resolution:{' '}
                  {fmt(record.pixel_resolution_cm)} cm &bull; Backscatter contrast: {fmt(record.target_contrast_db)} dB
                </p>
                <p className="mt-2 font-bold text-success">
                  This reconstruction uses the selected synthetic record&apos;s measured geometry and sonar-context parameters.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ModelsPage() {
  const datasetQuery = useQuery({
    queryKey: ['synthetic-marine-debris-dataset'],
    queryFn: async () => {
      const res = await fetch('/data/marine-debris-synthetic.json')
      if (!res.ok) throw new Error('failed to load synthetic dataset')
      return (await res.json()) as SyntheticRecord[]
    },
    staleTime: Infinity,
  })

  const [selectedClass, setSelectedClass] = useState<ClassName>(CLASSES[0])
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [openRecord, setOpenRecord] = useState<{ cls: ClassName; record: SyntheticRecord } | null>(null)

  const byClass = useMemo(() => {
    const map = new Map<ClassName, SyntheticRecord[]>()
    for (const c of CLASSES) map.set(c, [])
    for (const r of datasetQuery.data ?? []) {
      const list = map.get(r.class_name as ClassName)
      if (list) list.push(r)
    }
    return map
  }, [datasetQuery.data])

  const recordsForClass = useMemo(() => byClass.get(selectedClass) ?? [], [byClass, selectedClass])
  const currentRecord = recordsForClass.find((r) => r.record_id === selectedRecordId) ?? recordsForClass[0]

  useEffect(() => {
    if (recordsForClass.length && !recordsForClass.some((r) => r.record_id === selectedRecordId)) {
      setSelectedRecordId(recordsForClass[0].record_id)
    }
  }, [selectedClass, recordsForClass, selectedRecordId])

  function randomRecordFor(cls: ClassName): SyntheticRecord | undefined {
    const rows = byClass.get(cls) ?? []
    return rows.length ? rows[Math.floor(Math.random() * rows.length)] : undefined
  }

  return (
    <AppShell>
      <PageHeader
        title="3D Models"
        description="Side Scan Sonar to Visual Underwater Reconstruction - SIH26057 synthetic demonstration dataset (2,400 records, 12 classes)."
      />

      <Card className="mb-4 border-primary/30 bg-primary/5">
        <CardContent className="p-4 text-xs leading-relaxed text-muted">
          Every record on this page is from the SIH26057 synthetic demonstration dataset ported from the project&apos;s
          reference dashboard - class, dimensions, coordinates, seabed and sonar context are generated demo values, not
          measurements from an uploaded survey. For a real detection&apos;s measured signals, see a survey&apos;s{' '}
          <span className="text-foreground">AI Analysis Results</span> page instead.
        </CardContent>
      </Card>

      {datasetQuery.isLoading && <LoadingState label="Loading synthetic dataset…" />}
      {datasetQuery.isError && <p className="text-sm text-danger">Could not load the synthetic dataset.</p>}

      {datasetQuery.data && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Select value={selectedClass} onValueChange={(v) => setSelectedClass(v as ClassName)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLASSES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={currentRecord?.record_id} onValueChange={setSelectedRecordId}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {recordsForClass.slice(0, 500).map((r) => (
                  <SelectItem key={r.record_id} value={r.record_id}>
                    {r.record_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const r = randomRecordFor(selectedClass)
                if (r) setSelectedRecordId(r.record_id)
              }}
            >
              Random record
            </Button>
            <Button
              size="sm"
              onClick={() => currentRecord && setOpenRecord({ cls: selectedClass, record: currentRecord })}
              disabled={!currentRecord}
            >
              Open 3D viewer
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {CLASSES.map((cls, i) => {
              const rows = byClass.get(cls) ?? []
              const record = rows[0]
              if (!record) return null
              return (
                <GalleryCard key={cls} cls={cls} record={record} index={i} onOpen={() => setOpenRecord({ cls, record })} />
              )
            })}
          </div>
        </>
      )}

      {openRecord && <DetailModal cls={openRecord.cls} record={openRecord.record} onClose={() => setOpenRecord(null)} />}
    </AppShell>
  )
}
