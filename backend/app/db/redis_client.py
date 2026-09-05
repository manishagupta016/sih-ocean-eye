"""Redis-backed job-status store, with an in-memory fallback for local dev without Redis.

Used to track background pipeline job progress (queued -> preprocessing -> detecting ->
discriminating -> calibrating -> scoring -> geolocating -> done/failed) so the frontend can
poll (or receive a WebSocket push) without holding an HTTP request open during heavy inference.
"""
import json
import time
from typing import Any, Optional

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_memory_store: dict[str, str] = {}
_redis_client = None
_redis_unavailable = False


def _get_redis():
    global _redis_client, _redis_unavailable
    if _redis_unavailable:
        return None
    if _redis_client is None:
        try:
            import redis

            _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=1)
            _redis_client.ping()
        except Exception as exc:  # noqa: BLE001 - fall back gracefully
            logger.warning("redis_unavailable_falling_back_to_memory", error=str(exc))
            _redis_unavailable = True
            _redis_client = None
    return _redis_client


def set_job_status(job_id: str, status: dict[str, Any], ttl_seconds: int = 3600) -> None:
    payload = json.dumps({**status, "updated_at": time.time()})
    client = _get_redis()
    if client is not None:
        client.set(f"job:{job_id}", payload, ex=ttl_seconds)
    else:
        _memory_store[f"job:{job_id}"] = payload


def get_job_status(job_id: str) -> Optional[dict[str, Any]]:
    client = _get_redis()
    if client is not None:
        raw = client.get(f"job:{job_id}")
    else:
        raw = _memory_store.get(f"job:{job_id}")
    if raw is None:
        return None
    return json.loads(raw)
