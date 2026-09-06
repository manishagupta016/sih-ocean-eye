// Mirrors backend/app/schemas/*.py exactly - keep in sync with the FastAPI OpenAPI contract.
// (Swap for `openapi-typescript`-generated types once the backend is deployed somewhere this
// build can reach; hand-written for now so the frontend can be developed against a stable,
// documented contract per the project's build order.)

export type UserRole = 'operator' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  created_at: string
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface ApiKeyRead {
  id: string
  label: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
  revoked: boolean
}

export interface ApiKeyCreated {
  id: string
  label: string
  api_key: string
  created_at: string
}

export interface Survey {
  id: string
  user_id: string
  name: string
  location_name: string | null
  uploaded_at: string
  sonar_format: string | null
  notes: string | null
}

export interface SurveySummary extends Survey {
  sonar_file_count: number
  detection_count: number
  high_risk_count: number
}

export type SonarFileType = 'image' | 'xtf' | 'jsf' | 'sdf'

export type IngestStatus =
  | 'queued'
  | 'preprocessing'
  | 'detecting'
  | 'discriminating'
  | 'calibrating'
  | 'scoring'
  | 'geolocating'
  | 'done'
  | 'failed'

export interface SonarFile {
  id: string
  survey_id: string
  file_path: string
  file_type: SonarFileType
  ingested_at: string
  status: IngestStatus
  status_message: string | null
  has_nav_metadata: boolean
  model_name?: string | null
  model_is_fallback?: boolean | null
  model_provenance?: string | null
}

export interface UploadResponse {
  sonar_file: SonarFile
  job_id: string
}

export interface JobStatus {
  job_id: string
  sonar_file_id: string
  status: IngestStatus
  progress_pct: number
  message?: string | null
  detection_count?: number | null
}

export interface BBox {
  x: number
  y: number
  w: number
  h: number
}

export type RiskTier = 'ignore' | 'human_review' | 'probable_debris' | 'high_confidence_hazard'

export interface RiskScoreRead {
  size_estimate: number
  domain_shift_penalty: number
  ecological_flag: boolean
  risk_tier: RiskTier
  computed_score: number
}

export interface DetectionRead {
  id: string
  sonar_file_id: string
  bbox: BBox
  class_label: string
  raw_confidence: number
  calibrated_confidence: number
  is_artificial: boolean
  artificial_score: number
  has_geo_metadata: boolean
  latitude: number | null
  longitude: number | null
  created_at: string
  risk_score: RiskScoreRead | null
}

export interface DetectionWithContext extends DetectionRead {
  survey_id: string
  survey_name: string
  sonar_file_path: string
}

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface AlertRead {
  id: string
  detection_id: string
  severity: AlertSeverity
  message: string
  acknowledged: boolean
  created_at: string
}

export interface AlertWithContext extends AlertRead {
  survey_id: string
  survey_name: string
  class_label: string
  risk_tier: string | null
}

export type ReportFormat = 'csv' | 'json'

export interface ReportRead {
  id: string
  survey_id: string
  generated_at: string
  format: ReportFormat
  file_path: string
}

export interface ModelVersionRead {
  id: string
  name: string
  version: string
  trained_on: string
  metrics_json: Record<string, unknown>
}

export interface PerformanceMetrics {
  model_version: string
  source: string
  note?: string | null
  precision: number
  recall: number
  map50: number
  map50_95: number
  false_positive_rate: number
  per_class: Record<string, { precision: number; recall: number; map50: number }>
}

export interface CalibrationBin {
  bin_lower: number
  bin_upper: number
  confidence_mean: number
  accuracy_mean: number
  sample_count: number
}

export interface CalibrationReport {
  model_version: string
  source: string
  note?: string | null
  expected_calibration_error: number
  bins: CalibrationBin[]
}

export interface CrossDomainRow {
  train_domain: string
  test_domain: string
  map50_in_domain: number
  map50_cross_domain: number
  accuracy_drop_pct: number
  note?: string | null
}

export interface CrossDomainReport {
  source: string
  note?: string | null
  rows: CrossDomainRow[]
}

export interface LatencyStats {
  stage: string
  p50_ms: number
  p95_ms: number
  avg_fps: number
}

export interface LatencyReport {
  model_version: string
  stages: LatencyStats[]
  end_to_end_p50_ms: number
  end_to_end_p95_ms: number
}

export interface DashboardSummary {
  surveys_processed: number
  anomalies_found: number
  high_risk_pending_review: number
  active_alerts: number
}

export interface RiskFormula {
  weights: {
    calibrated_confidence: number
    artificial_score: number
    size: number
    domain_trust: number
  }
  tiers: Record<string, string>
  ecological_override: { classes: string[]; rule: string }
  size_reference_m2: number
  known_training_devices: string[]
  known_training_sites: string[]
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
  }
}
