from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


class RoleRepository:
    """角色数据仓储"""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.collection = db["roles"]

    async def find_by_id(self, role_id: str) -> Optional[Dict[str, Any]]:
        try:
            return await self.collection.find_one({"_id": ObjectId(role_id)})
        except Exception:
            return None

    async def find_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        return await self.collection.find_one({"name": name})

    async def create(self, role_data: Dict[str, Any]) -> str:
        now = datetime.utcnow()
        role_data["created_at"] = now
        role_data["updated_at"] = now
        role_data["is_system"] = role_data.get("is_system", False)
        role_data["is_active"] = role_data.get("is_active", True)

        result = await self.collection.insert_one(role_data)
        return str(result.inserted_id)

    async def update(self, role_id: str, update_data: Dict[str, Any]) -> bool:
        update_data["updated_at"] = datetime.utcnow()
        result = await self.collection.update_one(
            {"_id": ObjectId(role_id)},
            {"$set": update_data},
        )
        return result.modified_count > 0

    async def delete(self, role_id: str) -> bool:
        role = await self.find_by_id(role_id)
        if role and role.get("is_system"):
            return False

        result = await self.collection.delete_one({"_id": ObjectId(role_id)})
        return result.deleted_count > 0

    async def list_all(self, include_inactive: bool = False) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {} if include_inactive else {"is_active": True}
        cursor = self.collection.find(query)
        return await cursor.to_list(length=None)
