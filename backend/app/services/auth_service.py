from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.repositories.role_repo import RoleRepository
from app.db.repositories.user_repo import UserRepository


class AuthService:
    """认证与授权服务"""

    def __init__(self, secret_key: str, algorithm: str = "HS256", expiration_days: int = 7) -> None:
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.expiration_days = expiration_days

    def create_access_token(
        self,
        user_id: str,
        username: str,
        role_id: str,
        role_name: str,
        permissions: list,
    ) -> str:
        payload = {
            "sub": user_id,
            "username": username,
            "role_id": role_id,
            "role_name": role_name,
            "permissions": permissions,
            "exp": datetime.utcnow() + timedelta(days=self.expiration_days),
            "iat": datetime.utcnow(),
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)

    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        try:
            return jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
        except ExpiredSignatureError:
            return None
        except JWTError:
            return None

    async def authenticate_user(
        self,
        db: AsyncIOMotorDatabase,
        username: str,
        password: str,
    ) -> Optional[Dict[str, Any]]:
        user_repo = UserRepository(db)
        role_repo = RoleRepository(db)

        if not await user_repo.verify_password(username, password):
            return None

        user = await user_repo.find_by_username(username)
        if not user or not user.get("is_active"):
            return None

        role = await role_repo.find_by_id(user["role_id"])
        if not role or not role.get("is_active"):
            return None

        await user_repo.update_last_login(str(user["_id"]))

        return {
            "user": user,
            "role": role,
        }
