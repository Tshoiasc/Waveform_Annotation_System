from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserMetadata(BaseModel):
    """用户元数据"""

    full_name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None


class UserBase(BaseModel):
    """用户基础字段"""

    username: str
    email: Optional[EmailStr] = None
    metadata: Optional[UserMetadata] = None


class UserCreate(UserBase):
    """创建用户输入模型"""

    password: str
    role_id: Optional[str] = None


class UserUpdate(BaseModel):
    """更新用户输入模型"""

    email: Optional[EmailStr] = None
    role_id: Optional[str] = None
    is_active: Optional[bool] = None
    metadata: Optional[UserMetadata] = None


class UserInDB(UserBase):
    """数据库中的用户模型"""

    id: str = Field(alias="_id")
    password_hash: str
    role_id: str
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


class UserResponse(UserBase):
    """对外返回的用户数据"""

    id: str
    role: dict
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None
