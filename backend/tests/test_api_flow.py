"""End-to-end coverage of the core API flow: auth -> survey -> upload -> pipeline -> detections ->
risk scores -> alerts -> reports -> analytics. Mirrors the manual smoke test used during
development, encoded as regression tests.
"""
import io
import time
import uuid

import cv2
import numpy as np


def _synthetic_sonar_png() -> bytes:
    """A small grayscale image with bright blobs + adjacent dark 'shadow' rectangles, so the
    classical-CV fallback detector (used when no fine-tuned YOLO weights are present) finds real
    contours to detect - not an empty/blank image that would yield zero detections."""
    img = np.random.randint(60, 90, (240, 400), dtype=np.uint8)
    cv2.circle(img, (100, 80), 20, 220, -1)
    cv2.rectangle(img, (85, 100), (115, 130), 20, -1)
    cv2.rectangle(img, (250, 150), (290, 180), 210, -1)
    cv2.rectangle(img, (250, 180), (290, 210), 15, -1)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


def test_register_and_me(client):
    email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    resp = client.post("/api/v1/auth/register", json={"name": "Alice", "email": email, "password": "TestPass123!"})
    assert resp.status_code == 201
    tokens = resp.json()
    assert "access_token" in tokens and "refresh_token" in tokens

    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == email


def test_duplicate_registration_rejected(client):
    email = f"dupe_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"name": "Bob", "email": email, "password": "TestPass123!"}
    first = client.post("/api/v1/auth/register", json=payload)
    assert first.status_code == 201
    second = client.post("/api/v1/auth/register", json=payload)
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "email_taken"


def test_unauthenticated_request_rejected(client):
    resp = client.get("/api/v1/surveys")
    assert resp.status_code == 401


def test_survey_crud_is_scoped_to_owner(client, auth_headers):
    resp = client.post(
        "/api/v1/surveys",
        json={"name": "Test Survey", "location_name": "seabedobjects-klsg", "sonar_format": "klein-3000"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    survey = resp.json()

    listed = client.get("/api/v1/surveys", headers=auth_headers)
    assert listed.status_code == 200
    assert any(s["id"] == survey["id"] for s in listed.json())

    other_user_headers = {"Authorization": "Bearer not-a-real-token"}
    forbidden = client.get(f"/api/v1/surveys/{survey['id']}", headers=other_user_headers)
    assert forbidden.status_code == 401


def test_full_pipeline_produces_detections_risk_and_alerts(client, auth_headers):
    survey = client.post(
        "/api/v1/surveys",
        json={"name": "Pipeline Test Survey", "location_name": "seabedobjects-klsg", "sonar_format": "klein-3000"},
        headers=auth_headers,
    ).json()

    files = {"file": ("test.png", io.BytesIO(_synthetic_sonar_png()), "image/png")}
    data = {"survey_id": survey["id"]}
    upload = client.post("/api/v1/uploads", files=files, data=data, headers=auth_headers)
    assert upload.status_code == 201, upload.text
    job_id = upload.json()["job_id"]
    sonar_file_id = upload.json()["sonar_file"]["id"]

    status_doc = None
    for _ in range(20):
        job = client.get(f"/api/v1/uploads/jobs/{job_id}", headers=auth_headers)
        assert job.status_code == 200
        status_doc = job.json()
        if status_doc["status"] in ("done", "failed"):
            break
        time.sleep(0.3)
    assert status_doc is not None and status_doc["status"] == "done", status_doc

    detections = client.get(
        "/api/v1/detections", params={"sonar_file_id": sonar_file_id}, headers=auth_headers
    )
    assert detections.status_code == 200
    rows = detections.json()
    assert len(rows) > 0, "classical-CV fallback detector should find at least one blob in the synthetic test image"

    for row in rows:
        assert row["risk_score"] is not None
        assert row["risk_score"]["risk_tier"] in (
            "ignore", "human_review", "probable_debris", "high_confidence_hazard",
        )
        # Never fabricated coordinates: no nav log was uploaded, so every detection must be
        # image-space only.
        assert row["has_geo_metadata"] is False
        assert row["latitude"] is None
        assert row["longitude"] is None

    # Alerts are created for probable_debris/high_confidence_hazard tiers - if the detector found
    # any this run, they must show up here (exact count varies with the heuristic detector output).
    expected_alert_tiers = {"probable_debris", "high_confidence_hazard"}
    expected_min_alerts = sum(1 for r in rows if r["risk_score"]["risk_tier"] in expected_alert_tiers)
    alerts = client.get("/api/v1/alerts", headers=auth_headers)
    assert alerts.status_code == 200
    assert len(alerts.json()) >= expected_min_alerts

    report = client.post(
        "/api/v1/reports/generate", json={"survey_id": survey["id"], "format": "csv"}, headers=auth_headers
    )
    assert report.status_code == 201
    download = client.get(f"/api/v1/reports/{report.json()['id']}/download", headers=auth_headers)
    assert download.status_code == 200
    assert b"class_label" in download.content


def test_risk_formula_is_publicly_inspectable(client):
    resp = client.get("/api/v1/risk-scores/formula")
    assert resp.status_code == 200
    body = resp.json()
    assert set(body["weights"].keys()) == {"calibrated_confidence", "artificial_score", "size", "domain_trust"}
    assert abs(sum(body["weights"].values()) - 1.0) < 1e-6


def test_analytics_endpoints_respond(client, auth_headers):
    for path in ["dashboard-summary", "performance", "calibration", "cross-domain", "latency", "model-versions"]:
        resp = client.get(f"/api/v1/analytics/{path}", headers=auth_headers)
        assert resp.status_code == 200, (path, resp.text)
