"""认证中间件 (预留)"""
from __future__ import annotations

from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class AuthMiddleware(BaseHTTPMiddleware):
    """简单认证中间件

    当前阶段仅从请求头中提取 X-User-Id 与 X-User-Role，写入 request.state，
    以便后续阶段扩展真实认证逻辑。
    """

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        user_id = request.headers.get("X-User-Id")
        role = request.headers.get("X-User-Role")
        if user_id:
            request.state.user_id = user_id
        if role:
            request.state.user_role = role
        response = await call_next(request)
        return response


__all__ = ["AuthMiddleware"]
