import { Gauge, MapPinned, ScanSearch, ShieldCheck, Waves, type LucideIcon } from 'lucide-react'
import type { IngestStatus } from '@/api/types'

export interface PipelineStage {
  key: string
  icon: LucideIcon
  title: string
  description: string
  /** IngestStatus values that mean "this stage is the one currently running/last reached". */
  statuses: IngestStatus[]
}

/**
 * The real detect -> discriminate -> calibrate -> score -> geolocate pipeline (see
 * backend/app/services/pipeline.py and README.md). Single source of truth so the Landing page and
 * the Results page describe the exact same stages instead of two hand-maintained copies.
 */
export const PIPELINE_STAGES: PipelineStage[] = [
  {
    key: 'detect',
    icon: ScanSearch,
    title: 'Detect',
    description: 'Locates candidate objects in the side-scan sonar waterfall image.',
    statuses: ['queued', 'preprocessing', 'detecting'],
  },
  {
    key: 'discriminate',
    icon: Waves,
    title: 'Discriminate',
    description: 'Scores each candidate natural vs. artificial from shape, shadow and texture.',
    statuses: ['discriminating'],
  },
  {
    key: 'calibrate',
    icon: Gauge,
    title: 'Calibrate',
    description: 'Isotonic calibration turns raw confidence into a trustworthy probability.',
    statuses: ['calibrating'],
  },
  {
    key: 'score',
    icon: ShieldCheck,
    title: 'Risk-score',
    description: 'A transparent, inspectable formula assigns one of four risk tiers.',
    statuses: ['scoring'],
  },
  {
    key: 'geolocate',
    icon: MapPinned,
    title: 'Geolocate',
    description: 'Coordinates attach only when real navigation metadata is present.',
    statuses: ['geolocating', 'done'],
  },
]
