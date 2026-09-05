"""Shared dataclasses passed between pipeline stages (detector -> discriminator -> calibrator ->
risk scorer -> geolocator). Keeping these as plain dataclasses (not ORM models) decouples the ML
code from the database layer so the detection worker can be extracted into a standalone,
horizontally-scalable service later without dragging SQLAlchemy along.
"""
from dataclasses import dataclass, field


@dataclass
class BBox:
    x: int
    y: int
    w: int
    h: int

    def area(self) -> int:
        return self.w * self.h

    def as_dict(self) -> dict:
        return {"x": self.x, "y": self.y, "w": self.w, "h": self.h}


@dataclass
class RawDetection:
    bbox: BBox
    class_label: str
    raw_confidence: float


@dataclass
class DiscriminatedDetection(RawDetection):
    is_artificial: bool = False
    artificial_score: float = 0.0
    shape_regularity: float = 0.0
    shadow_length_px: float = 0.0
    texture_variance: float = 0.0


@dataclass
class CalibratedDetection(DiscriminatedDetection):
    calibrated_confidence: float = 0.0


@dataclass
class ScoredDetection(CalibratedDetection):
    size_estimate_m2: float = 0.0
    domain_shift_penalty: float = 0.0
    ecological_flag: bool = False
    risk_tier: str = "ignore"
    computed_score: float = 0.0


@dataclass
class GeolocatedDetection(ScoredDetection):
    has_geo_metadata: bool = False
    latitude: float | None = None
    longitude: float | None = None


@dataclass
class NavPing:
    """One navigation record parsed from a sidecar nav log, when available."""

    timestamp: float
    latitude: float
    longitude: float
    heading_deg: float
    range_m: float


@dataclass
class PipelineContext:
    """Carries per-file metadata that later stages need (nav track, sonar device id, etc.)."""

    sonar_device_id: str | None = None
    site_name: str | None = None
    image_width: int = 0
    image_height: int = 0
    across_track_resolution_m_per_px: float = 0.02  # nominal default; overridden if nav/range known
    nav_track: list[NavPing] = field(default_factory=list)
