/**
 * 3D geometry engine ported from SIH26057_Marine_Debris_3D_GEOENABLED_Dashboard_v8.html's
 * "Plotly/WebGL 3D reconstruction studio" section, so the /3d page can reproduce that dashboard's
 * per-class models exactly (same primitive-combination approach: boxes/cylinders/spheres/tori/
 * prisms/lines assembled per class, scaled from that record's synthetic target dimensions).
 *
 * NOTE: `addBox` intentionally reproduces the source file's own indexing (it always references
 * face indices 0-7 relative to the whole vertex list, not the box's own push offset) - ported
 * as-is rather than "fixed" so every class renders pixel-for-pixel like the reference dashboard.
 */
import type { Data } from 'plotly.js'
import type { ClassName, SyntheticRecord } from '@/data/marineDebrisMeta'
import { MODEL_COLORS } from '@/data/marineDebrisMeta'

type Vec3 = [number, number, number]
interface Face {
  idx: number[]
  color: string
}
interface LineSeg {
  a: number
  b: number
  color: string
}
export interface Model3D {
  v: Vec3[]
  f: Face[]
  lines: LineSeg[]
}

function addBox(v: Vec3[], f: Face[], c: string, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  v.push(
    [x - sx / 2, y - sy / 2, z - sz / 2],
    [x + sx / 2, y - sy / 2, z - sz / 2],
    [x + sx / 2, y + sy / 2, z - sz / 2],
    [x - sx / 2, y + sy / 2, z - sz / 2],
    [x - sx / 2, y - sy / 2, z + sz / 2],
    [x + sx / 2, y - sy / 2, z + sz / 2],
    [x + sx / 2, y + sy / 2, z + sz / 2],
    [x - sx / 2, y + sy / 2, z + sz / 2],
  )
  ;[
    [0, 1, 2, 3],
    [4, 7, 6, 5],
    [0, 4, 5, 1],
    [1, 5, 6, 2],
    [2, 6, 7, 3],
    [4, 0, 3, 7],
  ].forEach((q) => f.push({ idx: q, color: c }))
}

function addCylinder(
  v: Vec3[],
  f: Face[],
  c: string,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
  axis: 'x' | 'y' | 'z' = 'y',
  segments = 18,
) {
  const base = v.length
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i < segments; i++) {
      const a = (i * 2 * Math.PI) / segments
      const co = Math.cos(a) * r
      const si = Math.sin(a) * r
      let p: Vec3
      if (axis === 'x') p = k ? [x + h / 2, y + co, z + si] : [x - h / 2, y + co, z + si]
      else if (axis === 'z') p = k ? [x + co, y + si, z + h / 2] : [x + co, y + si, z - h / 2]
      else p = k ? [x + co, y + h / 2, z + si] : [x + co, y - h / 2, z + si]
      v.push(p)
    }
  }
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments
    f.push({ idx: [base + i, base + j, base + segments + j, base + segments + i], color: c })
  }
  f.push(
    { idx: Array.from({ length: segments }, (_, i) => base + i), color: c },
    { idx: Array.from({ length: segments }, (_, i) => base + segments + i).reverse(), color: c },
  )
}

function addTorus(
  v: Vec3[],
  f: Face[],
  c: string,
  x: number,
  y: number,
  z: number,
  R: number,
  r: number,
  rot: 'x' | 'y' | 'z' = 'z',
  segments = 30,
  rings = 12,
) {
  const base = v.length
  for (let i = 0; i < segments; i++) {
    const a = (i * 2 * Math.PI) / segments
    for (let j = 0; j < rings; j++) {
      const b = (j * 2 * Math.PI) / rings
      const rad = R + r * Math.cos(b)
      let q: Vec3 = [rad * Math.cos(a), rad * Math.sin(a), r * Math.sin(b)]
      if (rot === 'x') q = [q[0], q[2], q[1]]
      else if (rot === 'y') q = [q[2], q[1], q[0]]
      v.push([x + q[0], y + q[1], z + q[2]])
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < rings; j++) {
      const ni = (i + 1) % segments
      const nj = (j + 1) % rings
      f.push({ idx: [base + i * rings + j, base + ni * rings + j, base + ni * rings + nj, base + i * rings + nj], color: c })
    }
  }
}

function addSphere(v: Vec3[], f: Face[], c: string, x: number, y: number, z: number, r: number, segments = 22, rings = 14) {
  const base = v.length
  for (let j = 0; j <= rings; j++) {
    const b = (Math.PI * j) / rings - Math.PI / 2
    const cb = Math.cos(b)
    const sb = Math.sin(b)
    for (let i = 0; i < segments; i++) {
      const a = (2 * Math.PI * i) / segments
      v.push([x + r * cb * Math.cos(a), y + r * sb, z + r * cb * Math.sin(a)])
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < segments; i++) {
      const ni = (i + 1) % segments
      f.push({
        idx: [base + j * segments + i, base + j * segments + ni, base + (j + 1) * segments + ni, base + (j + 1) * segments + i],
        color: c,
      })
    }
  }
}

function addPrism(v: Vec3[], f: Face[], c: string, pts: [number, number][], z0: number, z1: number) {
  const base = v.length
  pts.forEach((p) => v.push([p[0], p[1], z0]))
  pts.forEach((p) => v.push([p[0], p[1], z1]))
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    f.push({ idx: [base + i, base + j, base + pts.length + j, base + pts.length + i], color: c })
  }
  f.push(
    { idx: Array.from({ length: pts.length }, (_, i) => base + i).reverse(), color: c },
    { idx: Array.from({ length: pts.length }, (_, i) => base + pts.length + i), color: c },
  )
}

function addLine(v: Vec3[], l: LineSeg[], c: string, pts: Vec3[]) {
  const ids: number[] = []
  pts.forEach((p) => {
    ids.push(v.length)
    v.push(p)
  })
  for (let i = 0; i < ids.length - 1; i++) l.push({ a: ids[i], b: ids[i + 1], color: c })
}

export function buildModel(cls: ClassName, r: SyntheticRecord): Model3D {
  const v: Vec3[] = []
  const f: Face[] = []
  const lines: LineSeg[] = []
  const col = MODEL_COLORS[cls] || '#00E5FF'
  const L = Math.max(0.8, Number(r.target_length_m) || 1.5)
  const W = Math.max(0.35, Number(r.target_width_m) || 0.7)
  const H = Math.max(0.12, Number(r.target_height_m) || 0.25)

  if (cls === 'Plane') {
    addCylinder(v, f, col, 0, 0, 0, L * 0.28, H * 0.6, 'x', 20)
    addBox(v, f, col, 0, 0, 0, L * 0.95, H * 0.16, W * 0.16)
    addBox(v, f, col, 0, 0, 0, L * 0.34, H * 0.12, W * 1.35)
    addBox(v, f, col, -L * 0.31, 0, 0, L * 0.18, H * 0.1, W * 0.65)
    // NOTE: the reference dashboard's engine-pod cylinders here are called with one argument
    // short (missing `h`), which shifts 'x'/16 into the h/axis slots and produces NaN vertices -
    // i.e. they render as invisible in the source dashboard too. Omitted rather than ported
    // faithfully-broken, since a NaN-producing call isn't expressible with real parameter types.
  } else if (cls === 'Ship') {
    const pts: [number, number][] = [
      [-L * 0.5, -W * 0.45],
      [L * 0.5, -W * 0.34],
      [L * 0.5, W * 0.34],
      [-L * 0.5, W * 0.45],
    ]
    addPrism(v, f, col, pts, -H * 0.25, H * 0.25)
    addBox(v, f, col, -L * 0.02, 0, H * 0.3, L * 0.5, H * 0.28, W * 0.44)
    addBox(v, f, col, -L * 0.2, 0, H * 0.51, L * 0.19, H * 0.18, W * 0.3)
    addCylinder(v, f, '#A4EFFF', L * 0.04, 0, H * 0.72, H * 0.045, H * 1.7, 'y', 12)
    addBox(v, f, '#7DD3FC', L * 0.25, 0, H * 0.53, L * 0.12, H * 0.14, W * 0.22)
  } else if (cls === 'Pipe') {
    addCylinder(v, f, col, 0, 0, 0, L, H * 0.72, 'x', 26)
    addCylinder(v, f, '#D8C7FF', -L * 0.34, 0, 0, H * 0.07, H * 0.92, 'x', 18)
    addCylinder(v, f, '#D8C7FF', L * 0.34, 0, 0, H * 0.07, H * 0.92, 'x', 18)
  } else if (cls === 'Mine') {
    addSphere(v, f, col, 0, 0, 0, Math.max(W, H, L) * 0.28, 24, 16)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4
      addCylinder(v, f, '#FCA5A5', Math.cos(a) * 0.35, Math.sin(a) * 0.35, 0, 0.04, 0.34, 'y', 10)
    }
  } else if (cls === 'Tire') {
    const R = Math.max(0.35, L * 0.32)
    const rr = Math.max(0.1, W * 0.12)
    addTorus(v, f, col, 0, 0, 0, R, rr, 'x')
    for (let i = 0; i < 18; i++) {
      const a = (i * Math.PI) / 9
      addBox(v, f, '#202A39', Math.cos(a) * R, 0, Math.sin(a) * R, 0.035, 0.15, 0.035)
    }
  } else if (cls === 'Mound') {
    const R = Math.max(0.5, L * 0.35)
    const h = Math.max(0.15, H * 1.2)
    const n = 30
    const base = v.length
    v.push([0, 0, h])
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n
      const rad = R * (0.88 + 0.16 * Math.sin(i * 2.4))
      v.push([rad * Math.cos(a), rad * Math.sin(a), 0])
    }
    for (let i = 0; i < n; i++) f.push({ idx: [base, base + 1 + i, base + 1 + ((i + 1) % n)], color: col })
    addBox(v, f, '#7F6B4F', 0, 0, -0.05, R * 1.8, 0.1, R * 1.8)
  } else if (cls === 'Platform') {
    addBox(v, f, col, 0, 0, H * 0.45, L, W, H * 0.18)
    const n = Math.max(4, Number(r.support_count) || 4)
    const m = Math.max(2, Math.ceil(Math.sqrt(n)))
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) {
        const xx = (i / (m - 1) - 0.5) * L * 0.76
        const zz = (j / (m - 1) - 0.5) * W * 0.76
        addCylinder(v, f, '#8AF7CF', xx, -H * 0.46, zz, H * 0.055, H * 1.9, 'y', 12)
      }
    }
  } else if (cls === 'Mannequin') {
    const B = Math.max(0.9, L)
    addSphere(v, f, col, 0, B * 0.42, 0, B * 0.15)
    addCylinder(v, f, col, 0, B * 0.18, 0, B * 0.17, B * 0.38, 'y', 16)
    addCylinder(v, f, col, -B * 0.26, 0, 0, B * 0.045, B * 0.43, 'x', 12)
    addCylinder(v, f, col, B * 0.26, 0, 0, B * 0.045, B * 0.43, 'x', 12)
    addCylinder(v, f, col, -B * 0.1, -B * 0.28, 0, B * 0.05, B * 0.48, 'y', 12)
    addCylinder(v, f, col, B * 0.1, -B * 0.28, 0, B * 0.05, B * 0.48, 'y', 12)
  } else if (cls === 'Sea Grass') {
    const area = Math.max(2, Number(r.vegetation_patch_area_m2) || 8)
    const vh = Math.max(0.3, Number(r.vegetation_height_m) || 0.9)
    const n = 42
    const side = Math.sqrt(area) * 0.6
    addBox(v, f, '#214A3A', 0, -0.04, 0, side, 0.08, side)
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n
      const rad = side * 0.46 * Math.sqrt((i + 1) / n)
      const x = Math.cos(a) * rad
      const z = Math.sin(a) * rad
      const bend = 0.1 * Math.sin(i * 1.35)
      addLine(v, lines, '#66FF9A', [
        [x, 0, z],
        [x + bend, vh * 0.48, z + bend],
        [x - bend * 0.4, vh, z],
      ])
    }
  } else if (cls === 'Mud') {
    const R = Math.max(0.9, L * 0.45)
    const n = 14
    const sz = R * 2
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x = -R + (i * sz) / (n - 1)
        const z = -R + (j * sz) / (n - 1)
        const y = 0.025 * Math.sin(i * 1.5 + j * 0.9)
        v.push([x, y, z])
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - 1; j++) {
        const a = i * n + j
        f.push({ idx: [a, a + 1, a + n + 1, a + n], color: '#6E7886' })
      }
    }
  } else if (cls === 'Rock') {
    const rad = Math.max(0.35, Math.max(L, W, H) * 0.32)
    const n = 16
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n
      v.push([Math.cos(a) * rad * (0.78 + 0.28 * Math.sin(i * 2.1)), 0, Math.sin(a) * rad * (0.78 + 0.18 * Math.cos(i * 1.7))])
    }
    v.push([0, rad * (0.82 + 0.34 * (Number(r.rock_roundness) || 0.5)), 0])
    const top = v.length - 1
    for (let i = 0; i < n; i++) f.push({ idx: [top, i, (i + 1) % n], color: col })
    addBox(v, f, '#514B46', 0, -rad * 0.34, 0, rad * 1.75, 0.16, rad * 1.75)
  } else if (cls === 'Ghost Net') {
    const area = Math.max(3, Number(r.net_area_m2) || 18)
    const side = Math.sqrt(area)
    const mesh = Math.max(0.09, Number(r.mesh_size_mm) || 180) / 1000
    const n = Math.max(6, Math.min(18, Math.round(side / Math.max(mesh, 0.15))))
    for (let i = 0; i < n; i++) {
      const x = -side / 2 + (i * side) / (n - 1)
      const pts: Vec3[] = []
      for (let j = 0; j < n; j++) {
        const z = -side / 2 + (j * side) / (n - 1)
        const y = 0.1 * Math.sin(i * 0.75 + j * 1.1) - 0.03 * j
        pts.push([x, y, z])
      }
      addLine(v, lines, '#C4B5FD', pts)
    }
    for (let j = 0; j < n; j++) {
      const z = -side / 2 + (j * side) / (n - 1)
      const pts: Vec3[] = []
      for (let i = 0; i < n; i++) {
        const x = -side / 2 + (i * side) / (n - 1)
        const y = 0.1 * Math.sin(i * 0.75 + j * 1.1) - 0.03 * j
        pts.push([x, y, z])
      }
      addLine(v, lines, '#A78BFA', pts)
    }
  }

  return { v, f, lines }
}

export function modelToPlotly(model: Model3D, color: string): Partial<Data> {
  const X: number[] = []
  const Y: number[] = []
  const Z: number[] = []
  const I: number[] = []
  const J: number[] = []
  const K: number[] = []
  const FC: string[] = []
  for (const face of model.f) {
    const ids = face.idx
    for (let q = 1; q < ids.length - 1; q++) {
      const a = ids[0]
      const b = ids[q]
      const c = ids[q + 1]
      const idx = X.length
      X.push(model.v[a][0], model.v[b][0], model.v[c][0])
      Y.push(model.v[a][1], model.v[b][1], model.v[c][1])
      Z.push(model.v[a][2], model.v[b][2], model.v[c][2])
      I.push(idx)
      J.push(idx + 1)
      K.push(idx + 2)
      FC.push(face.color || color)
    }
  }
  return {
    type: 'mesh3d',
    x: X,
    y: Y,
    z: Z,
    i: I,
    j: J,
    k: K,
    facecolor: FC,
    flatshading: false,
    lighting: { ambient: 0.48, diffuse: 0.72, specular: 0.55, roughness: 0.38, fresnel: 0.08 },
    lightposition: { x: 80, y: 120, z: 100 },
    hoverinfo: 'skip',
    opacity: 0.94,
    color,
  } as Partial<Data>
}

export function linesToPlotly(model: Model3D): Partial<Data>[] {
  return model.lines.map((ln) => {
    const a = model.v[ln.a]
    const b = model.v[ln.b]
    return {
      type: 'scatter3d',
      mode: 'lines',
      x: [a[0], b[0]],
      y: [a[1], b[1]],
      z: [a[2], b[2]],
      line: { color: ln.color, width: 4 },
      hoverinfo: 'skip',
      showlegend: false,
    } as Partial<Data>
  })
}

export function groundTrace(r: SyntheticRecord): Partial<Data> {
  const s = Math.max(3, Math.max(Number(r.target_length_m) || 2, Number(r.target_width_m) || 2) * 1.5)
  const n = 12
  const x: number[] = []
  const y: number[] = []
  const z: number[] = []
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      x.push(-s + (2 * s * i) / n)
      y.push(-0.2)
      z.push(-s + (2 * s * j) / n)
    }
  }
  const idx = (i: number, j: number) => i * (n + 1) + j
  const I: number[] = []
  const J: number[] = []
  const K: number[] = []
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = idx(i, j)
      const b = idx(i + 1, j)
      const c = idx(i + 1, j + 1)
      const d = idx(i, j + 1)
      I.push(a, a)
      J.push(b, c)
      K.push(c, d)
    }
  }
  return {
    type: 'mesh3d',
    x,
    y,
    z,
    i: I,
    j: J,
    k: K,
    color: '#334155',
    opacity: 0.42,
    hoverinfo: 'skip',
    flatshading: true,
    lighting: { ambient: 0.75, diffuse: 0.2, specular: 0.05 },
  } as Partial<Data>
}

export function shadowTrace(r: SyntheticRecord): Partial<Data> {
  const a = Math.max(0.2, Number(r.shadow_length_m) || 0.5)
  const b = Math.max(0.15, Number(r.shadow_width_m) || 0.25)
  const pts = 44
  const x: number[] = []
  const y: number[] = []
  const z: number[] = []
  for (let i = 0; i < pts; i++) {
    const t = (2 * Math.PI * i) / (pts - 1)
    x.push(a * 0.5 * (Math.cos(t) + 1))
    y.push(-0.17)
    z.push(b * Math.sin(t))
  }
  return {
    type: 'scatter3d',
    mode: 'lines',
    x,
    y,
    z,
    line: { color: '#020617', width: 10 },
    opacity: 0.55,
    hoverinfo: 'skip',
    showlegend: false,
  } as Partial<Data>
}

export function axesTraces(r: SyntheticRecord): Partial<Data>[] {
  const L = Math.max(0.8, Number(r.target_length_m) || 1)
  const W = Math.max(0.4, Number(r.target_width_m) || 0.5)
  const H = Math.max(0.2, Number(r.target_height_m) || 0.25)
  return [
    {
      type: 'scatter3d',
      mode: 'lines+text',
      x: [-L / 2, L / 2],
      y: [-W / 2 - 0.5, -W / 2 - 0.5],
      z: [-H / 2 - 0.5, -H / 2 - 0.5],
      line: { color: '#00E5FF', width: 5 },
      text: ['', 'L'],
      textposition: 'middle right',
      hoverinfo: 'skip',
      showlegend: false,
    } as Partial<Data>,
    {
      type: 'scatter3d',
      mode: 'lines+text',
      x: [-L / 2 - 0.5, -L / 2 - 0.5],
      y: [-W / 2, W / 2],
      z: [-H / 2 - 0.5, -H / 2 - 0.5],
      line: { color: '#FF4ECD', width: 5 },
      text: ['', 'W'],
      textposition: 'middle left',
      hoverinfo: 'skip',
      showlegend: false,
    } as Partial<Data>,
    {
      type: 'scatter3d',
      mode: 'lines+text',
      x: [L / 2 + 0.55, L / 2 + 0.55],
      y: [0, 0],
      z: [-H / 2, H / 2],
      line: { color: '#00F5A0', width: 5 },
      text: ['', 'H'],
      textposition: 'top right',
      hoverinfo: 'skip',
      showlegend: false,
    } as Partial<Data>,
  ]
}

export const CAMERA_PRESETS: Record<'iso' | 'front' | 'top' | 'side', { x: number; y: number; z: number }> = {
  iso: { x: 1.7, y: 1.35, z: 1.05 },
  front: { x: 0, y: 1.9, z: 0.35 },
  top: { x: 0.01, y: 0.01, z: 2.4 },
  side: { x: 2.4, y: 0.01, z: 0.35 },
}
