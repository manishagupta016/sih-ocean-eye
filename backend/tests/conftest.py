"""Shared pytest fixtures against a real Postgres+PostGIS test database.

SQLAlchemy models use dialect-specific types (UUID, Geography, JSONB) that don't work against
SQLite, so tests run against Postgres - point DATABASE_URL at a disposable test database.

Note on isolation: uploads exercise the real detection pipeline via FastAPI BackgroundTasks, which
opens its own DB session (see app/services/pipeline.py) on a separate connection from whatever the
request handler used. A per-test rolled-back transaction would make request-created rows (surveys,
sonar_files) invisible to that second connection until commit, breaking the pipeline mid-flight.
So instead of per-test rollback, each test gets its own session that commits for real, and the
whole schema is dropped once at the end of the test session; tests use random emails/names to
avoid colliding with each other.
"""
import os
import uuid

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://sonar:sonar@localhost:5432/sonar_intel_test")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import *  # noqa: F401,F403 - register all models on Base.metadata


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(settings.DATABASE_URL, future=True)
    with eng.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        conn.commit()
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture()
def db_session(engine):
    SessionLocal = sessionmaker(bind=engine, future=True)
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture()
def client(db_session):
    def _get_db_override():
        yield db_session

    app.dependency_overrides[get_db] = _get_db_override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers(client):
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    resp = client.post(
        "/api/v1/auth/register",
        json={"name": "Test User", "email": email, "password": "TestPass123!"},
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
