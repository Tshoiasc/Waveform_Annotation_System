import { apiClient } from './api'
import type { AnnotationSegment, AnnotationSegmentPayload } from '../types/waveform'

const API_BASE = '/api/annotations'

const annotationService = {
  async getAnnotations(fileId: string, trialIndex: number): Promise<AnnotationSegment[]> {
    const response = await apiClient.get(`${API_BASE}/${fileId}/trials/${trialIndex}`)
    if (!response.ok) {
      throw new Error('获取标注数据失败')
    }
    return (await response.json()) as AnnotationSegment[]
  },

  async createAnnotation(annotation: AnnotationSegmentPayload): Promise<AnnotationSegment> {
    const response = await apiClient.post(API_BASE, annotation)
    if (!response.ok) {
      throw new Error('创建标注失败')
    }
    return (await response.json()) as AnnotationSegment
  },

  async updateAnnotation(
    id: string,
    updates: Partial<Omit<AnnotationSegment, 'id' | 'fileId' | 'trialIndex' | 'createdAt' | 'eventIndex'>>
  ): Promise<AnnotationSegment> {
    const response = await apiClient.patch(`${API_BASE}/${id}`, updates)
    if (!response.ok) {
      throw new Error('更新标注失败')
    }
    return (await response.json()) as AnnotationSegment
  },

  async deleteAnnotation(id: string): Promise<void> {
    const response = await apiClient.delete(`${API_BASE}/${id}`)
    if (!response.ok) {
      throw new Error('删除标注失败')
    }
  }
}

export default annotationService
