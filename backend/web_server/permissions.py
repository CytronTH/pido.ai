import json
import logging
from enum import Enum
from typing import Dict, List, Optional, Set, Callable, Any
from fastapi import Depends, HTTPException, status
from sqlmodel import Session

from db.models import User
from .routers.auth import get_current_user, get_current_user_optional

logger = logging.getLogger("ai_engine.permissions")

class Role(str, Enum):
    ADMIN = "admin"
    ENGINEER = "engineer"
    OPERATOR = "operator"
    VIEWER = "viewer"

class Permission(str, Enum):
    # Pipeline Builder
    PIPELINE_VIEW = "pipeline:view"
    PIPELINE_EDIT = "pipeline:edit"
    PIPELINE_DEPLOY = "pipeline:deploy"
    PIPELINE_VERSION = "pipeline:version"

    # Live Dashboard
    DASHBOARD_VIEW = "dashboard:view"
    DASHBOARD_INTERACT = "dashboard:interact"
    DASHBOARD_EDIT = "dashboard:edit"
    DASHBOARD_VERSION = "dashboard:version"

    # Projects
    PROJECT_VIEW = "project:view"
    PROJECT_MANAGE = "project:manage"
    PROJECT_BACKUP = "project:backup"
    RUNTIME_CONTROL = "runtime:control"

    # Models & Hardware
    MODELS_MANAGE = "models:manage"
    CAMERAS_MANAGE = "cameras:manage"
    HARDWARE_CONTROL = "hardware:control"

    # System & Administration
    USERS_MANAGE = "users:manage"
    VIEWER_ASSIGN = "viewer:assign"
    SYSTEM_MANAGE = "system:manage"
    LOGS_VIEW = "logs:view"
    LOGS_PURGE = "logs:purge"

# Fixed Role-Permission Matrix
ROLE_PERMISSIONS: Dict[str, Set[Permission]] = {
    Role.ADMIN.value: set(Permission),  # Admin has every permission
    
    Role.ENGINEER.value: {
        Permission.PIPELINE_VIEW,
        Permission.PIPELINE_EDIT,
        Permission.PIPELINE_DEPLOY,
        Permission.PIPELINE_VERSION,
        Permission.DASHBOARD_VIEW,
        Permission.DASHBOARD_INTERACT,
        Permission.DASHBOARD_EDIT,
        Permission.DASHBOARD_VERSION,
        Permission.PROJECT_VIEW,
        Permission.PROJECT_MANAGE,
        Permission.PROJECT_BACKUP,
        Permission.RUNTIME_CONTROL,
        Permission.MODELS_MANAGE,
        Permission.CAMERAS_MANAGE,
        Permission.HARDWARE_CONTROL,
        Permission.VIEWER_ASSIGN,  # Engineer can configure allowed projects for Viewers
        Permission.LOGS_VIEW,
    },
    
    Role.OPERATOR.value: {
        Permission.DASHBOARD_VIEW,
        Permission.DASHBOARD_INTERACT,  # Ack alerts, reset counters, trigger widgets
        Permission.RUNTIME_CONTROL,     # Start/Stop pipeline runtime
        Permission.PROJECT_VIEW,
        Permission.LOGS_VIEW,
    },
    
    Role.VIEWER.value: {
        Permission.DASHBOARD_VIEW,     # Only allowed projects' Live Dashboard
        Permission.PROJECT_VIEW,
    },
}

# Compatibility mapping: map legacy 'editor' to 'engineer' permissions
ROLE_PERMISSIONS["editor"] = ROLE_PERMISSIONS[Role.ENGINEER.value]


def get_user_allowed_projects(user: User) -> Optional[List[str]]:
    """
    Returns None if user has global project access (Admin, Engineer, Operator).
    Returns list of project IDs if access is restricted (Viewer).
    """
    if user.role != Role.VIEWER.value:
        return None
    try:
        raw = user.allowed_projects_json or "[]"
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else []
    except Exception as e:
        logger.warning(f"Failed to parse allowed_projects_json for user {user.username}: {e}")
        return []


def can_access_project(user: User, project_id: str) -> bool:
    """Check if user is allowed to access the specified project."""
    allowed = get_user_allowed_projects(user)
    if allowed is None:
        return True
    return project_id in allowed


def require_permission(perm: Permission) -> Callable[..., User]:
    """Dependency factory ensuring the current user possesses the required permission."""
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        user_perms = ROLE_PERMISSIONS.get(current_user.role, set())
        if perm not in user_perms:
            logger.warning(
                f"User '{current_user.username}' (role: {current_user.role}) "
                f"denied access to permission '{perm.value}'"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: Action requires '{perm.value}'"
            )
        return current_user
    return dependency


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency verifying the caller is an active Administrator."""
    if current_user.role != Role.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required"
        )
    return current_user


def get_current_admin_or_engineer(current_user: User = Depends(get_current_user)) -> User:
    """Dependency verifying caller is either an Administrator or Engineer."""
    if current_user.role not in [Role.ADMIN.value, Role.ENGINEER.value, "editor"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Engineer access required"
        )
    return current_user


def require_project_access(project_id: str, current_user: User = Depends(get_current_user)) -> User:
    """Dependency verifying caller has access to the specified project."""
    if not can_access_project(current_user, project_id):
        logger.warning(
            f"Viewer '{current_user.username}' attempted unauthorized access to project '{project_id}'"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: You do not have permission to view project '{project_id}'"
        )
    return current_user
