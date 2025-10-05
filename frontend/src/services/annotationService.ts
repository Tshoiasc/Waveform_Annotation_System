import axios from 'axios'
import type { AnnotationSegment, AnnotationSegmentPayload } from '../types/waveform'

const API_BASE = 'http://localhost:8000/api/annotations'

const annotationService = {
  /**
   * 获取Trial的所有标注
   */
  async getAnnotations(fileId: string, trialIndex: number): Promise<AnnotationSegment[]> {
    const response = await axios.get(`${API_BASE}/${fileId}/trials/${trialIndex}`)
    return response.data
  },

  /**
   * 创建标注
   */
  async createAnnotation(annotation: AnnotationSegmentPayload): Promise<AnnotationSegment> {
    const response = await axios.post(API_BASE, annotation)
    return response.data
  },

  /**
   * 更新标注
   */
  async updateAnnotation(
    id: string,
    updates: Partial<Omit<AnnotationSegment, 'id' | 'fileId' | 'trialIndex' | 'createdAt' | 'eventIndex'>>
  ): Promise<AnnotationSegment> {
    const response = await axios.patch(`${API_BASE}/${id}`, updates)
    return response.data
  },

  /**
   * 删除标注
   */
  async deleteAnnotation(id: string): Promise<void> {
    await axios.delete(`${API_BASE}/${id}`)
  },
}

export default annotationService
