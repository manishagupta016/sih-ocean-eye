import type { DetectionWithContext, RiskTier } from '@/api/types'
import { classLabelToTitle } from '@/lib/format'

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function joinWithAnd(parts: string[]): string {
  if (parts.length <= 1) return parts.join('')
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}

// Plain-language stand-ins for the risk tiers, ordered most to least urgent. Each is a function
// of the count so singular phrasing ("1 looks like...") agrees grammatically with plural ("2 look
// like...").
const TIER_PLAIN_TEXT: Record<RiskTier, (count: number) => string> = {
  high_confidence_hazard: (n) =>
    n === 1 ? 'looks like a serious hazard that needs urgent attention' : 'look like serious hazards that need urgent attention',
  probable_debris: (n) => (n === 1 ? 'looks like likely debris' : 'look like likely debris'),
  human_review: (n) =>
    n === 1
      ? "is set aside for a person to double-check - the system isn't sure either way"
      : "are set aside for a person to double-check - the system isn't sure either way",
  ignore: (n) => (n === 1 ? 'is low priority and probably nothing to worry about' : 'are low priority and probably nothing to worry about'),
}
const TIER_ORDER: RiskTier[] = ['high_confidence_hazard', 'probable_debris', 'human_review', 'ignore']

/**
 * Builds a plain-language paragraph describing the currently-visible detections, aimed at
 * someone with no sonar/ML background - deliberately avoids jargon like "calibrated confidence",
 * "risk tier", or "navigation metadata". Generated deterministically from the same fields shown
 * in the detection cards below it (not a separate model call), so nothing here is invented -
 * every claim traces to a number the operator can also see and drill into.
 */
export function summarizeDetections(detections: DetectionWithContext[], sensitivityPct: number): string {
  if (detections.length === 0) {
    return `Nothing stood out at the current sensitivity level (${sensitivityPct}%). Try lowering the slider to see fainter possible objects, or this scan may simply be clear.`
  }

  const total = detections.length
  const artificialCount = detections.filter((d) => d.is_artificial).length
  const naturalCount = total - artificialCount
  const geolocatedCount = detections.filter((d) => d.has_geo_metadata).length
  const imageSpaceCount = total - geolocatedCount
  const ecologicalCount = detections.filter((d) => d.risk_score?.ecological_flag).length

  const tierCounts: Record<RiskTier, number> = {
    ignore: 0,
    human_review: 0,
    probable_debris: 0,
    high_confidence_hazard: 0,
  }
  for (const d of detections) {
    const tier = d.risk_score?.risk_tier
    if (tier) tierCounts[tier] += 1
  }

  const classCounts = new Map<string, number>()
  for (const d of detections) {
    classCounts.set(d.class_label, (classCounts.get(d.class_label) ?? 0) + 1)
  }
  const topClasses = [...classCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  const topClassText = joinWithAnd(topClasses.map(([label, count]) => pluralize(count, classLabelToTitle(label))))

  const sentences: string[] = []

  sentences.push(`This scan has ${pluralize(total, 'spot')} worth a closer look.`)

  if (artificialCount === 0) {
    sentences.push('None of them look clearly man-made - they mostly resemble natural seafloor shapes, like rocks or sediment ripples.')
  } else if (naturalCount === 0) {
    sentences.push('All of them look man-made rather than natural seafloor features.')
  } else {
    sentences.push(
      `${artificialCount} of them look man-made, and ${naturalCount} look like ${naturalCount === 1 ? 'it could just be a' : 'they could just be'} natural seafloor shape${naturalCount === 1 ? '' : 's'} (rocks, sediment, etc.).`,
    )
  }

  sentences.push(`The most common thing${topClasses.length > 1 ? 's' : ''} spotted: ${topClassText}.`)

  const tierPhrase = joinWithAnd(
    TIER_ORDER.filter((t) => tierCounts[t] > 0).map((t) => `${tierCounts[t]} ${TIER_PLAIN_TEXT[t](tierCounts[t])}`),
  )
  sentences.push(`In terms of priority: ${tierPhrase}.`)

  if (imageSpaceCount === 0) {
    sentences.push(`We know exactly where all ${total} of these are on the map, since this file included GPS/location data.`)
  } else if (geolocatedCount === 0) {
    sentences.push(
      `We don't yet know exactly where on the map these are - this file didn't come with GPS/location data, so they won't appear on the map until a file with that data is uploaded.`,
    )
  } else {
    sentences.push(
      `${geolocatedCount} of the ${total} have a confirmed real-world location; the other ${imageSpaceCount} don't, since GPS/location data wasn't included for ${imageSpaceCount === 1 ? 'it' : 'them'}.`,
    )
  }

  if (ecologicalCount > 0) {
    sentences.push(
      `${pluralize(ecologicalCount, 'spot')} ${ecologicalCount === 1 ? 'falls' : 'fall'} into a category we always have a person double-check by hand (like fishing nets that can trap marine life), no matter what score ${ecologicalCount === 1 ? 'it' : 'they'} got.`,
    )
  }

  return sentences.join(' ')
}
