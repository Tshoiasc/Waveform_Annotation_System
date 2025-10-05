from __future__ import annotations

from functools import wraps
from typing import Any, Callable, Optional

from fastapi import HTTPException, Request


def require_permission(permission: str) -> Callable:
    """权限检查装饰器"""

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            request: Optional[Request] = None

            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break

            if request is None:
                request = kwargs.get("request")

            if request is None:
                raise HTTPException(status_code=500, detail="内部错误：未找到请求上下文")

            user_permissions = getattr(request.state, "permissions", [])
            if permission not in user_permissions:
                raise HTTPException(status_code=403, detail=f"权限不足，需要权限: {permission}")

            return await func(*args, **kwargs)

        return wrapper

    return decorator


def get_current_user(request: Request) -> dict:
    """从请求上下文中获取当前用户信息"""

    return {
        "user_id": getattr(request.state, "user_id", None),
        "username": getattr(request.state, "username", None),
        "role_id": getattr(request.state, "role_id", None),
        "role_name": getattr(request.state, "role_name", None),
        "permissions": getattr(request.state, "permissions", []),
    }
