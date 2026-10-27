import os
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Callable
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.db.session import get_db
from backend.app.db.models import User, ProjectMember, Project

security_scheme = HTTPBearer(auto_error=False)

ROLES_ALL = [
    "admin",
    "project_manager",
    "site_engineer",
    "store_keeper",
    "architect",
    "accountant",
    "owner",
]


def hash_password(password: str) -> str:
    """Hashes a plaintext password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against a bcrypt hash. Accepts strictly exact match."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Creates a JWT access token containing claims including role."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict:
    """Decodes and validates a JWT token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    request: Request,
    bearer: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Extracts access token from Authorization header or 'access_token' cookie,
    validates the JWT, and loads the active user from DB.
    """
    token: Optional[str] = None

    if bearer and bearer.credentials:
        token = bearer.credentials
    elif "access_token" in request.cookies:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide a valid Bearer token or login cookie.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is missing user identity.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with token not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    return user


def require_roles(*allowed_roles: str) -> Callable:
    """
    Dependency factory that restricts an endpoint to specific roles.
    'admin' role is always permitted.
    """
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role == "admin":
            return current_user

        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of roles: {list(allowed_roles)}. Your role is '{current_user.role}'.",
            )
        return current_user

    return role_checker


def check_project_membership(
    project_id: str,
    user: User,
    db: Session,
    allowed_roles: Optional[List[str]] = None,
    project: Optional[Project] = None,
) -> bool:
    """
    Verifies if user has permission to access a project.
    - System 'admin' always has universal access.
    - Non-admin user must be project creator or have a ProjectMember record for this project.
    - If allowed_roles is specified, the user's project role (or creator role) must be in allowed_roles.
    """
    if user.role == "admin":
        return True

    if project is None:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return False

    is_creator = (project.created_by_id == user.id)
    membership = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user.id)
        .first()
    )

    if not is_creator and not membership:
        return False

    effective_role = membership.role if membership else user.role

    if allowed_roles is not None:
        if effective_role not in allowed_roles:
            return False

    return True


def verify_project_membership(
    project_id: str,
    user: User,
    db: Session,
    allowed_roles: Optional[List[str]] = None,
) -> Project:
    """
    Verifies that the user has permission to access the specified project.
    Raises HTTPException 403 if user is not a member or lacks the allowed role.
    Raises HTTPException 404 if project does not exist.
    Returns the Project instance.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if user.role != "admin" and not project:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You are not a member of this project.",
        )

    if not check_project_membership(project_id, user, db, allowed_roles=allowed_roles, project=project):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You are not an authorized member of this project or lack the required role.",
        )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    return project
