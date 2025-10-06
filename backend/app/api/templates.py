from fastapi import APIRouter, Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db import get_database
from app.db.repositories.template_repo import TemplateRepository
from app.models.event_template import EventTemplateCreate, EventTemplateUpdate
from app.utils.permissions import require_permission
from typing import List, Dict

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("")
@require_permission("templates.view")
async def list_templates(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> List[Dict]:
    """获取模板列表"""
    try:
        repo = TemplateRepository(db)
        templates = await repo.find_all()
        return templates
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch templates: {str(e)}")


@router.get("/{template_id}")
@require_permission("templates.view")
async def get_template(
    template_id: str,
    request: Request,
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
@require_permission("templates.create")
async def create_template(
    template: EventTemplateCreate,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Dict:
    """创建模板"""
    try:
        repo = TemplateRepository(db)
        
        # Convert Pydantic model to dict
        template_data = template.model_dump()

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
@require_permission("templates.update")
async def update_template(
    template_id: str,
    updates: EventTemplateUpdate,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Dict:
    """更新模板"""
    try:
        repo = TemplateRepository(db)
        
        # Only update provided fields
        update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
        
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
@require_permission("templates.delete")
async def delete_template(
    template_id: str,
    request: Request,
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
