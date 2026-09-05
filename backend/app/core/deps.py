import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def _credentials_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "invalid_credentials", "message": "Could not validate credentials."},
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    if token is None:
        raise _credentials_error()
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise _credentials_error()
    user_id = payload.get("sub")
    try:
        user = db.get(User, uuid.UUID(user_id))
    except (ValueError, TypeError):
        raise _credentials_error()
    if user is None:
        raise _credentials_error()
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "forbidden", "message": "Admin role required."},
        )
    return current_user
