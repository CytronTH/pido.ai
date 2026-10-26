from typing import List, Optional
import json
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from db.database import get_db
from db.models import User
from db.auth import get_password_hash
from ..permissions import Role, get_current_admin_or_engineer

logger = logging.getLogger("ai_engine.users")

router = APIRouter(prefix="/api/users", tags=["users"])

VALID_ROLES = {Role.ADMIN.value, Role.ENGINEER.value, Role.OPERATOR.value, Role.VIEWER.value, "editor"}

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = Role.VIEWER.value  # admin, engineer, operator, viewer
    allowed_projects: Optional[List[str]] = []

class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    allowed_projects: Optional[List[str]] = None


def format_user_response(user: User) -> dict:
    allowed_projects = []
    try:
        allowed_projects = json.loads(user.allowed_projects_json or "[]")
    except Exception:
        pass
    return {
        "id": user.id,
        "username": user.username,
        "role": "engineer" if user.role == "editor" else user.role,
        "allowed_projects": allowed_projects,
        "is_active": user.is_active,
        "created_at": user.created_at
    }


@router.post("")
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_caller: User = Depends(get_current_admin_or_engineer)
):
    normalized_role = "engineer" if user_in.role == "editor" else user_in.role.lower()
    if normalized_role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {list(VALID_ROLES)}"
        )

    # Engineers can ONLY create Viewer accounts
    if current_caller.role in [Role.ENGINEER.value, "editor"]:
        if normalized_role != Role.VIEWER.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Engineers can only create Viewer accounts"
            )

    existing_user = db.exec(select(User).where(User.username == user_in.username)).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    user_id = str(uuid.uuid4())
    hashed_password = get_password_hash(user_in.password)
    allowed_projects_str = json.dumps(user_in.allowed_projects or [])

    new_user = User(
        id=user_id,
        username=user_in.username,
        hashed_password=hashed_password,
        role=normalized_role,
        allowed_projects_json=allowed_projects_str,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    logger.info(f"User '{new_user.username}' created with role '{new_user.role}' by '{current_caller.username}'")
    return format_user_response(new_user)


@router.get("")
def read_users(
    db: Session = Depends(get_db),
    current_caller: User = Depends(get_current_admin_or_engineer)
):
    users = db.exec(select(User)).all()
    return [format_user_response(u) for u in users]


@router.put("/{user_id}")
def update_user(
    user_id: str,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_caller: User = Depends(get_current_admin_or_engineer)
):
    user = db.exec(select(User).where(User.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Engineer permission constraints: can only manage Viewers and assign projects
    if current_caller.role in [Role.ENGINEER.value, "editor"]:
        if user.role != Role.VIEWER.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Engineers can only manage Viewer accounts"
            )
        if user_in.role is not None and user_in.role != Role.VIEWER.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Engineers cannot change user roles"
            )

    if user_in.role is not None:
        normalized_role = "engineer" if user_in.role == "editor" else user_in.role.lower()
        if normalized_role not in VALID_ROLES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")
        
        # Prevent demoting the last active admin
        if user.role == Role.ADMIN.value and normalized_role != Role.ADMIN.value:
            active_admins = db.exec(
                select(User).where(User.role == Role.ADMIN.value, User.is_active == True)
            ).all()
            if len(active_admins) <= 1 and active_admins[0].id == user.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot change role: At least one active Administrator must remain"
                )
        user.role = normalized_role

    if user_in.is_active is not None:
        if user.role == Role.ADMIN.value and not user_in.is_active:
            active_admins = db.exec(
                select(User).where(User.role == Role.ADMIN.value, User.is_active == True)
            ).all()
            if len(active_admins) <= 1 and active_admins[0].id == user.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot deactivate the last active Administrator"
                )
        user.is_active = user_in.is_active

    if user_in.password is not None and user_in.password.strip():
        user.hashed_password = get_password_hash(user_in.password)

    if user_in.allowed_projects is not None:
        user.allowed_projects_json = json.dumps(user_in.allowed_projects)

    db.add(user)
    db.commit()
    db.refresh(user)

    logger.info(f"User '{user.username}' updated by '{current_caller.username}'")
    return format_user_response(user)


@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_caller: User = Depends(get_current_admin_or_engineer)
):
    user = db.exec(select(User).where(User.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.id == current_caller.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account")

    if current_caller.role in [Role.ENGINEER.value, "editor"]:
        if user.role != Role.VIEWER.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Engineers can only delete Viewer accounts"
            )

    if user.role == Role.ADMIN.value:
        active_admins = db.exec(
            select(User).where(User.role == Role.ADMIN.value, User.is_active == True)
        ).all()
        if len(active_admins) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the last active Administrator"
            )

    db.delete(user)
    db.commit()
    logger.info(f"User '{user.username}' deleted by '{current_caller.username}'")
    return {"ok": True, "message": f"User {user.username} deleted"}
