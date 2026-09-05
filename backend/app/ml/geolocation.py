"""Geolocation stage.

Hard rule (per project spec): a detection only ever gets a lat/long when real navigation
metadata - ping timestamp, GPS fix, heading, and range - was present in the uploaded survey data.
We never interpolate, guess, or fabricate coordinates. Everything else is surfaced to the
frontend/report as `has_geo_metadata=False` and rendered in the "image-space only" list instead of
on the map.

For this prototype, navigation metadata is supplied as an optional JSON sidecar file uploaded
alongside the sonar image (real XTF/JSF binary nav-record parsing is a straightforward drop-in
replacement for `parse_nav_log` once a source format is chosen, but is out of scope for the demo).
Sidecar shape: a JSON array of {"timestamp": float, "latitude": float, "longitude": float,
"heading_deg": float, "range_m": float}, one entry per sonar ping (image row), ordered
top-to-bottom as recorded.
"""
import json
import math
import os

from app.ml.types import GeolocatedDetection, NavPing, PipelineContext, ScoredDetection

EARTH_RADIUS_M = 6_371_000.0


def parse_nav_log(sidecar_path: str) -> list[NavPing]:
    if not sidecar_path or not os.path.exists(sidecar_path):
        return []
    with open(sidecar_path, "r") as f:
        raw = json.load(f)
    pings = []
    for row in raw:
        try:
            pings.append(
                NavPing(
                    timestamp=float(row["timestamp"]),
                    latitude=float(row["latitude"]),
                    longitude=float(row["longitude"]),
                    heading_deg=float(row["heading_deg"]),
                    range_m=float(row["range_m"]),
                )
            )
        except (KeyError, TypeError, ValueError):
            continue  # skip malformed rows rather than fabricating a fix
    return pings


def destination_point(lat: float, lon: float, bearing_deg: float, distance_m: float) -> tuple[float, float]:
    """Standard spherical-earth destination-point formula (haversine-consistent)."""
    ang_dist = distance_m / EARTH_RADIUS_M
    bearing = math.radians(bearing_deg)
    lat1 = math.radians(lat)
    lon1 = math.radians(lon)

    lat2 = math.asin(
        math.sin(lat1) * math.cos(ang_dist) + math.cos(lat1) * math.sin(ang_dist) * math.cos(bearing)
    )
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(ang_dist) * math.cos(lat1),
        math.cos(ang_dist) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lat2), (math.degrees(lon2) + 540) % 360 - 180


def attach_geolocation(det: ScoredDetection, ctx: PipelineContext) -> GeolocatedDetection:
    base = GeolocatedDetection(**det.__dict__)

    if not ctx.nav_track or ctx.image_height <= 0:
        base.has_geo_metadata = False
        base.latitude = None
        base.longitude = None
        return base

    # Map the detection's vertical (down-track) pixel position to the nearest recorded ping,
    # assuming image rows were written in ping order (standard for waterfall SSS imagery).
    center_y = det.bbox.y + det.bbox.h / 2
    ping_idx = int(round((center_y / ctx.image_height) * (len(ctx.nav_track) - 1)))
    ping_idx = max(0, min(len(ctx.nav_track) - 1, ping_idx))
    ping = ctx.nav_track[ping_idx]

    # Across-track offset: distance from the nadir (image center column) converted from pixels
    # to meters using the survey's across-track resolution, signed by port(-)/starboard(+).
    center_x = det.bbox.x + det.bbox.w / 2
    image_center_x = (ctx.image_width or 1) / 2
    across_track_offset_m = (center_x - image_center_x) * ctx.across_track_resolution_m_per_px

    bearing = (ping.heading_deg + 90) % 360 if across_track_offset_m >= 0 else (ping.heading_deg - 90) % 360
    lat, lon = destination_point(ping.latitude, ping.longitude, bearing, abs(across_track_offset_m))

    base.has_geo_metadata = True
    base.latitude = round(lat, 7)
    base.longitude = round(lon, 7)
    return base
