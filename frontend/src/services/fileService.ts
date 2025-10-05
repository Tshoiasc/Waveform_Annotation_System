import { apiClient } from './api'
import type { FileInfo, TrialMetadata, WaveformResponse } from '../types/waveform'

class FileService {
  async getFiles(): Promise<FileInfo[]> {
    const response = await apiClient.get('/api/files')
    if (!response.ok) {
      throw new Error('获取文件列表失败')
    }
    return (await response.json()) as FileInfo[]
  }

  async getTrials(fileId: string): Promise<TrialMetadata[]> {
    const response = await apiClient.get(`/api/files/${fileId}/trials`)
    if (!response.ok) {
      throw new Error('获取试验元数据失败')
    }
    return (await response.json()) as TrialMetadata[]
  }

  async getWaveform(fileId: string, trialIndex: number): Promise<WaveformResponse> {
    const response = await apiClient.get(`/api/files/${fileId}/trials/${trialIndex}/waveform`)
    if (!response.ok) {
      throw new Error('获取波形数据失败')
    }
    return (await response.json()) as WaveformResponse
  }

  async updateFileStatus(fileId: string, finished: boolean): Promise<void> {
    const response = await apiClient.patch(`/api/files/${fileId}/status`, { finished })
    if (!response.ok) {
      throw new Error('更新文件状态失败')
    }
  }

  async updateTrialStatus(fileId: string, trialIndex: number, finished: boolean): Promise<void> {
    const response = await apiClient.patch(`/api/files/${fileId}/trials/${trialIndex}/status`, { finished })
    if (!response.ok) {
      throw new Error('更新试验状态失败')
    }
  }
}

export default new FileService()
