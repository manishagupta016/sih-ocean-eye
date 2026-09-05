import asyncio
import base64
import os
import uuid

import cv2
import numpy as np
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.redis_client import get_job_status, set_job_status
from app.db.session import get_db
from app.models.sonar_file import IngestStatus, SonarFile, SonarFileType
from app.models.survey import Survey
from app.models.user import User
from app.models.user import UserRole
from app.schemas.sonar_file import JobStatus, SonarFileRead, UploadResponse
from app.services.pipeline import run_detection_pipeline
from app.services.preprocessing import encode_png, preprocess

router = APIRouter(prefix="/uploads", tags=["uploads"])

_PREVIEWABLE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tif", ".tiff"}

_EXT_TO_TYPE = {
    ".png": SonarFileType.image,
    ".jpg": SonarFileType.image,
    ".jpeg": SonarFileType.image,
    ".tif": SonarFileType.image,
    ".tiff": SonarFileType.image,
    ".xtf": SonarFileType.xtf,
    ".jsf": SonarFileType.jsf,
    ".sdf": SonarFileType.sdf,
}


@router.post("/preview")
async def preview_preprocessing(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Runs the real preprocessing step (denoise + CLAHE contrast stretch, see
    app/services/preprocessing.py) on the uploaded file and returns before/after PNGs as base64,
    without persisting anything or running detection. Powers the Upload page's before/after
    toggle so what operators preview is the actual pipeline stage, not a cosmetic approximation.
    Only raster image formats can be decoded/previewed this way; raw sonar log formats
    (.xtf/.jsf/.sdf) are previewed after the full pipeline runs instead.
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in _PREVIEWABLE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                "code": "preview_unsupported",
                "message": "Before/after preview is only available for raster image files (PNG/JPG/TIFF); raw sonar logs are previewed after processing completes.",
            },
        )
    contents = await file.read()
    arr = np.frombuffer(contents, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "decode_failed", "message": "Could not decode this file as an image."},
        )
    processed = preprocess(image)
    return {
        "before_png_base64": base64.b64encode(encode_png(image)).decode(),
        "after_png_base64": base64.b64encode(encode_png(processed)).decode(),
    }


@router.post("", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_sonar_file(
    background_tasks: BackgroundTasks,
    survey_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    nav_log: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    survey = db.get(Survey, survey_id)
    if survey is None or survey.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "not_found", "message": "Survey not found."})

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in settings.ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"code": "unsupported_file_type", "message": f"File type '{ext}' is not supported."},
        )

    contents = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"code": "file_too_large", "message": f"File exceeds the {settings.MAX_UPLOAD_SIZE_MB}MB limit."},
        )

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_id = uuid.uuid4()
    stored_name = f"{file_id}{ext}"
    stored_path = os.path.join(settings.UPLOAD_DIR, stored_name)
    with open(stored_path, "wb") as f:
        f.write(contents)

    has_nav = False
    if nav_log is not None:
        nav_contents = await nav_log.read()
        with open(stored_path + ".nav.json", "wb") as f:
            f.write(nav_contents)
        has_nav = True

    sonar_file = SonarFile(
        id=file_id,
        survey_id=survey.id,
        file_path=stored_path,
        file_type=_EXT_TO_TYPE.get(ext, SonarFileType.image),
        status=IngestStatus.queued,
        has_nav_metadata=has_nav,
    )
    db.add(sonar_file)
    db.commit()
    db.refresh(sonar_file)

    job_id = str(uuid.uuid4())
    set_job_status(
        job_id,
        {"job_id": job_id, "sonar_file_id": str(sonar_file.id), "status": IngestStatus.queued.value, "progress_pct": 0},
    )
    background_tasks.add_task(run_detection_pipeline, sonar_file.id, job_id)

    return UploadResponse(sonar_file=sonar_file, job_id=job_id)


def _get_owned_sonar_file(db: Session, current_user: User, sonar_file_id: uuid.UUID) -> SonarFile:
    sonar_file = db.get(SonarFile, sonar_file_id)
    if sonar_file is None or (
        current_user.role != UserRole.admin and sonar_file.survey.user_id != current_user.id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "not_found", "message": "Sonar file not found."})
    return sonar_file


@router.get("/{sonar_file_id}", response_model=SonarFileRead)
def get_sonar_file(sonar_file_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sonar_file = _get_owned_sonar_file(db, current_user, sonar_file_id)
    result = SonarFileRead.model_validate(sonar_file)
    mv = sonar_file.model_version
    if mv is not None:
        result.model_name = mv.name
        result.model_is_fallback = mv.name != "yolov8n-sss"
        result.model_provenance = mv.trained_on
    return result


@router.get("/{sonar_file_id}/image")
def get_sonar_file_image(sonar_file_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Serves the original uploaded raster image so the Results page can render it under the
    bounding-box overlay. Only raster image uploads can be served this way (see the note on
    /uploads/preview) - raw sonar logs have no viewable image in this prototype."""
    sonar_file = _get_owned_sonar_file(db, current_user, sonar_file_id)
    ext = os.path.splitext(sonar_file.file_path)[1].lower()
    if ext not in _PREVIEWABLE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"code": "not_viewable", "message": "This sonar file format has no viewable raster image."},
        )
    if not os.path.exists(sonar_file.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "not_found", "message": "Image file missing on disk."})
    return FileResponse(sonar_file.file_path)


@router.get("/jobs/{job_id}", response_model=JobStatus)
def get_job(job_id: str, current_user: User = Depends(get_current_user)):
    status_doc = get_job_status(job_id)
    if status_doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "not_found", "message": "Job not found."})
    return JobStatus(**status_doc)


@router.websocket("/jobs/{job_id}/ws")
async def job_status_ws(websocket: WebSocket, job_id: str):
    """Pushes job status updates until the pipeline reaches a terminal state. Polling
    (`GET /uploads/jobs/{job_id}`) remains available as the primary, simpler integration path;
    this socket exists for pages that want live push updates without polling."""
    await websocket.accept()
    try:
        last_sent = None
        while True:
            doc = get_job_status(job_id)
            if doc and doc != last_sent:
                await websocket.send_json(doc)
                last_sent = doc
                if doc.get("status") in (IngestStatus.done.value, IngestStatus.failed.value):
                    break
            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        pass
