from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, EmailStr

from app.config import settings
from app.db.mongodb import get_database
from app.db.repositories.role_repo import RoleRepository
from app.db.repositories.user_repo import UserRepository
from app.services.auth_service import AuthService
from app.utils.permissions import get_current_user

router = APIRouter(prefix="/api/auth", tags=["认证"])


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


@router.post("/login")
async def login(
    data: LoginRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """用户登录"""

    auth_service = AuthService(
        secret_key=settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
        expiration_days=settings.JWT_EXPIRATION_DAYS,
    )

    auth_result = await auth_service.authenticate_user(db, data.username, data.password)
    if not auth_result:
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    user = auth_result["user"]
    role = auth_result["role"]

    token = auth_service.create_access_token(
        user_id=str(user["_id"]),
        username=user["username"],
        role_id=str(role["_id"]),
        role_name=role["name"],
        permissions=role["permissions"],
    )

    return {
        "access_token": token,
        "token_type": "Bearer",
        "user": {
            "id": str(user["_id"]),
            "username": user["username"],
            "role": {
                "name": role["name"],
                "display_name": role["display_name"],
                "permissions": role["permissions"],
            },
        },
    }


@router.post("/register")
async def register(
    data: RegisterRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """用户注册"""

    user_repo = UserRepository(db)
    role_repo = RoleRepository(db)

    existing = await user_repo.find_by_username(data.username)
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")

    if data.email:
        existing_email = await user_repo.find_by_email(data.email)
        if existing_email:
            raise HTTPException(status_code=400, detail="邮箱已被使用")

    default_role = await role_repo.find_by_name("user")
    if not default_role:
        raise HTTPException(status_code=500, detail="系统配置错误：默认角色不存在")

    user_data = {
        "username": data.username,
        "password": data.password,
        "email": data.email,
        "role_id": str(default_role["_id"]),
        "metadata": {
            "full_name": data.full_name,
        }
        if data.full_name
        else {},
    }

    user_id = await user_repo.create(user_data)

    return {
        "user_id": user_id,
        "username": data.username,
        "role": default_role["name"],
        "message": "注册成功",
    }


@router.get("/me")
async def get_current_user_info(request: Request):
    """获取当前用户信息"""

    return get_current_user(request)


@router.put("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """修改密码"""

    current_user = get_current_user(request)
    user_repo = UserRepository(db)

    if not await user_repo.verify_password(current_user["username"], data.old_password):
        raise HTTPException(status_code=400, detail="原密码错误")

    success = await user_repo.change_password(current_user["user_id"], data.new_password)
    if not success:
        raise HTTPException(status_code=500, detail="密码修改失败")

    return {"message": "密码修改成功"}


@router.post("/logout")
async def logout(request: Request):
    """登出接口，前端自行清理令牌"""

    return {"message": "登出成功"}
