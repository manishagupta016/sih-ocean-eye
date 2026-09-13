import { useEffect, useMemo, useState } from 'react'
import { Axis3D, Orbit, RotateCw, Sparkles, Waves } from 'lucide-react'
import type { Data } from 'plotly.js'
import { Plot } from '@/lib/plot3d'
import { buildSchematicMesh, type Archetype } from '@/lib/schematicShape'
import { CAMERA_PRESETS } from '@/data/modelArchetypes'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ObjectMesh3DProps {
  aspectRatio: number
  scaleM: number
  roundness: number
  archetype: Archetype
  color: string
  /** Real, normalized (0-1) shadow_length_px signal for this detection, when available. */
  shadowLengthNorm: number | null
  lengthM?: number | null
  widthM?: number | null
  controls?: boolean
  height?: number
}

function seabedTrace(span: number) {
  const n = 2
  const grid: number[] = []
  for (let i = 0; i <= n; i++) grid.push(-span + (2 * span * i) / n)
  const x: number[] = []
  const y: number[] = []
  const z: number[] = []
  for (const gx of grid) {
    for (const gy of grid) {
      x.push(gx)
      y.push(gy)
      z.push(0)
    }
  }
  const i: number[] = []
  const j: number[] = []
  const k: number[] = []
  const stride = n + 1
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      const p0 = a * stride + b
      const p1 = p0 + 1
      const p2 = p0 + stride
      const p3 = p2 + 1
      i.push(p0, p1)
      j.push(p1, p3)
      k.push(p2, p2)
    }
  }
  return { x, y, z, i, j, k }
}

function particleTrace(span: number, seed: number) {
  let s = seed
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  const n = 40
  const x: number[] = []
  const y: number[] = []
  const z: number[] = []
  for (let p = 0; p < n; p++) {
    x.push((rand() - 0.5) * span * 1.8)
    y.push((rand() - 0.5) * span * 1.8)
    z.push(rand() * span * 0.6)
  }
  return { x, y, z }
}

/**
 * Schematic 3D reconstruction - a dataset-driven illustration, not a photogrammetric scan (see
 * lib/schematicShape.ts). `controls` renders the toolbar used by the detail modal; the gallery
 * card renders a small, fixed, non-interactive preview.
 */
export function ObjectMesh3D({
  aspectRatio,
  scaleM,
  roundness,
  archetype,
  color,
  shadowLengthNorm,
  lengthM,
  widthM,
  controls = false,
  height = 260,
}: ObjectMesh3DProps) {
  const [preset, setPreset] = useState<'isometric' | 'front' | 'top' | 'side'>('isometric')
  const [autoRotate, setAutoRotate] = useState(false)
  const [showSeabed, setShowSeabed] = useState(true)
  const [showShadow, setShowShadow] = useState(shadowLengthNorm !== null)
  const [showParticles, setShowParticles] = useState(false)
  const [showAxes, setShowAxes] = useState(true)
  const [angle, setAngle] = useState(0)
  const [revision, setRevision] = useState(0)

  const mesh = useMemo(
    () => buildSchematicMesh({ aspectRatio, scaleM, roundness, archetype }),
    [aspectRatio, scaleM, roundness, archetype],
  )
  const span = scaleM * 1.4
  const seabed = useMemo(() => seabedTrace(span), [span])
  const particles = useMemo(() => particleTrace(span, Math.round(scaleM * 1000) + 1), [span, scaleM])

  useEffect(() => {
    if (!autoRotate || !controls) return
    const id = setInterval(() => setAngle((a) => a + 0.01), 40)
    return () => clearInterval(id)
  }, [autoRotate, controls])

  useEffect(() => {
    setRevision((r) => r + 1)
  }, [preset, angle, showSeabed, showShadow, showParticles, showAxes])

  const eye = autoRotate
    ? { x: Math.cos(angle) * 1.9, y: Math.sin(angle) * 1.9, z: 1.1 }
    : CAMERA_PRESETS[preset]

  const data: Partial<Data>[] = [
    {
      type: 'mesh3d',
      x: mesh.x,
      y: mesh.y,
      z: mesh.z,
      i: mesh.i,
      j: mesh.j,
      k: mesh.k,
      color,
      opacity: 0.92,
      flatshading: true,
      lighting: { ambient: 0.55, diffuse: 0.7, specular: 0.15, roughness: 0.6 },
      hoverinfo: 'skip',
      name: 'object',
    } as Partial<Data>,
  ]

  if (showSeabed) {
    data.push({
      type: 'mesh3d',
      x: seabed.x,
      y: seabed.y,
      z: seabed.z,
      i: seabed.i,
      j: seabed.j,
      k: seabed.k,
      color: '#12203a',
      opacity: 0.55,
      hoverinfo: 'skip',
      name: 'seabed',
    } as Partial<Data>)
  }

  if (showShadow && shadowLengthNorm !== null) {
    const shadowLen = span * 0.9 * Math.max(0.15, shadowLengthNorm)
    const sx = [-scaleM / 4, scaleM / 4, scaleM / 4, -scaleM / 4]
    const sy0 = -scaleM * 0.55
    const sy = [sy0, sy0, sy0 - shadowLen, sy0 - shadowLen]
    data.push({
      type: 'mesh3d',
      x: [...sx],
      y: [...sy],
      z: [0.002, 0.002, 0.002, 0.002],
      i: [0],
      j: [1],
      k: [2],
      color: '#000000',
      opacity: 0.45,
      hoverinfo: 'skip',
      name: 'acoustic shadow',
    } as Partial<Data>)
    data.push({
      type: 'mesh3d',
      x: [sx[0], sx[2], sx[3]],
      y: [sy[0], sy[2], sy[3]],
      z: [0.002, 0.002, 0.002],
      i: [0],
      j: [1],
      k: [2],
      color: '#000000',
      opacity: 0.45,
      hoverinfo: 'skip',
      showlegend: false,
    } as Partial<Data>)
  }

  if (showParticles) {
    data.push({
      type: 'scatter3d',
      mode: 'markers',
      x: particles.x,
      y: particles.y,
      z: particles.z,
      marker: { size: 1.5, color: '#8fa0b8', opacity: 0.5 },
      hoverinfo: 'skip',
      name: 'suspended particles',
    } as Partial<Data>)
  }

  if (showAxes && lengthM && widthM) {
    data.push({
      type: 'scatter3d',
      mode: 'text',
      x: [0, scaleM / 2 + 0.3],
      y: [-(scaleM * Math.max(0.15, Math.min(1, aspectRatio))) / 2 - 0.4, 0],
      z: [0.05, 0.05],
      text: [`W ${widthM.toFixed(1)}m`, `L ${lengthM.toFixed(1)}m`],
      textfont: { color: '#e8eef7', size: 10 },
      hoverinfo: 'skip',
      showlegend: false,
    } as Partial<Data>)
  }

  return (
    <div>
      <Plot
        data={data as Data[]}
        layout={{
          autosize: true,
          margin: { l: 0, r: 0, t: 0, b: 0 },
          paper_bgcolor: 'rgba(0,0,0,0)',
          scene: {
            xaxis: { visible: false },
            yaxis: { visible: false },
            zaxis: { visible: false },
            aspectmode: 'data',
            camera: { eye },
            bgcolor: 'rgba(0,0,0,0)',
            dragmode: controls ? 'orbit' : false,
          },
          showlegend: false,
        }}
        // NOTE: staticPlot:true silently fails to initialize the WebGL context for gl3d trace
        // types (mesh3d/scatter3d) in this Plotly build - it works fine for 2D/SVG charts, but a
        // 3D scene needs the normal render path even when it should look non-interactive, hence
        // disabling interaction via scene.dragmode/scrollZoom instead of staticPlot.
        config={{ displayModeBar: false, scrollZoom: controls }}
        style={{ width: '100%', height }}
        useResizeHandler
        revision={revision}
      />
      {controls && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {(['isometric', 'front', 'top', 'side'] as const).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={preset === p && !autoRotate ? 'default' : 'outline'}
              onClick={() => {
                setAutoRotate(false)
                setPreset(p)
              }}
              className="capitalize"
            >
              {p}
            </Button>
          ))}
          <Button size="sm" variant={autoRotate ? 'default' : 'outline'} onClick={() => setAutoRotate((v) => !v)}>
            <RotateCw className="h-3.5 w-3.5" /> Auto-rotate
          </Button>
          <ToggleChip icon={Orbit} label="Seabed" active={showSeabed} onClick={() => setShowSeabed((v) => !v)} />
          <ToggleChip
            icon={Waves}
            label="Shadow"
            active={showShadow}
            disabled={shadowLengthNorm === null}
            onClick={() => setShowShadow((v) => !v)}
          />
          <ToggleChip icon={Sparkles} label="Particles" active={showParticles} onClick={() => setShowParticles((v) => !v)} />
          <ToggleChip icon={Axis3D} label="Measurements" active={showAxes} onClick={() => setShowAxes((v) => !v)} />
        </div>
      )}
    </div>
  )
}

function ToggleChip({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: typeof Orbit
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-40',
        active ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted hover:bg-surface-raised',
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  )
}
