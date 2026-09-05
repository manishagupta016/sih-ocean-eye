import hashlib
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.rate_limit import limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.user import ApiKey, User
from app.schemas.user import (
    ApiKeyCreate,
    ApiKeyCreated,
    ApiKeyRead,
    RefreshRequest,
    TokenPair,
    UserCreate,
    UserRead,
    UserUpdate,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_tokens(user: User) -> TokenPair:
    return TokenPair(
        access_token=create_access_token(str(user.id), user.role.value),
        refresh_token=create_refresh_token(str(user.id), user.role.value),
    )


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def register(request: Request, payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "email_taken", "message": "An account with this email already exists."},
        )
    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _issue_tokens(user)


@router.post("/login", response_model=TokenPair)
@limiter.limit("20/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_credentials", "message": "Incorrect email or password."},
        )
    return _issue_tokens(user)


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    decoded = decode_token(payload.refresh_token)
    if decoded is None or decoded.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_refresh_token", "message": "Refresh token is invalid or expired."},
        )
    user = db.get(User, uuid.UUID(decoded["sub"]))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_refresh_token", "message": "User no longer exists."},
        )
    return _issue_tokens(user)


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserRead)
def update_me(payload: UserUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.name is not None:
        current_user.name = payload.name
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/api-keys", response_model=ApiKeyCreated, status_code=status.HTTP_201_CREATED)
def create_api_key(
    payload: ApiKeyCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    raw_key = f"oceaneye_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    api_key = ApiKey(
        user_id=current_user.id,
        label=payload.label,
        key_prefix=raw_key[:12],
        key_hash=key_hash,
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    return ApiKeyCreated(id=api_key.id, label=api_key.label, api_key=raw_key, created_at=api_key.created_at)


@router.get("/api-keys", response_model=list[ApiKeyRead])
def list_api_keys(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(ApiKey)
        .filter(ApiKey.user_id == current_user.id, ApiKey.revoked.is_(False))
        .order_by(ApiKey.created_at.desc())
        .all()
    )


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_api_key(key_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    api_key = db.get(ApiKey, key_id)
    if api_key is None or api_key.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "not_found", "message": "API key not found."},
        )
    api_key.revoked = True
    db.commit()
