from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.db import get_database
from app.db.repositories.annotation_repo import AnnotationRepository
from app.db.repositories.annotation_version_repo import AnnotationVersionRepository
from app.utils.permissions import get_current_user, require_permission

router = APIRouter(prefix="/api/annotations", tags=["标注"])


class AnnotationSegmentPayload(BaseModel):
    """前端同步的标注片段"""

    id: Optional[str] = None
    phaseId: str
    phaseName: Optional[str] = None
    startTime: float
    endTime: float
    startIndex: int
    endIndex: int
    eventIndex: int
    color: Optional[str] = None
    label: Optional[str] = None


class AnnotationSyncPayload(BaseModel):
    """草稿上传负载"""

    segments: List[AnnotationSegmentPayload] = Field(default_factory=list)
    clientUpdatedAt: datetime = Field(default_factory=datetime.utcnow)
    status: str = Field(default="active", pattern="^(active|draft)$")


# 在未来注解模式下显式重建模型，防止前向引用解析失败
AnnotationSegmentPayload.model_rebuild(_types_namespace=globals(), force=True)
AnnotationSyncPayload.model_rebuild(_types_namespace=globals(), force=True)


def _serialize_segment(segment: Dict) -> Dict:
    segment_copy = segment.copy()
    segment_copy["id"] = str(segment_copy.pop("_id")) if "_id" in segment_copy else segment_copy.get("id")
    segment_copy.setdefault("color", None)
    segment_copy.setdefault("label", None)
    segment_copy.setdefault("userId", segment_copy.get("userId"))
    return segment_copy


def _serialize_version(version: Dict, *, current_user_id: Optional[str]) -> Dict:
    return {
        "id": version.get("id"),
        "fileId": version.get("fileId"),
        "trialIndex": version.get("trialIndex"),
        "userId": version.get("userId"),
        "username": version.get("username"),
        "status": version.get("status", "active"),
        "segmentCount": int(version.get("segmentCount", 0)),
        "createdAt": version.get("createdAt").isoformat() if isinstance(version.get("createdAt"), datetime) else version.get("createdAt"),
        "updatedAt": version.get("updatedAt").isoformat() if isinstance(version.get("updatedAt"), datetime) else version.get("updatedAt"),
        "isOwner": bool(current_user_id and version.get("userId") == current_user_id),
    }


@router.get("/{file_id:path}/trials/{trial_index}")
@require_permission("annotations.view")
async def get_annotations(
    file_id: str,
    trial_index: int,
    request: Request,
    version_id: Optional[str] = Query(None, description="指定版本ID"),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> Dict:
    """获取Trial下的标注版本及指定版本的数据"""

    current_user = get_current_user(request)
    user_id = current_user.get("user_id")

    version_repo = AnnotationVersionRepository(db)
    annotation_repo = AnnotationRepository(db)

    versions = await version_repo.list_versions(file_id, trial_index)

    if not versions:
        legacy_annotations = await annotation_repo.find_by_trial(file_id, trial_index)
        legacy_payload = [
            {
                **segment,
                "versionId": None,
            }
            for segment in legacy_annotations
        ]
        return {
            "versions": [],
            "annotations": legacy_payload,
            "activeVersionId": None,
        }

    selected_version_id: Optional[str] = version_id
    if not selected_version_id and user_id:
        for version in versions:
            if version.get("userId") == user_id:
                selected_version_id = version.get("id")
                break

    if not selected_version_id and versions:
        selected_version_id = versions[0].get("id")

    annotations: List[Dict] = []
    if selected_version_id:
        annotations = await annotation_repo.find_by_version(selected_version_id)
        annotations = [
            {
                **segment,
                "versionId": selected_version_id,
            }
            for segment in annotations
        ]

    payload = {
        "versions": [
            _serialize_version(version, current_user_id=user_id)
            for version in versions
        ],
        "annotations": annotations,
        "activeVersionId": selected_version_id,
    }
    return payload


@router.get("/{file_id:path}/trials/{trial_index}/versions")
@require_permission("annotations.view")
async def list_annotation_versions(
    file_id: str,
    trial_index: int,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> Dict:
    """列出指定Trial的所有标注版本"""

    current_user = get_current_user(request)
    user_id = current_user.get("user_id")

    version_repo = AnnotationVersionRepository(db)
    versions = await version_repo.list_versions(file_id, trial_index)
    return {
        "versions": [
            _serialize_version(version, current_user_id=user_id)
            for version in versions
        ]
    }


@router.post("/{file_id:path}/trials/{trial_index}/sync")
@require_permission("annotations.update")
async def sync_annotations(
    file_id: str,
    trial_index: int,
    request: Request,
    payload: AnnotationSyncPayload,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> Dict:
    """同步草稿或保存当前用户的标注版本"""

    current_user = get_current_user(request)
    user_id = current_user.get("user_id")
    username = current_user.get("username")

    if not user_id:
        raise HTTPException(status_code=401, detail="未认证用户无法上传草稿")

    version_repo = AnnotationVersionRepository(db)
    annotation_repo = AnnotationRepository(db)

    existing_version = await version_repo.get_active_version(file_id, trial_index, user_id)

    if existing_version:
        server_updated_at = existing_version.get("updatedAt")
        if isinstance(server_updated_at, datetime):
            client_dt = payload.clientUpdatedAt
            server_dt = server_updated_at
            # 统一为 UTC 有时区时间，避免 naive/aware 比较报错
            if client_dt.tzinfo is None:
                client_dt = client_dt.replace(tzinfo=timezone.utc)
            if server_dt.tzinfo is None:
                server_dt = server_dt.replace(tzinfo=timezone.utc)
            if client_dt < server_dt:
                raise HTTPException(
                    status_code=409,
                    detail="检测到更新冲突，请先刷新最新版本后再尝试上传",
                )

    segments_data = [segment.model_dump(exclude_none=True) for segment in payload.segments]

    target_version = await version_repo.upsert_active_version(
        file_id=file_id,
        trial_index=trial_index,
        user_id=user_id,
        username=username,
        segments_count=len(segments_data),
        status=payload.status,
    )

    await annotation_repo.replace_for_version(
        file_id=file_id,
        trial_index=trial_index,
        version_id=target_version["id"],
        user_id=user_id,
        segments=segments_data,
    )

    result = {
        "versionId": target_version["id"],
        "syncedAt": datetime.now(timezone.utc).isoformat(),
        "segmentCount": len(segments_data),
        "status": payload.status,
    }
    return result


@router.delete("/{file_id:path}/trials/{trial_index}/versions/{version_id}")
@require_permission("annotations.delete")
async def delete_version(
    file_id: str,
    trial_index: int,
    version_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> Dict:
    """删除指定版本，主要用于管理员清理数据"""

    current_user = get_current_user(request)
    user_id = current_user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="未认证用户无法执行该操作")

    version_repo = AnnotationVersionRepository(db)
    annotation_repo = AnnotationRepository(db)

    version = await version_repo.find_by_id(version_id)
    if not version or version.get("fileId") != file_id or version.get("trialIndex") != trial_index:
        raise HTTPException(status_code=404, detail="未找到目标版本")

    # 允许拥有者或具备删除权限的角色执行
    if version.get("userId") != user_id and "annotations.delete" not in current_user.get("permissions", []):
        raise HTTPException(status_code=403, detail="仅拥有者可删除该版本")

    await annotation_repo.delete_by_version(version_id)
    await version_repo.remove_version(version_id)

    return {"success": True, "message": "版本已删除"}


# 旧版接口保留占位，但不再提供逐条增删改能力
@router.post("")
async def deprecated_create_annotation() -> Dict:
    raise HTTPException(status_code=410, detail="该接口已废弃，请使用批量同步接口")


@router.patch("/{annotation_id}")
async def deprecated_update_annotation(annotation_id: str) -> Dict:
    raise HTTPException(status_code=410, detail="该接口已废弃，请使用批量同步接口")


@router.delete("/{annotation_id}")
async def deprecated_delete_annotation(annotation_id: str) -> Dict:
    raise HTTPException(status_code=410, detail="该接口已废弃，请使用批量同步接口")
