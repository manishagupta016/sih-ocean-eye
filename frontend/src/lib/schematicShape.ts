/**
 * Generates a schematic 3D solid (a superellipsoid mesh) for the "3D Models" page.
 *
 * This is NOT a photogrammetric or point-cloud reconstruction - no such data exists in this
 * pipeline. It is a dataset-driven illustration: footprint length/width come from the real
 * detection's bounding box and size estimate, and surface roundness is interpolated from the
 * real `shape_regularity` signal (higher = more rectilinear/man-made, matching what that feature
 * actually measures). Height is an illustrative proportion only, since no vertical/relief
 * measurement exists in this pipeline - callers must label it as such.
 */

export type Archetype = 'elongated' | 'compact' | 'low-relief'

export interface SchematicParams {
  /** width / length, in (0, 1] - from the detection's bbox aspect ratio when available. */
  aspectRatio: number
  /** Overall length scale in meters (illustrative if no real size estimate exists). */
  scaleM: number
  /** 0..1 - real `shape_regularity` when available; higher = boxier/more regular. */
  roundness: number
  archetype: Archetype
}

export interface Mesh3DGeometry {
  x: number[]
  y: number[]
  z: number[]
  i: number[]
  j: number[]
  k: number[]
}

const SEGMENTS = 18

function signedPow(v: number, p: number): number {
  return Math.sign(v) * Math.abs(v) ** p
}

const HEIGHT_FACTOR: Record<Archetype, number> = {
  elongated: 0.26,
  compact: 0.65,
  'low-relief': 0.12,
}

export function buildSchematicMesh({ aspectRatio, scaleM, roundness, archetype }: SchematicParams): Mesh3DGeometry {
  // Superellipsoid exponent: real shape_regularity drives box-like (small eps) vs rounded (eps~1.1).
  const eps = Math.max(0.3, Math.min(1.2, 1.2 - roundness))

  const a = scaleM / 2
  const b = (scaleM * Math.max(0.15, Math.min(1, aspectRatio))) / 2
  const c = scaleM * HEIGHT_FACTOR[archetype]

  const x: number[] = []
  const y: number[] = []
  const z: number[] = []
  const stride = SEGMENTS + 1

  for (let ui = 0; ui <= SEGMENTS; ui++) {
    const eta = -Math.PI / 2 + (Math.PI * ui) / SEGMENTS
    const ce = Math.cos(eta)
    const se = Math.sin(eta)
    for (let vi = 0; vi <= SEGMENTS; vi++) {
      const omega = -Math.PI + (2 * Math.PI * vi) / SEGMENTS
      const cw = Math.cos(omega)
      const sw = Math.sin(omega)
      x.push(a * signedPow(ce, eps) * signedPow(cw, eps))
      y.push(b * signedPow(ce, eps) * signedPow(sw, eps))
      z.push(c * signedPow(se, eps) + c) // sit on top of the seabed plane (z=0)
    }
  }

  const i: number[] = []
  const j: number[] = []
  const k: number[] = []
  for (let ui = 0; ui < SEGMENTS; ui++) {
    for (let vi = 0; vi < SEGMENTS; vi++) {
      const p0 = ui * stride + vi
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
