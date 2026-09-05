import type { RiskTier } from '@/api/types'

export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffSec = Math.round(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay}d ago`
}

export const RISK_TIER_LABELS: Record<RiskTier, string> = {
  ignore: 'Ignore',
  human_review: 'Human Review',
  probable_debris: 'Probable Debris',
  high_confidence_hazard: 'High-Confidence Hazard',
}

export const RISK_TIER_COLOR_VAR: Record<RiskTier, string> = {
  ignore: 'var(--color-tier-ignore)',
  human_review: 'var(--color-tier-human-review)',
  probable_debris: 'var(--color-tier-probable-debris)',
  high_confidence_hazard: 'var(--color-tier-hazard)',
}

export function classLabelToTitle(label: string): string {
  return label
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
