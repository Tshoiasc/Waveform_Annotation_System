from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.config.permissions import ALL_PERMISSIONS
from app.db.mongodb import get_database
from app.db.repositories.role_repo import RoleRepository
from app.utils.permissions import require_permission

router = APIRouter(prefix="/api/roles", tags=["角色管理"])


class RoleCreateRequest(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None
    permissions: List[str] = []


class RoleUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None


@router.get("")
@require_permission("roles.view")
async def list_roles(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """角色列表"""

    role_repo = RoleRepository(db)
    roles = await role_repo.list_all()

    for role in roles:
        role["id"] = str(role.pop("_id"))

    return {"roles": roles}


@router.get("/{role_id}")
@require_permission("roles.view")
async def get_role(
    role_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """角色详情"""

    role_repo = RoleRepository(db)
    role = await role_repo.find_by_id(role_id)
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")

    role["id"] = str(role.pop("_id"))
    return role


@router.post("")
@require_permission("roles.create")
async def create_role(
    data: RoleCreateRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """创建角色"""

    role_repo = RoleRepository(db)

    existing = await role_repo.find_by_name(data.name)
    if existing:
        raise HTTPException(status_code=400, detail="角色名称已存在")

    invalid_permissions = [p for p in data.permissions if p not in ALL_PERMISSIONS]
    if invalid_permissions:
        raise HTTPException(status_code=400, detail=f"无效的权限: {', '.join(invalid_permissions)}")

    role_data = {
        "name": data.name,
        "display_name": data.display_name,
        "description": data.description,
        "permissions": data.permissions,
    }

    role_id = await role_repo.create(role_data)

    return {
        "role_id": role_id,
        "name": data.name,
        "message": "角色创建成功",
    }


@router.put("/{role_id}")
@require_permission("roles.update")
async def update_role(
    role_id: str,
    data: RoleUpdateRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """更新角色"""

    role_repo = RoleRepository(db)

    role = await role_repo.find_by_id(role_id)
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")

    update_data = {}

    if data.display_name is not None:
        update_data["display_name"] = data.display_name

    if data.description is not None:
        update_data["description"] = data.description

    if data.permissions is not None:
        invalid_permissions = [p for p in data.permissions if p not in ALL_PERMISSIONS]
        if invalid_permissions:
            raise HTTPException(status_code=400, detail=f"无效的权限: {', '.join(invalid_permissions)}")
        update_data["permissions"] = data.permissions

    if data.is_active is not None:
        update_data["is_active"] = data.is_active

    if not update_data:
        return {"message": "没有需要更新的字段"}

    success = await role_repo.update(role_id, update_data)
    if not success:
        raise HTTPException(status_code=500, detail="角色更新失败")

    return {"message": "角色更新成功"}


@router.delete("/{role_id}")
@require_permission("roles.delete")
async def delete_role(
    role_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """删除角色"""

    role_repo = RoleRepository(db)

    role = await role_repo.find_by_id(role_id)
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")

    if role.get("is_system"):
        raise HTTPException(status_code=400, detail="系统预设角色不可删除")

    success = await role_repo.delete(role_id)
    if not success:
        raise HTTPException(status_code=500, detail="角色删除失败")

    return {"message": "角色删除成功"}


@router.get("/permissions/all")
@require_permission("roles.view")
async def get_all_permissions(request: Request):
    """查询所有权限"""

    permissions = [
        {
            "key": key,
            "description": value["description"],
            "category": value["category"],
        }
        for key, value in ALL_PERMISSIONS.items()
    ]

    return {"permissions": permissions}
