from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import bcrypt
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


class UserRepository:
    """用户数据仓储"""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.collection = db["users"]

    async def find_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        return await self.collection.find_one({
            "username": username,
            "is_deleted": False,
        })

    async def find_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        try:
            return await self.collection.find_one({
                "_id": ObjectId(user_id),
                "is_deleted": False,
            })
        except Exception:
            return None

    async def find_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        return await self.collection.find_one({
            "email": email,
            "is_deleted": False,
        })

    async def create(self, user_data: Dict[str, Any]) -> str:
        password = user_data.pop("password")

        # 过滤掉值为 None 的字段，避免写入导致唯一索引冲突
        user_data = {
            key: value for key, value in user_data.items() if value is not None
        }

        user_data["password_hash"] = bcrypt.hashpw(
            password.encode(),
            bcrypt.gensalt(),
        ).decode()

        now = datetime.utcnow()
        user_data["created_at"] = now
        user_data["updated_at"] = now
        user_data["is_active"] = user_data.get("is_active", True)
        user_data["is_deleted"] = False

        result = await self.collection.insert_one(user_data)
        return str(result.inserted_id)

    async def update(self, user_id: str, update_data: Dict[str, Any]) -> bool:
        update_data["updated_at"] = datetime.utcnow()
        result = await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data},
        )
        return result.modified_count > 0

    async def delete(self, user_id: str) -> bool:
        result = await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}},
        )
        return result.modified_count > 0

    async def verify_password(self, username: str, password: str) -> bool:
        user = await self.find_by_username(username)
        if not user:
            return False
        return bcrypt.checkpw(
            password.encode(),
            user["password_hash"].encode(),
        )

    async def update_last_login(self, user_id: str) -> bool:
        result = await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"last_login_at": datetime.utcnow()}},
        )
        return result.modified_count > 0

    async def list_with_pagination(
        self,
        page: int = 1,
        page_size: int = 20,
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> Tuple[int, List[Dict[str, Any]]]:
        query: Dict[str, Any] = {"is_deleted": False}
        if role:
            query["role_id"] = role
        if is_active is not None:
            query["is_active"] = is_active

        total = await self.collection.count_documents(query)
        skip = (page - 1) * page_size

        cursor = self.collection.find(query).skip(skip).limit(page_size)
        users = await cursor.to_list(length=page_size)
        return total, users

    async def change_password(self, user_id: str, new_password: str) -> bool:
        password_hash = bcrypt.hashpw(
            new_password.encode(),
            bcrypt.gensalt(),
        ).decode()

        result = await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "password_hash": password_hash,
                "updated_at": datetime.utcnow(),
            }},
        )
        return result.modified_count > 0
