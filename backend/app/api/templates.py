from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db import get_database
from app.db.repositories.template_repo import TemplateRepository
from app.models.event_template import EventTemplateCreate, EventTemplateUpdate
from typing import List, Dict, Optional

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("")
async def list_templates(
    scope: Optional[str] = Query(None, description="global | private"),
    userId: Optional[str] = Query(None, description="用户ID"),
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> List[Dict]:
    """获取模板列表"""
    try:
        repo = TemplateRepository(db)
        templates = await repo.find_all(scope=scope, user_id=userId)
        return templates
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch templates: {str(e)}")


@router.get("/{template_id}")
async def get_template(
    template_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Dict:
    """获取单个模板"""
    try:
        repo = TemplateRepository(db)
        template = await repo.find_by_id(template_id)
        
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        return template
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch template: {str(e)}")


@router.post("")
async def create_template(
    template: EventTemplateCreate,
    userId: Optional[str] = Query(None, description="创建者用户ID"),
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Dict:
    """创建模板"""
    try:
        repo = TemplateRepository(db)
        
        # Convert Pydantic model to dict
        template_data = template.dict()
        template_data['createdBy'] = userId
        
        template_id = await repo.insert_one(template_data)
        created = await repo.find_by_id(template_id)
        
        if not created:
            raise HTTPException(status_code=500, detail="Failed to retrieve created template")
        
        return created
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create template: {str(e)}")


@router.put("/{template_id}")
async def update_template(
    template_id: str,
    updates: EventTemplateUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Dict:
    """更新模板"""
    try:
        repo = TemplateRepository(db)
        
        # Only update provided fields
        update_data = {k: v for k, v in updates.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        success = await repo.update_one(template_id, update_data)
        
        if not success:
            raise HTTPException(status_code=404, detail="Template not found")
        
        updated = await repo.find_by_id(template_id)
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update template: {str(e)}")


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Dict:
    """删除模板"""
    try:
        repo = TemplateRepository(db)
        success = await repo.delete_one(template_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Template not found")
        
        return {"success": True, "message": "Template deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete template: {str(e)}")
