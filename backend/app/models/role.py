from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class RoleBase(BaseModel):
    """角色基础字段"""

    name: str
    display_name: str
    description: Optional[str] = None
    permissions: List[str] = []


class RoleCreate(RoleBase):
    """创建角色请求模型"""

    pass


class RoleUpdate(BaseModel):
    """更新角色请求模型"""

    display_name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None


class RoleInDB(RoleBase):
    """数据库中的角色模型"""

    id: str = Field(alias="_id")
    is_system: bool = False
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class RoleResponse(RoleBase):
    """对外返回的角色信息"""

    id: str
    is_system: bool
    is_active: bool
