import api from './api'
import type { FileInfo, TrialMetadata, WaveformResponse } from '../types/waveform'

/**
 * 文件服务层
 */
class FileService {
  /**
   * 获取所有H5文件列表
   */
  async getFiles(): Promise<FileInfo[]> {
    const response = await api.get<FileInfo[]>('/files')
    return response.data
  }

  /**
   * 获取文件的所有Trial元数据
   * @param fileId 文件ID (相对路径)
   */
  async getTrials(fileId: string): Promise<TrialMetadata[]> {
    const response = await api.get<TrialMetadata[]>(`/files/${fileId}/trials`)
    return response.data
  }

  /**
   * 获取Trial的完整波形数据
   * @param fileId 文件ID (相对路径)
   * @param trialIndex Trial索引
   */
  async getWaveform(fileId: string, trialIndex: number): Promise<WaveformResponse> {
    const response = await api.get<WaveformResponse>(
      `/files/${fileId}/trials/${trialIndex}/waveform`
    )
    return response.data
  }

  /**
   * 更新指定H5文件的完成状态
   */
  async updateFileStatus(fileId: string, finished: boolean): Promise<void> {
    await api.patch(`/files/${fileId}/status`, { finished })
  }

  /**
   * 更新单个Trial的完成状态
   */
  async updateTrialStatus(fileId: string, trialIndex: number, finished: boolean): Promise<void> {
    await api.patch(`/files/${fileId}/trials/${trialIndex}/status`, { finished })
  }
}

export default new FileService()
