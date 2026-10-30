import os
from datetime import timedelta
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.auth import (
    verify_password,
    create_access_token,
    get_current_user,
)
from backend.app.db.session import get_db
from backend.app.db.models import User, Project, ProjectMember
from backend.app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    UserProfile,
)

router = APIRouter(prefix="/auth", tags=["Authentication & Access Control"])


@router.post("/login", response_model=TokenResponse)
def login_for_access_token(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Authenticates user by email and password, returns JWT token with role claim,
    and sets an HTTP-only cookie.
    """
    email_clean = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()
    # Support email aliases for demo convenience
    if not user and email_clean == "site@optibuild.io":
        user = db.query(User).filter(User.email == "engineer@optibuild.io").first()
    elif not user and email_clean == "engineer@optibuild.io":
        user = db.query(User).filter(User.email == "site@optibuild.io").first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact your administrator.",
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token_data = {
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "name": user.full_name,
    }
    access_token = create_access_token(token_data, expires_delta=access_token_expires)

    # Set httpOnly cookie for secure browser persistence
    is_production = os.getenv("ENVIRONMENT", "development").lower() == "production"
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=is_production,
        path="/",
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserProfile(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
        ),
    )


@router.post("/logout")
def logout(response: Response):
    """
    Clears the authentication cookie.
    """
    response.delete_cookie(key="access_token", path="/", samesite="lax")
    return {"message": "Logged out successfully."}


@router.get("/me")
def read_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns profile information of authenticated user along with their active projects.
    """
    if current_user.role == "admin":
        projects = db.query(Project).all()
    else:
        # Check projects where user is explicitly assigned or created by
        assigned_project_ids = [
            m.project_id
            for m in db.query(ProjectMember).filter(ProjectMember.user_id == current_user.id).all()
        ]
        projects = (
            db.query(Project)
            .filter((Project.created_by_id == current_user.id) | (Project.id.in_(assigned_project_ids)))
            .all()
        )
    project_list = [
        {
            "id": p.id,
            "name": p.name,
            "status": p.status,
            "rera_registration_no": p.rera_registration_no,
            "delay_days": p.delay_days,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in projects
    ]

    return {
        "user": UserProfile.model_validate(current_user),
        "projects": project_list,
    }
