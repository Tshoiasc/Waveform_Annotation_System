from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from typing import List, Dict, Optional
from datetime import datetime


class TemplateRepository:
    """模板Repository"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db.event_templates

    async def find_all(self, scope: Optional[str] = None, user_id: Optional[str] = None) -> List[Dict]:
        """获取模板列表
        
        Args:
            scope: 'global' | 'private' | None (all)
            user_id: 用户ID (用于私有模板筛选)
        """
        query = {}
        
        if scope == 'global':
            query['isGlobal'] = True
        elif scope == 'private' and user_id:
            query['isGlobal'] = False
            query['createdBy'] = user_id
        
        cursor = self.collection.find(query).sort('createdAt', -1)
        templates = await cursor.to_list(length=100)
        
        # Convert ObjectId to string
        for template in templates:
            template['_id'] = str(template['_id'])
            if template.get('createdBy'):
                template['createdBy'] = str(template['createdBy'])
        
        return templates

    async def find_by_id(self, template_id: str) -> Optional[Dict]:
        """根据ID获取模板"""
        try:
            template = await self.collection.find_one({'_id': ObjectId(template_id)})
            if template:
                template['_id'] = str(template['_id'])
                if template.get('createdBy'):
                    template['createdBy'] = str(template['createdBy'])
            return template
        except Exception as e:
            print(f"Error finding template: {e}")
            return None

    async def insert_one(self, data: Dict) -> str:
        """创建模板"""
        data['createdAt'] = datetime.now()
        data['updatedAt'] = datetime.now()
        
        result = await self.collection.insert_one(data)
        return str(result.inserted_id)

    async def update_one(self, template_id: str, updates: Dict) -> bool:
        """更新模板"""
        try:
            updates['updatedAt'] = datetime.now()
            result = await self.collection.update_one(
                {'_id': ObjectId(template_id)},
                {'$set': updates}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating template: {e}")
            return False

    async def delete_one(self, template_id: str) -> bool:
        """删除模板"""
        try:
            result = await self.collection.delete_one({'_id': ObjectId(template_id)})
            return result.deleted_count > 0
        except Exception as e:
            print(f"Error deleting template: {e}")
            return False
