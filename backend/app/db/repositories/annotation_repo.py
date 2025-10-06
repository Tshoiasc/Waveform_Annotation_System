from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict, List, Optional
from datetime import datetime, timezone
from bson import ObjectId


class AnnotationRepository:
    """标注数据访问层"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db.annotations

    async def find_by_trial(self, file_id: str, trial_index: int, *, version_id: Optional[str] = None) -> List[Dict]:
        """查找Trial的标注，可选按版本过滤"""

        query: Dict = {
            "fileId": file_id,
            "trialIndex": trial_index,
        }
        if version_id:
            query["versionId"] = version_id

        cursor = self.collection.find(query).sort("startTime", 1)
        annotations = await cursor.to_list(length=None)

        for ann in annotations:
            ann["id"] = str(ann.pop("_id"))
            created_at = ann.get("createdAt")
            updated_at = ann.get("updatedAt")
            if isinstance(created_at, datetime):
                ann["createdAt"] = created_at.isoformat()
            if isinstance(updated_at, datetime):
                ann["updatedAt"] = updated_at.isoformat()

        return annotations

    async def find_by_version(self, version_id: str) -> List[Dict]:
        cursor = self.collection.find({
            "versionId": version_id,
        }).sort("startTime", 1)
        annotations = await cursor.to_list(length=None)
        for ann in annotations:
            ann["id"] = str(ann.pop("_id"))
            created_at = ann.get("createdAt")
            updated_at = ann.get("updatedAt")
            if isinstance(created_at, datetime):
                ann["createdAt"] = created_at.isoformat()
            if isinstance(updated_at, datetime):
                ann["updatedAt"] = updated_at.isoformat()
        return annotations

    async def find_one(self, annotation_id: str) -> Optional[Dict]:
        """查找单个标注"""
        try:
            ann = await self.collection.find_one({"_id": ObjectId(annotation_id)})
            if ann:
                ann["id"] = str(ann.pop("_id"))
            return ann
        except:
            return None

    async def insert_one(self, annotation: Dict) -> str:
        """插入标注"""
        annotation["createdAt"] = datetime.now(timezone.utc)
        annotation["updatedAt"] = datetime.now(timezone.utc)
        result = await self.collection.insert_one(annotation)
        return str(result.inserted_id)

    async def update_one(self, annotation_id: str, updates: Dict) -> bool:
        """更新标注"""
        try:
            updates["updatedAt"] = datetime.now(timezone.utc)
            result = await self.collection.update_one(
                {"_id": ObjectId(annotation_id)},
                {"$set": updates}
            )
            return result.modified_count > 0
        except:
            return False

    async def delete_one(self, annotation_id: str) -> bool:
        """删除标注"""
        try:
            result = await self.collection.delete_one({"_id": ObjectId(annotation_id)})
            return result.deleted_count > 0
        except:
            return False

    async def delete_by_trial(self, file_id: str, trial_index: int) -> int:
        """删除Trial的所有标注"""
        result = await self.collection.delete_many({
            "fileId": file_id,
            "trialIndex": trial_index
        })
        return result.deleted_count

    async def delete_by_version(self, version_id: str) -> int:
        result = await self.collection.delete_many({
            "versionId": version_id,
        })
        return result.deleted_count

    async def replace_for_version(
        self,
        *,
        file_id: str,
        trial_index: int,
        version_id: str,
        user_id: str,
        segments: List[Dict],
    ) -> None:
        """替换指定版本下的标注列表"""

        await self.collection.delete_many({
            "versionId": version_id,
        })

        if not segments:
            return

        now = datetime.now(timezone.utc)
        docs = []
        for seg in segments:
            doc = {
                "fileId": file_id,
                "trialIndex": trial_index,
                "versionId": version_id,
                "userId": user_id,
                "phaseId": seg.get("phaseId"),
                "phaseName": seg.get("phaseName") or seg.get("phaseId"),
                "startTime": seg.get("startTime"),
                "endTime": seg.get("endTime"),
                "startIndex": seg.get("startIndex"),
                "endIndex": seg.get("endIndex"),
                "eventIndex": seg.get("eventIndex"),
                "color": seg.get("color"),
                "label": seg.get("label"),
                "createdAt": now,
                "updatedAt": now,
            }
            docs.append(doc)

        if docs:
            await self.collection.insert_many(docs)

    async def count_by_files(self, file_ids: Optional[List[str]] = None) -> Dict[str, Dict[int, int]]:
        """统计多个文件下每个Trial的标注数量"""
        pipeline = []
        if file_ids:
            pipeline.append({"$match": {"fileId": {"$in": file_ids}}})

        pipeline.extend(
            [
                {
                    "$group": {
                        "_id": {
                            "fileId": "$fileId",
                            "trialIndex": "$trialIndex",
                        },
                        "count": {"$sum": 1},
                    }
                }
            ]
        )

        cursor = self.collection.aggregate(pipeline)
        results = await cursor.to_list(length=None)

        aggregated: Dict[str, Dict[int, int]] = {}
        for item in results:
            group = item.get('_id', {})
            file_id = group.get('fileId')
            if not file_id:
                continue
            trial_index = int(group.get('trialIndex', 0))
            aggregated.setdefault(file_id, {})[trial_index] = int(item.get('count', 0))

        return aggregated
