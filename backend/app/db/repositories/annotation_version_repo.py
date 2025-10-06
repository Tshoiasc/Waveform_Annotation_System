from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument


class AnnotationVersionRepository:
    """标注版本数据访问层"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db.annotation_versions

    async def list_versions(self, file_id: str, trial_index: int) -> List[Dict]:
        cursor = (
            self.collection
            .find({
                "fileId": file_id,
                "trialIndex": trial_index,
            })
            .sort("updatedAt", -1)
        )
        versions = await cursor.to_list(length=None)
        for item in versions:
            item["id"] = str(item.pop("_id"))
            created_at = item.get("createdAt")
            updated_at = item.get("updatedAt")
            if isinstance(created_at, datetime):
                item["createdAt"] = created_at.isoformat()
            if isinstance(updated_at, datetime):
                item["updatedAt"] = updated_at.isoformat()
        return versions

    async def find_by_id(self, version_id: str) -> Optional[Dict]:
        try:
            raw = await self.collection.find_one({"_id": ObjectId(version_id)})
            if not raw:
                return None
            raw["id"] = str(raw.pop("_id"))
            return raw
        except Exception:
            return None

    async def get_active_version(self, file_id: str, trial_index: int, user_id: str) -> Optional[Dict]:
        raw = await self.collection.find_one({
            "fileId": file_id,
            "trialIndex": trial_index,
            "userId": user_id,
            "status": {"$in": ["active", "draft"]},
        })
        if not raw:
            return None
        raw["id"] = str(raw.pop("_id"))
        return raw

    async def upsert_active_version(
        self,
        *,
        file_id: str,
        trial_index: int,
        user_id: str,
        username: Optional[str],
        segments_count: int,
        status: str = "active",
    ) -> Dict:
        now = datetime.now(timezone.utc)
        raw = await self.collection.find_one_and_update(
            filter={
                "fileId": file_id,
                "trialIndex": trial_index,
                "userId": user_id,
            },
            update={
                "$set": {
                    "fileId": file_id,
                    "trialIndex": trial_index,
                    "userId": user_id,
                    "username": username,
                    "status": status,
                    "segmentCount": segments_count,
                    "updatedAt": now,
                },
                "$setOnInsert": {
                    "createdAt": now,
                },
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        raw["id"] = str(raw.pop("_id"))
        return raw

    async def update_status(self, version_id: str, status: str) -> bool:
        try:
            result = await self.collection.update_one(
                {"_id": ObjectId(version_id)},
                {
                    "$set": {
                        "status": status,
                        "updatedAt": datetime.now(timezone.utc),
                    }
                },
            )
            return result.modified_count > 0
        except Exception:
            return False

    async def remove_version(self, version_id: str) -> bool:
        try:
            result = await self.collection.delete_one({"_id": ObjectId(version_id)})
            return result.deleted_count > 0
        except Exception:
            return False
