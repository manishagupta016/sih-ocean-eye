"""In-process rolling latency recorder, per pipeline stage, feeding the Analytics latency/FPS
chart. A single-process demo store is sufficient here; a multi-worker deployment would swap this
for a Redis list/stream (the read/write surface below is small enough to do that as a drop-in
later without touching callers).
"""
import statistics
import threading
from collections import defaultdict, deque

_MAX_SAMPLES = 500
_lock = threading.Lock()
_samples: dict[str, deque] = defaultdict(lambda: deque(maxlen=_MAX_SAMPLES))


def record_latency(stage: str, latency_ms: float) -> None:
    with _lock:
        _samples[stage].append(latency_ms)


def get_stage_stats(stage: str) -> dict:
    with _lock:
        values = list(_samples[stage])
    if not values:
        return {"stage": stage, "p50_ms": 0.0, "p95_ms": 0.0, "avg_fps": 0.0}
    values_sorted = sorted(values)
    p50 = statistics.median(values_sorted)
    p95_idx = min(len(values_sorted) - 1, int(round(0.95 * (len(values_sorted) - 1))))
    p95 = values_sorted[p95_idx]
    avg_ms = statistics.mean(values_sorted)
    avg_fps = 1000.0 / avg_ms if avg_ms > 0 else 0.0
    return {"stage": stage, "p50_ms": round(p50, 2), "p95_ms": round(p95, 2), "avg_fps": round(avg_fps, 2)}


def get_all_stage_stats() -> list[dict]:
    with _lock:
        stages = list(_samples.keys())
    return [get_stage_stats(s) for s in stages]


def get_end_to_end_percentiles() -> tuple[float, float]:
    return get_stage_stats("end_to_end")["p50_ms"], get_stage_stats("end_to_end")["p95_ms"]
