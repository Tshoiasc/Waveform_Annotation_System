from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict, Optional, List
from datetime import datetime

class TrialMetadataRepository:
    """Trial元数据数据访问层"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db.trial_metadata

    async def find_one(self, file_id: str, trial_index: int) -> Optional[Dict]:
        """查找单个Trial元数据"""
        return await self.collection.find_one({
            "fileId": file_id,
            "trialIndex": trial_index
        })

    async def insert_one(self, metadata: Dict) -> str:
        """插入Trial元数据"""
        metadata['createdAt'] = datetime.utcnow()
        result = await self.collection.insert_one(metadata)
        return str(result.inserted_id)

    async def update_one(self, file_id: str, trial_index: int, metadata: Dict) -> bool:
        """更新Trial元数据"""
        metadata['updatedAt'] = datetime.utcnow()
        result = await self.collection.update_one(
            {"fileId": file_id, "trialIndex": trial_index},
            {"$set": metadata}
        )
        return result.modified_count > 0

    async def find_by_file(self, file_id: str) -> list:
        """查找文件的所有Trial元数据"""
        cursor = self.collection.find({"fileId": file_id}).sort("trialIndex", 1)
        return await cursor.to_list(length=None)

    async def delete_by_file(self, file_id: str) -> int:
        """删除文件的所有Trial元数据"""
        result = await self.collection.delete_many({"fileId": file_id})
        return result.deleted_count

    async def find_or_create(
        self,
        file_id: str,
        trial_index: int,
        create_func
    ) -> Dict:
        """查找或创建Trial元数据 (缓存模式)"""
        # 先查询MongoDB
        metadata = await self.find_one(file_id, trial_index)

        if metadata:
            # 确保存在finished字段
            if 'finished' not in metadata:
                metadata['finished'] = False
            if 'finishedAt' not in metadata:
                metadata['finishedAt'] = None

            # 移除MongoDB的_id字段和其他不需要的字段
            metadata.pop('_id', None)
            metadata.pop('createdAt', None)
            metadata.pop('updatedAt', None)
            return metadata

        # 如果不存在，调用create_func生成
        metadata = create_func()  # create_func是同步函数，不需要await
        metadata['fileId'] = file_id
        metadata['trialIndex'] = trial_index
        metadata['finished'] = False
        metadata['finishedAt'] = None

        # 插入MongoDB
        await self.insert_one(metadata.copy())  # 使用copy避免修改原数据

        return metadata

    async def count_status_by_file(self, file_id: str) -> Dict[str, int]:
        """统计文件对应的Trial数量及完成数量"""
        total = await self.collection.count_documents({"fileId": file_id})
        finished = await self.collection.count_documents({
            "fileId": file_id,
            "finished": True
        })
        return {
            "totalTrials": int(total),
            "finishedTrials": int(finished)
        }

    async def get_status_map(self, file_ids: Optional[List[str]] = None) -> Dict[str, Dict[str, int]]:
        """一次性获取文件的Trial统计信息"""
        pipeline = []
        if file_ids:
            pipeline.append({"$match": {"fileId": {"$in": file_ids}}})

        pipeline.append(
            {
                "$group": {
                    "_id": "$fileId",
                    "totalTrials": {"$sum": 1},
                    "finishedTrials": {
                        "$sum": {
                            "$cond": [
                                {"$eq": ["$finished", True]},
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        )

        cursor = self.collection.aggregate(pipeline)
        results = await cursor.to_list(length=None)

        status_map: Dict[str, Dict[str, int]] = {}
        for item in results:
            file_id = item.get('_id')
            if not file_id:
                continue
            status_map[file_id] = {
                "totalTrials": int(item.get('totalTrials', 0)),
                "finishedTrials": int(item.get('finishedTrials', 0))
            }

        return status_map

    async def set_file_finished(self, file_id: str, finished: bool) -> int:
        """批量更新文件下所有Trial的完成状态"""
        timestamp = datetime.utcnow()
        update_fields = {
            "finished": finished,
            "updatedAt": timestamp
        }
        update_fields["finishedAt"] = timestamp if finished else None

        result = await self.collection.update_many(
            {"fileId": file_id},
            {"$set": update_fields}
        )
        return result.modified_count

    async def set_trial_finished(self, file_id: str, trial_index: int, finished: bool) -> bool:
        """更新单个Trial的完成状态"""
        timestamp = datetime.utcnow()
        update_fields = {
            "finished": finished,
            "updatedAt": timestamp,
            "finishedAt": timestamp if finished else None
        }

        result = await self.collection.update_one(
            {"fileId": file_id, "trialIndex": trial_index},
            {"$set": update_fields}
        )
        return result.modified_count > 0
