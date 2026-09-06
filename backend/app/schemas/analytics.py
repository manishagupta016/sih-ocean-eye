from pydantic import BaseModel, ConfigDict


class PerformanceMetrics(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_version: str
    source: str  # "measured" once scripts/evaluate_detector.py has run, else "illustrative_demo"
    note: str | None = None
    precision: float
    recall: float
    map50: float
    map50_95: float
    false_positive_rate: float
    per_class: dict[str, dict[str, float]]


class CalibrationBin(BaseModel):
    bin_lower: float
    bin_upper: float
    confidence_mean: float
    accuracy_mean: float
    sample_count: int


class CalibrationReport(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_version: str
    source: str  # "measured" once scripts/train_calibrator_from_real_data.py has run, else "illustrative_demo"
    note: str | None = None
    expected_calibration_error: float
    bins: list[CalibrationBin]


class CrossDomainRow(BaseModel):
    train_domain: str
    test_domain: str
    map50_in_domain: float
    map50_cross_domain: float
    accuracy_drop_pct: float
    note: str | None = None


class CrossDomainReport(BaseModel):
    source: str  # "measured" once scripts/cross_domain_eval.py has run, else "illustrative_demo"
    note: str | None = None
    rows: list[CrossDomainRow]


class LatencyStats(BaseModel):
    stage: str
    p50_ms: float
    p95_ms: float
    avg_fps: float


class LatencyReport(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_version: str
    stages: list[LatencyStats]
    end_to_end_p50_ms: float
    end_to_end_p95_ms: float


class DashboardSummary(BaseModel):
    surveys_processed: int
    anomalies_found: int
    high_risk_pending_review: int
    active_alerts: int
