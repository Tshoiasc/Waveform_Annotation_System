from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db import get_database
from app.db.repositories.annotation_repo import AnnotationRepository
from typing import List, Dict
from pydantic import BaseModel

router = APIRouter(prefix="/api/annotations", tags=["annotations"])


# Pydantic 模型
class AnnotationCreate(BaseModel):
    fileId: str
    trialIndex: int
    phaseId: str
    phaseName: str
    startTime: float
    endTime: float
    startIndex: int
    endIndex: int
    eventIndex: int
    color: str | None = None
    label: str | None = None


class AnnotationUpdate(BaseModel):
    phaseId: str | None = None
    phaseName: str | None = None
    startTime: float | None = None
    endTime: float | None = None
    startIndex: int | None = None
    endIndex: int | None = None
    eventIndex: int | None = None
    color: str | None = None
    label: str | None = None


@router.get("/{file_id:path}/trials/{trial_index}")
async def get_annotations(
    file_id: str,
    trial_index: int,
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> List[Dict]:
    """获取Trial的所有标注"""
    try:
        repo = AnnotationRepository(db)
        annotations = await repo.find_by_trial(file_id, trial_index)
        return annotations
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load annotations: {str(e)}"
        )


@router.post("")
async def create_annotation(
    annotation: AnnotationCreate,
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Dict:
    """创建标注"""
    try:
        repo = AnnotationRepository(db)
        annotation_dict = annotation.model_dump()
        annotation_id = await repo.insert_one(annotation_dict)

        # 返回创建的标注
        created = await repo.find_one(annotation_id)
        if not created:
            raise HTTPException(status_code=500, detail="Failed to retrieve created annotation")

        return created
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create annotation: {str(e)}"
        )


@router.patch("/{annotation_id}")
async def update_annotation(
    annotation_id: str,
    updates: AnnotationUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Dict:
    """更新标注"""
    try:
        repo = AnnotationRepository(db)

        # 只更新提供的字段
        update_dict = {k: v for k, v in updates.model_dump().items() if v is not None}

        if not update_dict:
            raise HTTPException(status_code=400, detail="No fields to update")

        success = await repo.update_one(annotation_id, update_dict)

        if not success:
            raise HTTPException(status_code=404, detail="Annotation not found")

        # 返回更新后的标注
        updated = await repo.find_one(annotation_id)
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update annotation: {str(e)}"
        )


@router.delete("/{annotation_id}")
async def delete_annotation(
    annotation_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Dict:
    """删除标注"""
    try:
        repo = AnnotationRepository(db)
        success = await repo.delete_one(annotation_id)

        if not success:
            raise HTTPException(status_code=404, detail="Annotation not found")

        return {"success": True, "message": "Annotation deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete annotation: {str(e)}"
        )
