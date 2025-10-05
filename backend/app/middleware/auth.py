from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import settings
from app.services.auth_service import AuthService


class AuthMiddleware(BaseHTTPMiddleware):
    """JWT认证中间件"""

    EXCLUDE_PATHS = [
        "/",
        "/health",
        "/docs",
        "/openapi.json",
        "/api/auth/login",
        "/api/auth/register",
    ]

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        if request.url.path in self.EXCLUDE_PATHS or request.url.path.startswith("/docs"):
            return await call_next(request)

        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "未提供认证令牌"})

        token = auth_header.split(" ")[1]
        auth_service = AuthService(
            secret_key=settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
            expiration_days=settings.JWT_EXPIRATION_DAYS,
        )

        payload = auth_service.verify_token(token)
        if not payload:
            return JSONResponse(status_code=401, content={"detail": "令牌无效或已过期"})

        request.state.user_id = payload["sub"]
        request.state.username = payload["username"]
        request.state.role_id = payload["role_id"]
        request.state.role_name = payload["role_name"]
        request.state.permissions = payload["permissions"]

        return await call_next(request)


__all__ = ["AuthMiddleware"]
