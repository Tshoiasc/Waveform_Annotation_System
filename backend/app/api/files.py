from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db import get_database
from app.db.repositories.trial_metadata_repo import TrialMetadataRepository
from app.db.repositories.annotation_version_repo import AnnotationVersionRepository
from app.db.repositories.annotation_repo import AnnotationRepository
from app.services import h5_service
from typing import List, Dict
from pathlib import Path
from pydantic import BaseModel

router = APIRouter(prefix="/api/files", tags=["files"])


class FileStatusUpdate(BaseModel):
    finished: bool


class TrialStatusUpdate(BaseModel):
    finished: bool


@router.get("")
async def list_files(db: AsyncIOMotorDatabase = Depends(get_database)) -> List[Dict]:
    """获取所有H5文件列表"""
    try:
        files = h5_service.scan_files()

        repo = TrialMetadataRepository(db)
        annotation_repo = AnnotationRepository(db)
        version_repo = AnnotationVersionRepository(db)
        file_ids = [file['fileId'] for file in files]
        status_map = await repo.get_status_map(file_ids)
        annotation_map = await annotation_repo.count_by_files(file_ids)

        # 为每个文件添加trial数量
        for file_info in files:
            file_info['trialCount'] = h5_service.load_trial_count(file_info['fullPath'])
            stats = status_map.get(file_info['fileId'], {
                'totalTrials': 0,
                'finishedTrials': 0
            })
            annotation_counts = annotation_map.get(file_info['fileId'], {})
            file_info['finishedTrials'] = stats['finishedTrials']
            file_info['metadataTrials'] = stats['totalTrials']
            file_info['isFinished'] = (
                file_info['trialCount'] > 0 and
                stats['finishedTrials'] >= file_info['trialCount']
            )
            file_info['hasStarted'] = any(count > 0 for count in annotation_counts.values())

        return files

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to scan files: {str(e)}")


@router.get("/{file_id:path}/trials")
async def list_trials(
    file_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> List[Dict]:
    """获取文件的所有Trial元数据 (含缩略图)"""
    try:
        # 构建完整文件路径
        data_root = Path(h5_service.data_root)
        file_path = data_root / file_id

        if not file_path.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {file_id}")

        # 获取trial数量
        trial_count = h5_service.load_trial_count(str(file_path))

        if trial_count == 0:
            return []

        # 创建Repository
        repo = TrialMetadataRepository(db)
        annotation_repo = AnnotationRepository(db)
        version_repo = AnnotationVersionRepository(db)
        annotation_map = await annotation_repo.count_by_files([file_id])
        annotation_counts = annotation_map.get(file_id, {})

        # 加载所有trials的元数据 (使用缓存)
        trials = []
        for i in range(trial_count):
            metadata = await repo.find_or_create(
                file_id,
                i,
                lambda idx=i: h5_service.load_trial_metadata(str(file_path), idx)
            )
            metadata['annotationCount'] = annotation_counts.get(i, 0)
            # 计算版本数量（每个Trial一个用户最多1个版本，但总体可能多人多版本）
            try:
                versions = await version_repo.list_versions(file_id, i)
                metadata['versionCount'] = len(versions)
            except Exception:
                metadata['versionCount'] = 0
            trials.append(metadata)

        return trials

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load trials: {str(e)}"
        )


@router.patch("/{file_id:path}/trials/{trial_index}/status")
async def update_trial_status(
    file_id: str,
    trial_index: int,
    payload: TrialStatusUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Dict:
    """更新单个Trial的完成状态"""
    try:
        data_root = Path(h5_service.data_root)
        file_path = data_root / file_id

        if not file_path.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {file_id}")

        trial_count = h5_service.load_trial_count(str(file_path))
        if trial_index < 0 or trial_index >= trial_count:
            raise HTTPException(status_code=404, detail=f"Trial index {trial_index} out of range")

        repo = TrialMetadataRepository(db)

        await repo.find_or_create(
            file_id,
            trial_index,
            lambda idx=trial_index: h5_service.load_trial_metadata(str(file_path), idx)
        )

        updated = await repo.set_trial_finished(file_id, trial_index, payload.finished)
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to update trial status")

        stats = await repo.count_status_by_file(file_id)
        annotation_repo = AnnotationRepository(db)
        annotation_map = await annotation_repo.count_by_files([file_id])
        annotation_counts = annotation_map.get(file_id, {})

        return {
            "fileId": file_id,
            "trialIndex": trial_index,
            "finished": payload.finished,
            "annotationCount": annotation_counts.get(trial_index, 0),
            "fileFinishedTrials": stats['finishedTrials'],
            "fileTotalTrials": stats['totalTrials'],
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update trial status: {str(e)}"
        )


@router.patch("/{file_id:path}/status")
async def update_file_status(
    file_id: str,
    payload: FileStatusUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Dict:
    """更新指定H5文件下所有Trial的完成状态"""
    try:
        data_root = Path(h5_service.data_root)
        file_path = data_root / file_id

        if not file_path.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {file_id}")

        trial_count = h5_service.load_trial_count(str(file_path))

        repo = TrialMetadataRepository(db)

        # 确保所有Trial的元数据已创建
        for i in range(trial_count):
            await repo.find_or_create(
                file_id,
                i,
                lambda idx=i: h5_service.load_trial_metadata(str(file_path), idx)
            )

        modified = await repo.set_file_finished(file_id, payload.finished)
        stats = await repo.count_status_by_file(file_id)

        return {
            "fileId": file_id,
            "finished": payload.finished,
            "modifiedCount": modified,
            "finishedTrials": stats['finishedTrials'],
            "totalTrials": stats['totalTrials']
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update file status: {str(e)}"
        )


@router.get("/{file_id:path}/trials/{trial_index}/waveform")
async def get_waveform(
    file_id: str,
    trial_index: int,
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Dict:
    """获取Trial的完整波形数据 (已预处理)"""
    try:
        # 构建完整文件路径
        data_root = Path(h5_service.data_root)
        file_path = data_root / file_id

        if not file_path.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {file_id}")

        # 预处理波形
        waveform = h5_service.preprocess_waveform(str(file_path), trial_index)

        return waveform

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load waveform: {str(e)}"
        )


async def _load_metadata_async(file_path: str, trial_index: int) -> Dict:
    """异步加载元数据 (用于缓存模式)"""
    return h5_service.load_trial_metadata(file_path, trial_index)
