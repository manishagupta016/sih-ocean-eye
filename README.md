# Ocean Eye

**SEE DEEPER. PROTECT BETTER.**

*From sonar pixels to trustworthy, actionable coordinates.*

A decision-support prototype for the Smart India Hackathon problem statement **PS 26057**
(MoES/NIOT) - detects, discriminates, calibrates, risk-scores, and geolocates underwater marine
debris and anomalies from side-scan sonar (SSS) imagery, then surfaces it through a control-room
dashboard, map, and exportable reports.

This is **not** a bare object detector. It's a multi-stage pipeline:

```
Detect -> Discriminate (natural vs. artificial) -> Calibrate confidence -> Score risk
       -> Geolocate (only with real nav data) -> Persist -> Dashboard / Map / Reports
```

Two things are treated as non-negotiable throughout the codebase:

- **Coordinates are never fabricated.** A detection only gets a lat/long when real navigation
  metadata (ping timestamp, GPS, heading, range) was present in the uploaded data. Otherwise it's
  marked `image-space only` and kept off the map.
- **Confidence shown to operators is always calibrated**, not the detector's raw score. Expected
  Calibration Error (ECE) is tracked and shown on the Analytics page.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + TypeScript + Vite, Tailwind CSS v4, Radix-based UI kit (shadcn-style), Leaflet, Recharts, React Query, Zustand, React Router |
| Backend | FastAPI (async), SQLAlchemy 2.0, Alembic, PostgreSQL + PostGIS, Redis (job status), JWT auth (python-jose + passlib) |
| ML pipeline | Ultralytics YOLOv8 detector (pluggable, falls back to a classical-CV detector when no fine-tuned weights are present), a GradientBoosting natural-vs-artificial discriminator, isotonic confidence calibration, a transparent weighted risk-scoring formula |

## Important limitation, stated plainly

**No fine-tuned YOLOv8-on-SSS weights ship with this repo**, and the discrimination/calibration
models are bootstrapped on synthetic priors rather than a labeled SSS dataset. This environment has
no GPU and no access to a labeled SSS/FLS dataset to actually run the training job the hackathon
brief describes. Instead:

- `backend/app/ml/detector.py` loads real YOLOv8 weights from `ml_artifacts/yolov8n_sss.pt` **if
  present**; otherwise it falls back to `MockSonarDetector`, a classical adaptive-threshold +
  contour-analysis detector that runs on the *actual* uploaded image (real bounding boxes grounded
  in real image content, not randomly generated) so the rest of the pipeline and every page in the
  frontend can be demoed and evaluated honestly end-to-end.
- `backend/app/ml/discriminator.py` and `backend/app/ml/calibration.py` bootstrap their models from
  synthetic-but-domain-informed priors on first run and say so in their logs and docstrings.
- `backend/scripts/train_yolo.py`, `evaluate_detector.py`, and `cross_domain_eval.py` are real,
  runnable scripts for the actual training/evaluation workflow - point them at a real SSS dataset
  (Ultralytics format) to replace the illustrative numbers on the Analytics page. **Forward-Looking
  Sonar (FLS) data must never be used as SSS ground truth** in this project - only for
  pretraining/transfer learning - and that provenance is what `ModelVersion.trained_on` records and
  the Analytics page displays.
- The Analytics page marks every number that hasn't been measured this way as
  `"source": "illustrative_demo"` and shows a visible banner - it never claims a real evaluation ran
  when it didn't.

Every other part of the system - auth, the DB schema, the pipeline orchestration, risk scoring,
geolocation, reports, and all 11 frontend pages - is fully implemented and has been exercised
end-to-end in a real browser (not just unit-tested).

## Running locally with Docker Compose

```bash
cp backend/.env.example backend/.env      # edit SECRET_KEY etc. for anything beyond local demo use
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API + Swagger docs: http://localhost:8000/docs
- Postgres (PostGIS-enabled): localhost:5432 (`sonar` / `sonar` / `sonar_intel`)
- Redis: localhost:6379

On first boot the backend runs its Alembic migrations automatically (see `backend/Dockerfile`'s
`CMD`). Seed a demo account and a sample survey with detections/alerts:

```bash
docker compose exec backend python -m scripts.seed_demo_data
```

This creates:
- `admin@sonarintel.demo` / `ChangeMe123!` (admin role)
- `operator@sonarintel.demo` / `ChangeMe123!` (operator role)
- A "Gulf of Mannar Demo Survey" with synthetic detections spanning all four risk tiers, so the
  Dashboard/Map/Risk List/Alerts pages aren't empty on first login.

## Running locally without Docker

### Backend

Requires **Python 3.10+** (the codebase uses modern type-union syntax throughout) and a
PostgreSQL 14+ server with the PostGIS extension available.

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # adjust DATABASE_URL / REDIS_URL for your local Postgres/Redis
alembic upgrade head
python -m scripts.seed_demo_data   # optional but recommended
uvicorn app.main:app --reload
```

Redis is optional for local dev - if `REDIS_URL` isn't reachable, background job status falls back
to an in-process store automatically (see `app/db/redis_client.py`); this only matters for a
single-process dev server, not for a real horizontally-scaled deployment.

### Frontend

Requires Node 20+.

```bash
cd frontend
npm install
cp .env.example .env   # points VITE_API_BASE_URL at your backend
npm run dev
```

Open http://localhost:5173.

## Tests

Backend integration tests run against a real disposable Postgres+PostGIS database (SQLAlchemy's
UUID/Geography/JSONB column types aren't SQLite-compatible), covering auth, survey ownership
scoping, the full upload -> pipeline -> detections -> risk scores -> alerts -> report-download
flow, and every analytics endpoint:

```bash
cd backend
createdb sonar_intel_test   # once, with the postgis extension available
source .venv/bin/activate
DATABASE_URL=postgresql+psycopg2://sonar:sonar@localhost:5432/sonar_intel_test pytest -v
```

## Environment variables

### Backend (`backend/.env`, see `backend/.env.example`)

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | JWT signing secret - change for anything beyond local demo use |
| `DATABASE_URL` | SQLAlchemy URL, e.g. `postgresql+psycopg2://sonar:sonar@localhost:5432/sonar_intel` |
| `REDIS_URL` | Job-status store; falls back to in-memory if unreachable |
| `CORS_ORIGINS` | JSON array of allowed frontend origins |
| `UPLOAD_DIR` / `REPORTS_DIR` / `ML_ARTIFACTS_DIR` | Local storage paths |
| `YOLO_WEIGHTS_PATH` | Path to fine-tuned SSS YOLOv8 weights; absent = classical-CV fallback |
| `DETECTION_CONFIDENCE_THRESHOLD` | Raw-confidence floor passed to the detector |
| `RATE_LIMIT_DEFAULT` | Default per-IP rate limit (slowapi), e.g. `60/minute` |

### Frontend (`frontend/.env`, see `frontend/.env.example`)

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Backend API base URL, e.g. `http://localhost:8000/api/v1` |

## API overview

Full interactive documentation is auto-generated at `/docs` (Swagger) and `/openapi.json`. Routers:
`/auth`, `/surveys`, `/uploads`, `/detections`, `/risk-scores`, `/reports`, `/analytics`, `/alerts`.

All error responses share one JSON shape: `{"error": {"code": "...", "message": "..."}}`. Every
request is tagged with a request ID (`X-Request-ID` header, also in structured JSON logs) and
inference latency is recorded per pipeline stage and surfaced on the Analytics page.

## Database schema

PostgreSQL + PostGIS, managed via SQLAlchemy models (`backend/app/models/`) and Alembic migrations
(`backend/alembic/versions/0001_initial_schema.py`): `users`, `api_keys`, `surveys`, `sonar_files`,
`detections` (with a `geography(Point, 4326)` column, nullable), `risk_scores`, `reports`, `alerts`,
`model_versions`.

## Frontend pages

Landing · Login/Signup (role selection) · Dashboard · Upload (drag-and-drop + live before/after
preprocessing preview) · AI Analysis Results (bbox overlay + live confidence-threshold slider) ·
Interactive Map (Leaflet, risk-tier-colored markers, separate image-space-only list) · Anomaly/Risk
List (sortable/filterable table) · Alerts & Notifications (acknowledge flow) · Reports (CSV/JSON
generate + download) · Analytics (per-class precision/recall/mAP, calibration reliability diagram,
cross-domain accuracy-drop chart, inference latency/FPS - all measured live from this instance's
own pipeline runs where noted) · Settings (profile, API keys, dark/light theme toggle).

## Repository layout

```
backend/
  app/
    core/        # config, security (JWT/bcrypt), rate limiting, structured logging, auth deps
    db/          # SQLAlchemy session, Redis-backed job status store
    models/      # SQLAlchemy ORM models
    schemas/     # Pydantic request/response schemas
    routers/     # FastAPI routers (auth, surveys, uploads, detections, risk-scores, reports, analytics, alerts)
    ml/          # detector, discriminator, calibration, risk scoring, geolocation, evaluation
    services/    # preprocessing, pipeline orchestration, report generation, latency metrics
  alembic/       # migrations
  scripts/       # seed_demo_data, train_yolo, evaluate_detector, cross_domain_eval
frontend/
  src/
    api/         # typed API client + per-resource functions
    components/  # ui/ (design system primitives), layout/, common/
    pages/       # the 11 routed pages
    store/       # zustand auth + theme stores
docker-compose.yml
```
