"""Risk scoring stage: a transparent, weighted rule-based formula - NOT a learned black box - so
it can be explained line-by-line to non-technical stakeholders/judges.

computed_score = 0.40 * calibrated_confidence
               + 0.30 * artificial_score
               + 0.15 * size_score              (normalized estimated object footprint)
               + 0.15 * (1 - domain_shift_penalty)

Tiers (by computed_score): Ignore < 0.25 <= Human Review < 0.50 <= Probable Debris < 0.75 <=
High-Confidence Hazard.

One precautionary override sits on top of the formula: detections of ecologically sensitive
classes (currently ghost nets and loose anchor chain - entanglement/smothering hazards) are never
auto-dismissed as "Ignore" even if their composite score is low, since a missed ghost net has a
much worse downside than a false positive a human reviewer clears in seconds.

Every weight and intermediate term is returned alongside the final score/tier so the API and
frontend can display *why* a detection landed in its tier, not just the number.
"""
from dataclasses import asdict, dataclass

from app.core.logging import get_logger
from app.ml.types import CalibratedDetection, PipelineContext, ScoredDetection

logger = get_logger(__name__)

WEIGHT_CALIBRATED_CONFIDENCE = 0.40
WEIGHT_ARTIFICIAL_SCORE = 0.30
WEIGHT_SIZE = 0.15
WEIGHT_DOMAIN_TRUST = 0.15

TIER_IGNORE = "ignore"
TIER_HUMAN_REVIEW = "human_review"
TIER_PROBABLE_DEBRIS = "probable_debris"
TIER_HIGH_CONFIDENCE_HAZARD = "high_confidence_hazard"

TIER_ORDER = [TIER_IGNORE, TIER_HUMAN_REVIEW, TIER_PROBABLE_DEBRIS, TIER_HIGH_CONFIDENCE_HAZARD]

ECOLOGICALLY_SENSITIVE_CLASSES = {"ghost_net", "anchor_chain"}

# Sonar devices / sites represented in the (synthetic/bootstrap) training distribution. Anything
# outside this list is, by definition, a domain shift for this prototype's model - a real
# deployment would populate this from the actual training manifest.
KNOWN_TRAINING_DEVICES = {"klein-3000", "edgetech-4205", "edgetech-6205", "klsg-reference"}
KNOWN_TRAINING_SITES = {"seabedobjects-klsg", "ai4shipwrecks-style"}

SIZE_REFERENCE_M2 = 25.0  # size at which size_score saturates to 1.0


@dataclass
class RiskWeights:
    calibrated_confidence: float = WEIGHT_CALIBRATED_CONFIDENCE
    artificial_score: float = WEIGHT_ARTIFICIAL_SCORE
    size: float = WEIGHT_SIZE
    domain_trust: float = WEIGHT_DOMAIN_TRUST


def estimate_domain_shift_penalty(sonar_device_id: str | None, site_name: str | None) -> float:
    """0.0 = fully in-distribution, 1.0 = fully out-of-distribution. Simple, inspectable rule:
    unknown device -> +0.4, unknown site -> +0.3, stacking (capped at 1.0)."""
    penalty = 0.0
    if not sonar_device_id or sonar_device_id.lower() not in KNOWN_TRAINING_DEVICES:
        penalty += 0.4
    if not site_name or site_name.lower() not in KNOWN_TRAINING_SITES:
        penalty += 0.3
    return min(1.0, round(penalty, 2))


def estimate_size_m2(bbox_area_px: int, m_per_px: float) -> float:
    return round(bbox_area_px * (m_per_px**2), 3)


def _tier_from_score(score: float) -> str:
    if score >= 0.75:
        return TIER_HIGH_CONFIDENCE_HAZARD
    if score >= 0.50:
        return TIER_PROBABLE_DEBRIS
    if score >= 0.25:
        return TIER_HUMAN_REVIEW
    return TIER_IGNORE


def score_detection(
    det: CalibratedDetection, ctx: PipelineContext, weights: RiskWeights = RiskWeights()
) -> ScoredDetection:
    size_m2 = estimate_size_m2(det.bbox.area(), ctx.across_track_resolution_m_per_px)
    size_score = min(1.0, size_m2 / SIZE_REFERENCE_M2)
    domain_shift_penalty = estimate_domain_shift_penalty(ctx.sonar_device_id, ctx.site_name)

    computed_score = (
        weights.calibrated_confidence * det.calibrated_confidence
        + weights.artificial_score * det.artificial_score
        + weights.size * size_score
        + weights.domain_trust * (1 - domain_shift_penalty)
    )
    computed_score = round(min(1.0, max(0.0, computed_score)), 4)

    tier = _tier_from_score(computed_score)
    ecological_flag = det.class_label in ECOLOGICALLY_SENSITIVE_CLASSES
    if ecological_flag and TIER_ORDER.index(tier) < TIER_ORDER.index(TIER_HUMAN_REVIEW):
        tier = TIER_HUMAN_REVIEW

    return ScoredDetection(
        bbox=det.bbox,
        class_label=det.class_label,
        raw_confidence=det.raw_confidence,
        is_artificial=det.is_artificial,
        artificial_score=det.artificial_score,
        shape_regularity=det.shape_regularity,
        shadow_length_px=det.shadow_length_px,
        texture_variance=det.texture_variance,
        calibrated_confidence=det.calibrated_confidence,
        size_estimate_m2=size_m2,
        domain_shift_penalty=domain_shift_penalty,
        ecological_flag=ecological_flag,
        risk_tier=tier,
        computed_score=computed_score,
    )


def explain_weights() -> dict:
    return asdict(RiskWeights())
