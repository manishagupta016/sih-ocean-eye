import type { Archetype } from '@/lib/schematicShape'

/** Coarse geometric family per reference class, used only to pick an illustrative height
 * proportion and default footprint shape - no per-class measurements are implied. */
export const CLASS_ARCHETYPE: Record<string, Archetype> = {
  planes: 'elongated',
  'ships-shipwrecks': 'elongated',
  pipes: 'elongated',
  mines: 'compact',
  tires: 'compact',
  mounds: 'low-relief',
  platforms: 'low-relief',
  mannequins: 'elongated',
  seagrass: 'low-relief',
  mud: 'low-relief',
  rocks: 'compact',
  'ghost-nets': 'low-relief',
}

export const CAMERA_PRESETS: Record<string, { x: number; y: number; z: number }> = {
  isometric: { x: 1.5, y: 1.5, z: 1.1 },
  front: { x: 0.001, y: -2.4, z: 0.5 },
  top: { x: 0.001, y: 0.001, z: 2.8 },
  side: { x: 2.6, y: 0.001, z: 0.5 },
}

export function detectionDifficulty(calibratedConfidence: number): 'Easy' | 'Medium' | 'Hard' {
  if (calibratedConfidence >= 0.8) return 'Easy'
  if (calibratedConfidence >= 0.5) return 'Medium'
  return 'Hard'
}
