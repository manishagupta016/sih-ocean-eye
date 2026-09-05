import { AlertTriangle, Eye, ShieldAlert, ShieldQuestion } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { RISK_TIER_LABELS } from '@/lib/format'
import type { RiskTier } from '@/api/types'
import { cn } from '@/lib/utils'

const TIER_STYLE: Record<RiskTier, string> = {
  ignore: 'border-transparent bg-tier-ignore/15 text-tier-ignore',
  human_review: 'border-transparent bg-tier-human-review/15 text-tier-human-review',
  probable_debris: 'border-transparent bg-tier-probable-debris/15 text-tier-probable-debris',
  high_confidence_hazard: 'border-transparent bg-tier-hazard/15 text-tier-hazard',
}

const TIER_ICON: Record<RiskTier, typeof Eye> = {
  ignore: Eye,
  human_review: ShieldQuestion,
  probable_debris: ShieldAlert,
  high_confidence_hazard: AlertTriangle,
}

export function RiskTierBadge({ tier, className }: { tier: RiskTier; className?: string }) {
  const Icon = TIER_ICON[tier]
  return (
    <Badge className={cn(TIER_STYLE[tier], className)}>
      <Icon className="h-3 w-3" />
      {RISK_TIER_LABELS[tier]}
    </Badge>
  )
}
