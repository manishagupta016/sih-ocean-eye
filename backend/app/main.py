from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.core.rate_limit import limiter
from app.middleware.error_handlers import register_exception_handlers
from app.middleware.request_context import RequestContextMiddleware
from app.routers import alerts, analytics, auth, detections, reports, risk_scores, surveys, uploads

configure_logging(debug=settings.DEBUG)
logger = get_logger("startup")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Warm the discrimination/calibration models so the first upload isn't slowed down by a
    # cold-start training pass (both self-bootstrap on synthetic priors if no weights exist yet -
    # see app/ml/discriminator.py and app/ml/calibration.py for why).
    from app.ml.calibration import get_calibrator
    from app.ml.detector import get_detector
    from app.ml.discriminator import get_discriminator

    get_detector()
    get_discriminator()
    get_calibrator()
    logger.info("startup_complete", environment=settings.ENVIRONMENT)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Detect -> Discriminate -> Classify -> Calibrate -> Score risk -> Geolocate -> Report. "
        "A multi-stage decision-support API for side-scan sonar marine debris survey data "
        "(MoES/NIOT PS 26057)."
    ),
    version="0.1.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(surveys.router, prefix=settings.API_V1_PREFIX)
app.include_router(uploads.router, prefix=settings.API_V1_PREFIX)
app.include_router(detections.router, prefix=settings.API_V1_PREFIX)
app.include_router(risk_scores.router, prefix=settings.API_V1_PREFIX)
app.include_router(reports.router, prefix=settings.API_V1_PREFIX)
app.include_router(analytics.router, prefix=settings.API_V1_PREFIX)
app.include_router(alerts.router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "app": settings.APP_NAME}
