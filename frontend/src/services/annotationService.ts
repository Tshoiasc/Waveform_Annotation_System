import { apiClient } from './api'
import type {
  AnnotationSegment,
  AnnotationVersionMeta,
  AnnotationSyncResult,
} from '../types/waveform'

const API_BASE = '/api/annotations'

const annotationService = {
  async getAnnotations(
    fileId: string,
    trialIndex: number,
    versionId?: string
  ): Promise<{
    annotations: AnnotationSegment[]
    versions: AnnotationVersionMeta[]
    activeVersionId: string | null
  }> {
    const query = versionId ? `?version_id=${encodeURIComponent(versionId)}` : ''
    const response = await apiClient.get(`${API_BASE}/${fileId}/trials/${trialIndex}${query}`)
    if (!response.ok) {
      throw new Error('获取标注数据失败')
    }
    const data = await response.json()
    return {
      annotations: (data.annotations ?? []) as AnnotationSegment[],
      versions: (data.versions ?? []) as AnnotationVersionMeta[],
      activeVersionId: data.activeVersionId ?? null,
    }
  },

  async listVersions(fileId: string, trialIndex: number): Promise<AnnotationVersionMeta[]> {
    const response = await apiClient.get(`${API_BASE}/${fileId}/trials/${trialIndex}/versions`)
    if (!response.ok) {
      throw new Error('获取标注版本失败')
    }
    const data = await response.json()
    return (data.versions ?? []) as AnnotationVersionMeta[]
  },

  async syncDraft(
    fileId: string,
    trialIndex: number,
    segments: AnnotationSegment[],
    clientUpdatedAt: string,
    status: 'active' | 'draft' = 'active'
  ): Promise<AnnotationSyncResult> {
    const payload = {
      segments: segments.map((segment) => ({
        phaseId: segment.phaseId,
        phaseName: segment.phaseName ?? segment.phaseId,
        startTime: segment.startTime,
        endTime: segment.endTime,
        startIndex: segment.startIndex,
        endIndex: segment.endIndex,
        eventIndex: segment.eventIndex,
        color: segment.color,
        label: segment.label,
      })),
      clientUpdatedAt,
      status,
    }

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[annotation] sync payload', payload)
    }

    const response = await apiClient.post(
      `${API_BASE}/${fileId}/trials/${trialIndex}/sync`,
      payload
    )
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      if (process.env.NODE_ENV !== 'production') {
        console.error('[annotation] sync error', response.status, errorBody)
      }
      const message = typeof errorBody.detail === 'string' ? errorBody.detail : '同步草稿失败'
      throw new Error(message)
    }
    return (await response.json()) as AnnotationSyncResult
  },

  async deleteVersion(fileId: string, trialIndex: number, versionId: string): Promise<void> {
    const response = await apiClient.delete(
      `${API_BASE}/${fileId}/trials/${trialIndex}/versions/${versionId}`
    )
    if (!response.ok) {
      throw new Error('删除标注版本失败')
    }
  },
}

export default annotationService
