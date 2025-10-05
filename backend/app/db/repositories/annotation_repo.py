from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict, List, Optional
from datetime import datetime


class AnnotationRepository:
    """标注数据访问层"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db.annotations

    async def find_by_trial(self, file_id: str, trial_index: int) -> List[Dict]:
        """查找Trial的所有标注"""
        cursor = self.collection.find({
            "fileId": file_id,
            "trialIndex": trial_index
        }).sort("startTime", 1)
        annotations = await cursor.to_list(length=None)

        # 转换_id为字符串
        for ann in annotations:
            ann['id'] = str(ann['_id'])
            del ann['_id']

        return annotations

    async def find_one(self, annotation_id: str) -> Optional[Dict]:
        """查找单个标注"""
        from bson import ObjectId
        try:
            ann = await self.collection.find_one({"_id": ObjectId(annotation_id)})
            if ann:
                ann['id'] = str(ann['_id'])
                del ann['_id']
            return ann
        except:
            return None

    async def insert_one(self, annotation: Dict) -> str:
        """插入标注"""
        annotation['createdAt'] = datetime.utcnow()
        annotation['updatedAt'] = datetime.utcnow()
        result = await self.collection.insert_one(annotation)
        return str(result.inserted_id)

    async def update_one(self, annotation_id: str, updates: Dict) -> bool:
        """更新标注"""
        from bson import ObjectId
        try:
            updates['updatedAt'] = datetime.utcnow()
            result = await self.collection.update_one(
                {"_id": ObjectId(annotation_id)},
                {"$set": updates}
            )
            return result.modified_count > 0
        except:
            return False

    async def delete_one(self, annotation_id: str) -> bool:
        """删除标注"""
        from bson import ObjectId
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
