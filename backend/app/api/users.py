from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, EmailStr

from app.db.mongodb import get_database
from app.db.repositories.role_repo import RoleRepository
from app.db.repositories.user_repo import UserRepository
from app.utils.permissions import get_current_user, require_permission

router = APIRouter(prefix="/api/users", tags=["用户管理"])


class UserCreateRequest(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    password: str
    role_id: str
    metadata: Optional[dict] = None


class UserUpdateRequest(BaseModel):
    email: Optional[EmailStr] = None
    role_id: Optional[str] = None
    is_active: Optional[bool] = None
    metadata: Optional[dict] = None


@router.get("")
@require_permission("users.view")
async def list_users(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
):
    """分页用户列表"""

    user_repo = UserRepository(db)
    role_repo = RoleRepository(db)

    total, users = await user_repo.list_with_pagination(
        page=page,
        page_size=page_size,
        role=role,
        is_active=is_active,
    )

    for user in users:
        role_obj = await role_repo.find_by_id(user["role_id"])
        user["role"] = {
            "id": str(role_obj["_id"]),
            "name": role_obj["name"],
            "display_name": role_obj["display_name"],
        } if role_obj else None
        user["id"] = str(user.pop("_id"))
        user.pop("password_hash", None)

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "users": users,
    }


@router.get("/{user_id}")
async def get_user(
    user_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """获取用户详情"""

    current_user = get_current_user(request)
    if user_id != current_user["user_id"]:
        if "users.view" not in current_user["permissions"]:
            raise HTTPException(status_code=403, detail="权限不足")

    user_repo = UserRepository(db)
    role_repo = RoleRepository(db)

    user = await user_repo.find_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    role = await role_repo.find_by_id(user["role_id"])

    user["id"] = str(user.pop("_id"))
    user["role"] = {
        "id": str(role["_id"]),
        "name": role["name"],
        "display_name": role["display_name"],
        "permissions": role["permissions"],
    } if role else None
    user.pop("password_hash", None)

    return user


@router.post("")
@require_permission("users.create")
async def create_user(
    data: UserCreateRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """创建新用户"""

    user_repo = UserRepository(db)
    role_repo = RoleRepository(db)

    existing = await user_repo.find_by_username(data.username)
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")

    if data.email:
        existing_email = await user_repo.find_by_email(data.email)
        if existing_email:
            raise HTTPException(status_code=400, detail="邮箱已被使用")

    role = await role_repo.find_by_id(data.role_id)
    if not role:
        raise HTTPException(status_code=400, detail="角色不存在")

    user_data = {
        "username": data.username,
        "email": data.email,
        "password": data.password,
        "role_id": data.role_id,
        "metadata": data.metadata or {},
    }

    user_id = await user_repo.create(user_data)

    return {
        "user_id": user_id,
        "username": data.username,
        "message": "用户创建成功",
    }


@router.put("/{user_id}")
async def update_user(
    user_id: str,
    data: UserUpdateRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """更新用户信息"""

    current_user = get_current_user(request)
    is_self = user_id == current_user["user_id"]
    can_update_others = "users.update" in current_user["permissions"]

    if not is_self and not can_update_others:
        raise HTTPException(status_code=403, detail="权限不足")

    if is_self and not can_update_others:
        if data.role_id is not None or data.is_active is not None:
            raise HTTPException(status_code=403, detail="无权修改角色或激活状态")

    user_repo = UserRepository(db)

    update_data = {}
    if data.email is not None:
        existing = await user_repo.find_by_email(data.email)
        if existing and str(existing["_id"]) != user_id:
            raise HTTPException(status_code=400, detail="邮箱已被使用")
        update_data["email"] = data.email

    if data.role_id is not None and can_update_others:
        update_data["role_id"] = data.role_id

    if data.is_active is not None and can_update_others:
        update_data["is_active"] = data.is_active

    if data.metadata is not None:
        update_data["metadata"] = data.metadata

    if not update_data:
        return {"message": "没有需要更新的字段"}

    success = await user_repo.update(user_id, update_data)
    if not success:
        raise HTTPException(status_code=404, detail="用户不存在或更新失败")

    return {"message": "用户更新成功"}


@router.delete("/{user_id}")
@require_permission("users.delete")
async def delete_user(
    user_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """软删除用户"""

    current_user = get_current_user(request)
    if user_id == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="不能删除自己")

    user_repo = UserRepository(db)
    success = await user_repo.delete(user_id)
    if not success:
        raise HTTPException(status_code=404, detail="用户不存在或删除失败")

    return {"message": "用户删除成功"}
