#!/usr/bin/env python3
"""初始化用户认证与授权配置"""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime

import bcrypt
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

# 将上级目录加入路径，确保可以导入 app 包
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings  # noqa: E402
from app.config.permissions import ROLE_PRESETS  # noqa: E402


async def init_auth_system() -> None:
    """初始化角色与管理员账户"""

    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DATABASE]

    print("开始初始化用户权限系统...")

    try:
        roles_collection = db["roles"]
        users_collection = db["users"]

        print("创建预设角色...")
        await roles_collection.delete_many({"is_system": True})

        admin_role_id = ObjectId()
        annotator_role_id = ObjectId()
        user_role_id = ObjectId()

        roles = [
            {
                "_id": admin_role_id,
                "name": "admin",
                "display_name": "管理员",
                "description": "系统管理员，拥有所有权限",
                "permissions": ROLE_PRESETS["admin"],
                "is_system": True,
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            },
            {
                "_id": annotator_role_id,
                "name": "annotator",
                "display_name": "标注员",
                "description": "负责数据标注的用户",
                "permissions": ROLE_PRESETS["annotator"],
                "is_system": True,
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            },
            {
                "_id": user_role_id,
                "name": "user",
                "display_name": "普通用户",
                "description": "普通用户，只能查看数据",
                "permissions": ROLE_PRESETS["user"],
                "is_system": True,
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            },
        ]

        await roles_collection.insert_many(roles)
        print("预设角色创建完成")

        print("创建默认管理员账户...")
        await users_collection.delete_one({"username": "admin"})

        password_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode()

        admin_user = {
            "username": "admin",
            "email": "admin@example.com",
            "password_hash": password_hash,
            "role_id": str(admin_role_id),
            "is_active": True,
            "is_deleted": False,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "metadata": {
                "full_name": "系统管理员",
                "department": "IT部门",
            },
        }

        await users_collection.insert_one(admin_user)
        print("默认管理员创建完成")
        print("用户名: admin")
        print("密码: admin123")
        print("请在首次登录后及时修改密码")

        print("创建数据库索引...")
        await users_collection.create_index("username", unique=True)
        await users_collection.create_index("email", unique=True, sparse=True)
        await users_collection.create_index("role_id")

        await roles_collection.create_index("name", unique=True)
        print("索引创建完成")

        print("用户权限系统初始化完成")
    except Exception as exc:  # pragma: no cover
        print(f"初始化失败: {exc}")
        raise
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(init_auth_system())
