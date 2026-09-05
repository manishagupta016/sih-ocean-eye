from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application configuration, sourced from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_NAME: str = "Ocean Eye API"
    ENVIRONMENT: str = "development"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = True

    # Security / JWT
    SECRET_KEY: str = "change-me-in-production-this-is-a-dev-only-secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # Database
    DATABASE_URL: str = (
        "postgresql+psycopg2://sonar:sonar@localhost:5432/sonar_intel"
    )

    # Redis (job status / caching)
    REDIS_URL: str = "redis://localhost:6379/0"

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Uploads
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 200
    ALLOWED_UPLOAD_EXTENSIONS: List[str] = [".xtf", ".jsf", ".sdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff"]

    # Reports
    REPORTS_DIR: str = "./reports"

    # ML
    ML_ARTIFACTS_DIR: str = "./ml_artifacts"
    YOLO_WEIGHTS_PATH: str = "./ml_artifacts/yolov8n_sss.pt"
    DISCRIMINATOR_WEIGHTS_PATH: str = "./ml_artifacts/discriminator.joblib"
    CALIBRATOR_WEIGHTS_PATH: str = "./ml_artifacts/calibrator.joblib"
    DETECTION_CONFIDENCE_THRESHOLD: float = 0.25

    # Rate limiting
    RATE_LIMIT_DEFAULT: str = "60/minute"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
